/* Merge Teddy — a small 2D circle solver for the jar. No Three.js here, so tools/check.js can run it in node.
   It's position-based ("small steps"): every 1/60 s frame is split into SUBSTEPS tiny steps. Each one moves the
   circles by their velocity and gravity, pushes overlapping circles apart (heavier fruit move less; the walls
   and floor never move) with friction where they touch, then reads each velocity back from how far the circle
   actually went. Tiny steps keep tall stacks steady without springs, so nothing jitters or explodes.
   Three extras keep it calm:
   - an overlap that was already there (a merged fruit growing into its neighbours) is pushed out without turning
     into a launch: the speed a push leaves behind is capped, except for the little bounce of a hard landing;
   - a merged fruit grows a bit every substep (b.grow), not in jumps;
   - a fruit that has been still for SLEEP_TIME goes to sleep (stops moving) until something bumps it, a fruit
     near it leaves the jar, or the jar is shaken. Without this, a small fruit pinched between two big ones would
     slowly ooze out forever.
   Bodies: { x, y, vx, vy, r, angle, spin }. Mass grows with area (r²). */
(function (root) {
  'use strict';

  const BOUNCE_FROM = 3.5; // closing speed (units/s) below which a landing doesn't bounce
  const PUSH_SPEED = 1; // the most separating speed an overlap push may leave behind
  const CALM_SPEED = 7; // the fastest the pushes alone may make a fruit go
  const SLEEP_DIST = 0.012, SLEEP_TIME = 0.5; // stayed this close to one spot for this long → asleep
  const WAKE_DEPTH = 0.003, WAKE_SPEED = 0.8; // a sleeper wakes when pushed this deep, or hit this fast

  function World(o) {
    o = o || {};
    this.left = o.left;
    this.right = o.right;
    this.floor = o.floor;
    this.gravity = o.gravity != null ? o.gravity : 24;
    this.substeps = o.substeps || 8;
    this.iterations = o.iterations || 4; // overlap passes per substep
    // friction where two fruit touch, and against the glass: a small slip is held (static), a bigger one slides
    this.staticFriction = o.staticFriction != null ? o.staticFriction : 0.2;
    this.friction = o.friction != null ? o.friction : 0.15;
    this.wallFriction = o.wallFriction != null ? o.wallFriction : 0.1;
    this.bounce = o.bounce != null ? o.bounce : 0.18; // only for landings faster than BOUNCE_FROM
    this.maxSpeed = o.maxSpeed || 26;
    this.sleep = o.sleep !== false;
    this.rate = o.rate || 60;
    this.bodies = [];
    this.time = 0;
    this.nextId = 1;
    this.contacts = []; // contact records, reused every substep
    this.nContacts = 0;
  }

  World.prototype.add = function (b) {
    b.id = this.nextId++;
    b.vx = b.vx || 0;
    b.vy = b.vy || 0;
    b.angle = b.angle || 0;
    b.spin = b.spin || 0;
    b.dead = false;
    b.sleeping = false;
    b.still = 0; // seconds spent in one spot (b.sx, b.sy)
    b.sx = b.sy = Infinity;
    b.touching = 0; // contacts in the last frame
    b.grow = b.grow || 0; // seconds of growing left: from b.from to b.to over b.growTime
    this.resize(b, b.r);
    this.bodies.push(b);
    return b;
  };

  // Take a body out. Anything that might have rested on it wakes up.
  World.prototype.remove = function (b) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    b.dead = true;
    this.wakeAll();
  };

  World.prototype.wakeAll = function () {
    for (const b of this.bodies) wake(b);
  };
  function wake(b) {
    b.sleeping = false;
    b.still = 0;
    b.sx = b.sy = Infinity;
  }

  // Set a body's radius; its mass follows.
  World.prototype.resize = function (b, r) {
    b.r = r;
    b.mass = r * r;
    b.inv = 1 / b.mass;
  };

  // Make a body grow from its current radius to `to` over `time` seconds (smoothly, a little every substep).
  World.prototype.growTo = function (b, to, time) {
    b.from = b.r;
    b.to = to;
    b.growTime = time;
    b.grow = time;
    wake(b);
  };

  World.prototype.frame = function (H) {
    const bs = this.bodies, h = H / this.substeps;
    for (const b of bs) b.touching = 0;
    for (let s = 0; s < this.substeps; s++) {
      // 1. move (and grow)
      for (const b of bs) {
        b.px = b.x;
        b.py = b.y;
        if (b.grow > 0) {
          b.grow = Math.max(0, b.grow - h);
          const k = 1 - b.grow / b.growTime;
          this.resize(b, b.from + (b.to - b.from) * k * k * (3 - 2 * k)); // smoothstep: eases in and out
        }
        if (b.sleeping || b.frozen) {
          b.ux = b.uy = 0;
          continue;
        }
        b.vy -= this.gravity * h;
        b.ux = b.vx; // velocity before the overlap passes, for the landing bounce
        b.uy = b.vy;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      // 2. push overlaps apart (with friction), recording each push for the velocity fix-ups
      sortByLeft(bs);
      this.nContacts = 0;
      for (let it = 0; it < this.iterations; it++) this.solve(it === 0);
      // 3. velocity = how far each body actually moved
      for (const b of bs) {
        if (b.sleeping || b.frozen) continue;
        b.vx = (b.x - b.px) / h;
        b.vy = (b.y - b.py) / h;
      }
      // 4. the landing bounce, and a cap on what an overlap push may leave behind
      this.contactVelocities();
      // 5. calm: the pushes may slow a fruit down or turn it, but never speed it up past CALM_SPEED (only gravity
      //    can). In a packed jar, a fruit squeezed between a wall and a growing neighbour would otherwise squirt
      //    out like a pinched seed. Plus a hard limit, just in case. Then the spin (only for looks).
      const max = this.maxSpeed;
      for (const b of bs) {
        if (b.sleeping || b.frozen) continue;
        const v2 = b.vx * b.vx + b.vy * b.vy, u = Math.sqrt(b.ux * b.ux + b.uy * b.uy);
        const lim = Math.min(max, Math.max(u, CALM_SPEED));
        if (v2 > lim * lim) {
          const k = lim / Math.sqrt(v2);
          b.vx *= k;
          b.vy *= k;
        }
        if (b.touching) b.spin += (-b.vx / b.r - b.spin) * 0.08;
        else b.spin *= 0.999;
        b.angle += b.spin * h;
      }
      for (const b of bs) {
        if (b.wakeUp) {
          b.wakeUp = false;
          wake(b);
        }
      }
    }
    // 6. sleep: stayed in one spot for a while (judged by position, so a fruit doing tiny hops in a crevice
    //    still counts as still)
    if (this.sleep) {
      for (const b of bs) {
        if (b.sleeping || b.frozen) continue;
        const dx = b.x - b.sx, dy = b.y - b.sy;
        if (!b.grow && dx * dx + dy * dy < SLEEP_DIST * SLEEP_DIST) b.still += H;
        else {
          b.sx = b.x;
          b.sy = b.y;
          b.still = 0;
        }
        if (b.still >= SLEEP_TIME) {
          b.sleeping = true;
          b.vx = b.vy = b.spin = 0;
        }
      }
    }
    this.time += H;
  };

  // Insertion sort by left edge: the order barely changes between substeps, so this is close to linear.
  function sortByLeft(bs) {
    for (let i = 1; i < bs.length; i++) {
      const b = bs[i], k = b.x - b.r;
      let j = i - 1;
      while (j >= 0 && bs[j].x - bs[j].r > k) {
        bs[j + 1] = bs[j];
        j--;
      }
      bs[j + 1] = b;
    }
  }

  World.prototype.contact = function (a, b, nx, ny) {
    let c = this.contacts[this.nContacts];
    if (!c) c = this.contacts[this.nContacts] = {};
    this.nContacts++;
    c.a = a;
    c.b = b;
    c.nx = nx;
    c.ny = ny;
  };

  // Friction at the position level (as in Macklin et al., "Unified Particle Physics", 2014): undo the sideways
  // slip at a contact during this substep, all of it if it's small (static friction holds), otherwise as much as
  // mu × the push depth (sliding).
  function slip(a, b, nx, ny, depth, wa, wb, muS, muK) {
    let rx = a.x - a.px, ry = a.y - a.py;
    if (b) {
      rx -= b.x - b.px;
      ry -= b.y - b.py;
    }
    const rn = rx * nx + ry * ny, tx = rx - rn * nx, ty = ry - rn * ny, t = Math.sqrt(tx * tx + ty * ty);
    if (t < 1e-12) return;
    const k = (t < muS * depth ? 1 : Math.min(1, (muK * depth) / t)) / (wa + wb);
    a.x -= tx * k * wa;
    a.y -= ty * k * wa;
    if (b) {
      b.x += tx * k * wb;
      b.y += ty * k * wb;
    }
  }

  const fixed = (b) => b.sleeping || b.frozen;

  World.prototype.solve = function (first) {
    const bs = this.bodies, n = bs.length, L = this.left, R = this.right, F = this.floor;
    // fruit against fruit (sweep along x: stop once the next body starts right of this one's right edge)
    for (let i = 0; i < n; i++) {
      const a = bs[i], aRight = a.x + a.r;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j];
        if (b.x - b.r > aRight) break;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2), nx, ny;
        if (d < 1e-6) {
          // exactly on top of each other: push apart sideways
          nx = a.id < b.id ? 1 : -1;
          ny = 0;
          d = 0;
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        const depth = rr - d;
        if (first) {
          a.touching++;
          b.touching++;
        }
        // a sleeper bumped hard enough wakes up, at the end of this substep: until then it stands firm like the
        // glass, so the push it gives is capped like the glass's (see contactVelocities)
        const fa = fixed(a), fb = fixed(b);
        if (fa !== fb) {
          const s = fa ? a : b, o = fa ? b : a;
          if (depth > WAKE_DEPTH || o.vx * o.vx + o.vy * o.vy > WAKE_SPEED * WAKE_SPEED || o.grow > 0) s.wakeUp = true;
        }
        if (fa && fb) continue;
        const wa = fa ? 0 : a.inv, wb = fb ? 0 : b.inv, w = wa + wb;
        a.x -= nx * depth * (wa / w);
        a.y -= ny * depth * (wa / w);
        b.x += nx * depth * (wb / w);
        b.y += ny * depth * (wb / w);
        slip(a, b, nx, ny, depth, wa, wb, this.staticFriction, this.friction);
        this.contact(a, b, nx, ny);
      }
    }
    // walls and floor (the normal points into the jar)
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (fixed(b)) {
        if (first && (b.x - b.r <= L + 1e-4 || b.x + b.r >= R - 1e-4 || b.y - b.r <= F + 1e-4)) b.touching++;
        continue;
      }
      if (b.x - b.r < L) this.wall(b, 1, 0, L - (b.x - b.r), first);
      else if (b.x + b.r > R) this.wall(b, -1, 0, b.x + b.r - R, first);
      if (b.y - b.r < F) this.wall(b, 0, 1, F - (b.y - b.r), first);
    }
  };

  World.prototype.wall = function (b, nx, ny, depth, first) {
    b.x += nx * depth;
    b.y += ny * depth;
    slip(b, null, nx, ny, depth, 1, 0, this.staticFriction, this.wallFriction);
    this.contact(b, null, nx, ny);
    if (first) b.touching++;
  };

  // After the pushes: the separating speed at each contact should be the landing bounce (if this was a hard
  // landing) and no more. An overlap that was already there would otherwise turn into a launch: 0.05 units
  // pushed out in 1/480 s reads back as 24 units/s. For a wall contact `b` is null, and the normal points from
  // the wall into the jar, onto body a.
  World.prototype.contactVelocities = function () {
    for (let i = 0; i < this.nContacts; i++) {
      const c = this.contacts[i], a = c.a, b = c.b;
      // n points from a to b for a pair: flip it so it always points onto a
      const nx = b ? -c.nx : c.nx, ny = b ? -c.ny : c.ny;
      const wa = fixed(a) ? 0 : a.inv, wb = b && !fixed(b) ? b.inv : 0, w = wa + wb;
      if (w === 0) continue;
      const vn = (a.vx - (b ? b.vx : 0)) * nx + (a.vy - (b ? b.vy : 0)) * ny; // > 0: separating
      const un = (a.ux - (b ? b.ux : 0)) * nx + (a.uy - (b ? b.uy : 0)) * ny; // closing speed before the push
      const bounce = un < -BOUNCE_FROM ? -un * this.bounce : 0;
      const dvn = vn < bounce ? bounce - vn : vn > bounce + PUSH_SPEED ? bounce + PUSH_SPEED - vn : 0;
      if (!dvn) continue;
      const k = dvn / w;
      a.vx += nx * k * wa;
      a.vy += ny * k * wa;
      if (b) {
        b.vx -= nx * k * wb;
        b.vy -= ny * k * wb;
      }
    }
  };

  // Biggest overlap between any two bodies, or a body and the walls (for tests).
  World.prototype.maxOverlap = function () {
    let worst = 0;
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      worst = Math.max(worst, this.left - (a.x - a.r), a.x + a.r - this.right, this.floor - (a.y - a.r));
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j], d = Math.hypot(b.x - a.x, b.y - a.y);
        worst = Math.max(worst, a.r + b.r - d);
      }
    }
    return worst;
  };

  const MT = (root.MT = root.MT || {});
  MT.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
