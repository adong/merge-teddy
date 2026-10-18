/* Merge Teddy — the jar's rules, with no drawing (tools/check.js runs this in node).
   Fruit drop in, two of the same that touch merge into the next one up, points are triangle numbers, and a fruit
   that pokes above the line for OVER_AFTER seconds ends the game (with a warning first). The buddy can gobble the
   smallest fruit and, once per visit, shake the jar to save a game over. Everything that happens is pushed onto
   jar.events for the game to draw and play: drop, merge, megamelon, warn, calm, save, over. */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  // The ten fruit, smallest first. r is in jar units (the jar is 6 wide); color is the juice colour.
  MT.FRUITS = [
    { id: 'cherry', name: 'CHERRY', emoji: '🍒', r: 0.27, color: '#d61f4e' },
    { id: 'strawberry', name: 'STRAWBERRY', emoji: '🍓', r: 0.37, color: '#ff4b5c' },
    { id: 'grape', name: 'GRAPE', emoji: '🍇', r: 0.49, color: '#8d5ad8' },
    { id: 'orange', name: 'ORANGE', emoji: '🍊', r: 0.59, color: '#ff9a1f' },
    { id: 'apple', name: 'APPLE', emoji: '🍏', r: 0.73, color: '#74c83a' },
    { id: 'pear', name: 'PEAR', emoji: '🍐', r: 0.87, color: '#f5d23a' },
    { id: 'peach', name: 'PEACH', emoji: '🍑', r: 1.01, color: '#ffa48a' },
    { id: 'pineapple', name: 'PINEAPPLE', emoji: '🍍', r: 1.19, color: '#f2b705' },
    { id: 'melon', name: 'MELON', emoji: '🍈', r: 1.41, color: '#b9e27c' },
    { id: 'watermelon', name: 'WATERMELON', emoji: '🍉', r: 1.68, color: '#2f9e4a' },
  ];
  const FR = MT.FRUITS, TOP = FR.length - 1;

  // Merging two of level L makes level L + 1 and scores (L + 1)(L + 2) / 2: a cherry pair is 1, a melon pair 45.
  MT.mergePoints = (L) => ((L + 1) * (L + 2)) / 2;
  MT.MEGA_POINTS = 100; // two watermelons: both pop, with a party

  MT.JAR = {
    W: 6, // inner width; x runs -3 .. 3
    H: 7.4, // rim height above the floor (y = 0)
    LINE: 6.55, // the danger line
    DROP_Y: 8.35, // where the next fruit hangs before you drop it
    DROPPABLE: 5, // you're handed cherries .. apples
  };

  const WARN_AFTER = 0.7, OVER_AFTER = 3.2; // seconds a settled fruit may poke above the line
  const SETTLE_AGE = 1.1; // a dropped fruit only counts for the line after this long (it's still falling)
  const GROW_TIME = 0.2; // a merged fruit grows into its new size over this long
  const POP_FROM = 0.6; // ... starting at this much of the old fruit's size, so it never appears overlapping
  const MERGE_GAP = 0.04; // a fresh fruit waits this long before it merges again (so chains are visible)
  const COMBO_GAP = 0.75; // merges within this long of each other count as a chain
  const TOUCH = 0.025; // circles this close count as touching

  function makeJar(o) {
    o = o || {};
    const J = MT.JAR, rand = o.random || Math.random;
    const world = new MT.World({ left: -J.W / 2, right: J.W / 2, floor: 0 });
    const jar = {
      world,
      fruits: world.bodies,
      events: [],
      score: 0,
      merges: 0,
      biggest: -1, // highest level made by merging (or dropped)
      combo: 0,
      lastMerge: -9,
      danger: 0, // seconds over the line
      warned: false,
      calmFor: 0, // the line isn't checked for this long (after a save)
      time: 0,
      drops: 0,
      guard: null, // () => true if someone can save a game over right now (the buddy)
      over: false,
    };

    function spawn(level, x, y, extra) {
      return world.add(Object.assign({ x, y, r: FR[level].r, level, age: 0, born: jar.time }, extra || {}));
    }

    // Drop a fruit of `level` at x (clamped inside the jar).
    jar.drop = function (x, level) {
      const r = FR[level].r;
      x = Math.max(-J.W / 2 + r + 0.001, Math.min(J.W / 2 - r - 0.001, x));
      // an overfull jar can reach the drop point: then the fruit starts on top of the pile, not inside it
      const y = Math.max(J.DROP_Y, jar.landingY(x, r) + r + 0.01);
      const b = spawn(level, x, y, { vy: -1.5, dropped: true });
      jar.drops++;
      jar.biggest = Math.max(jar.biggest, level);
      jar.events.push({ type: 'drop', body: b, level });
      return b;
    };

    // Put a fruit anywhere (tests and the title screen's demo jar).
    jar.place = function (level, x, y) {
      const b = spawn(level, x, y);
      b.age = SETTLE_AGE;
      return b;
    };

    jar.clear = function () {
      for (const b of world.bodies.slice()) world.remove(b);
      Object.assign(jar, { score: 0, merges: 0, biggest: -1, combo: 0, lastMerge: -9, danger: 0, warned: false, calmFor: 0, drops: 0, over: false });
      jar.events.length = 0;
    };

    function merge(a, b) {
      const L = a.level, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      world.remove(a);
      world.remove(b);
      jar.combo = jar.time - jar.lastMerge < COMBO_GAP ? jar.combo + 1 : 1;
      jar.lastMerge = jar.time;
      jar.merges++;
      if (L === TOP) {
        // two watermelons: both pop for a big bonus
        jar.score += MT.MEGA_POINTS;
        jar.events.push({ type: 'megamelon', x, y, pts: MT.MEGA_POINTS, combo: jar.combo, a, b });
        return null;
      }
      const pts = MT.mergePoints(L);
      jar.score += pts;
      const n = spawn(L + 1, x, y, {
        vx: (a.vx * a.mass + b.vx * b.mass) / (a.mass + b.mass),
        vy: (a.vy * a.mass + b.vy * b.mass) / (a.mass + b.mass) + 0.6,
        r: a.r * POP_FROM, // pops in small and grows, so it never appears overlapping its neighbours
        age: SETTLE_AGE, angle: a.angle,
      });
      world.growTo(n, FR[L + 1].r, GROW_TIME);
      const first = L + 1 > jar.biggest;
      jar.biggest = Math.max(jar.biggest, L + 1);
      jar.events.push({ type: 'merge', level: L + 1, from: L, x, y, pts, combo: jar.combo, body: n, a, b, first });
      return n;
    }

    // Same-level pairs that touch merge, lowest pairs first (a chain can climb within one frame).
    function findMerges() {
      const bs = world.bodies;
      let any = false;
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        if (a.dead || jar.time - a.born < MERGE_GAP) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          if (b.x - b.r > a.x + a.r + TOUCH) break; // bodies are sorted by left edge
          if (b.dead || b.level !== a.level || jar.time - b.born < MERGE_GAP) continue;
          const rr = a.r + b.r + TOUCH, dx = b.x - a.x, dy = b.y - a.y;
          if (dx * dx + dy * dy <= rr * rr) {
            merge(a, b);
            any = true;
            break;
          }
        }
      }
      return any;
    }

    // Advance dt seconds in fixed 1/60 s frames: physics, then merges, then the line.
    let acc = 0;
    jar.update = function (dt) {
      const H = 1 / world.rate;
      acc = Math.min(acc + dt, H * 6);
      while (acc >= H - 1e-9 && !jar.over) {
        acc -= H;
        world.frame(H);
        jar.time += H;
        for (const b of world.bodies) b.age += H;
        findMerges();
        checkLine(H);
      }
    };

    function checkLine(t) {
      if (jar.calmFor > 0) {
        jar.calmFor -= t;
        jar.danger = 0;
        return;
      }
      let over = false;
      for (const b of world.bodies) if (b.age >= SETTLE_AGE && b.y + b.r > J.LINE) { over = true; break; }
      if (over) jar.danger += t;
      else jar.danger = Math.max(0, jar.danger - t * 2);
      if (!jar.warned && jar.danger > WARN_AFTER) {
        jar.warned = true;
        jar.events.push({ type: 'warn' });
      } else if (jar.warned && jar.danger === 0) {
        jar.warned = false;
        jar.events.push({ type: 'calm' });
      }
      if (jar.danger >= OVER_AFTER) {
        if (jar.guard && jar.guard()) {
          jar.events.push({ type: 'save', popped: jar.shake() });
        } else {
          jar.over = true;
          jar.events.push({ type: 'over' });
        }
      }
    }

    // A good shake: fruit poking above the line hop out of the jar (returned, for the game to fling off-screen),
    // the rest get jiggled so they settle lower, and the line gets a moment's rest.
    jar.shake = function () {
      const popped = [];
      for (const b of world.bodies.slice()) {
        if (b.y + b.r > J.LINE - 0.15) {
          world.remove(b);
          popped.push(b);
        }
      }
      world.wakeAll();
      for (const b of world.bodies) {
        b.vx += (rand() - 0.5) * 3;
        b.vy += 1.5 + rand() * 2.5;
      }
      jar.danger = 0;
      jar.warned = false;
      jar.calmFor = 2.5;
      return popped;
    };

    // The buddy gobbles the n smallest fruit (topmost first among equals). Returns them, already out of the jar.
    jar.gobble = function (n) {
      const pick = world.bodies.filter((b) => b.age > 0.4).sort((a, b) => a.level - b.level || b.y - a.y).slice(0, n);
      for (const b of pick) world.remove(b);
      return pick;
    };

    // Where a fruit of radius r dropped at x would come to rest: the height of its bottom (for the aiming line).
    jar.landingY = function (x, r) {
      let best = 0;
      for (const b of world.bodies) {
        const dx = Math.abs(b.x - x), rr = b.r + r;
        if (dx < rr) best = Math.max(best, b.y + Math.sqrt(rr * rr - dx * dx) - r);
      }
      return best;
    };

    // How much is in the jar: the highest fruit top (for the characters to look worried).
    jar.top = function () {
      let t = 0;
      for (const b of world.bodies) if (b.age >= SETTLE_AGE) t = Math.max(t, b.y + b.r);
      return t;
    };

    jar.dangerLevel = () => Math.min(1, jar.danger / OVER_AFTER);
    jar.randomLevel = function () {
      // smaller fruit a bit more often: cherry 30 %, strawberry 26 %, grape 20 %, orange 14 %, apple 10 %
      const w = [30, 26, 20, 14, 10], u = rand() * 100;
      let s = 0;
      for (let i = 0; i < w.length; i++) if (u < (s += w[i])) return i;
      return 0;
    };
    return jar;
  }

  MT.makeJar = makeJar;
  MT.JAR_TIMING = { WARN_AFTER, OVER_AFTER, SETTLE_AGE, GROW_TIME };
})(typeof window !== 'undefined' ? window : globalThis);
