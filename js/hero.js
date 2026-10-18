/* Merge Teddy — the characters beside the jar. MT.makeActor() builds a Kit.roster character that stands on the
   ground, turned a little toward the jar, and reacts:
     bounce (a little hop when you drop), cheer (arms up: a good merge), signature (his celebration: Tommy's Y with
     peace fingers, or Teddy's boxing combo / basketball jump shot through a pop-up hoop), worry (hands on cheeks
     while the jar is nearly full), hello / goodbye, over (keeps celebrating on the results screen);
   act(pose, dur) plays any pose for a moment: the buddy's run, nom, give and jar shake.
   MT.hero is you; the buddy (js/buddy.js) is a second actor. Adapted from FruiTTy Kids' chefs. */
(function () {
  'use strict';
  const T = THREE;
  const MT = (window.MT = window.MT || {});
  const Kit = window.Kit;
  const rand = Kit.gfx.rand;

  const DUR = { cheer: 0.8, signature: 1.8, hello: 1.8, worry: 99 };
  const SPEED = { idle: 2.2, cheer: 6, boxing: 6, peace: 4.2, wave: 5, jumpshot: 3, jump: 3, run: 13, give: 6, worry: 5, nom: 9, shake: 9, grab: 4 };
  const BALL_SIZE = 0.24;
  const RIM = { y: -0.28, z: 0.42, r: 0.36 }; // rim centre relative to the backboard, in hoop units
  const SHOT_TIME = 0.75; // seconds from release to the rim
  const STANDING = { peace: 1, wave: 1, idle: 1, give: 1, worry: 1, nom: 1, shake: 1, cheer: 1, grab: 1 };

  // ------------------------------------------------------------ poses the kit doesn't have

  // Kit.people.pose for its own modes, plus worry (hands on cheeks, head wobbling), nom (hands to the mouth,
  // chewing) and shake (both hands on the jar, rocking it).
  function pose(p, ph, mode, k) {
    const own = mode === 'worry' || mode === 'nom' || mode === 'shake';
    Kit.people.pose(p, ph, own ? 'idle' : mode === 'cheer' ? 'jump' : mode, k);
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    let head = 0;
    if (mode === 'worry') {
      to(p.armL.rotation, 'x', 2.55);
      to(p.armR.rotation, 'x', 2.55);
      to(p.armL.rotation, 'z', 0.62);
      to(p.armR.rotation, 'z', -0.62);
      head = Math.sin(ph) * 0.16;
    } else if (mode === 'nom') {
      to(p.armL.rotation, 'x', 2.35 + Math.sin(ph) * 0.12);
      to(p.armR.rotation, 'x', 2.35 + Math.sin(ph) * 0.12);
      to(p.armL.rotation, 'z', 0.7);
      to(p.armR.rotation, 'z', -0.7);
      to(p.head.rotation, 'x', -0.25 + Math.abs(Math.sin(ph)) * 0.2);
    } else if (mode === 'shake') {
      to(p.armL.rotation, 'x', 1.5 + Math.sin(ph) * 0.3);
      to(p.armR.rotation, 'x', 1.5 - Math.sin(ph) * 0.3);
      to(p.armL.rotation, 'z', 0.15);
      to(p.armR.rotation, 'z', -0.15);
      to(p.hips.rotation, 'y', Math.sin(ph) * 0.25);
    } else if (mode === 'cheer') {
      // both arms straight up, a happy wiggle
      to(p.armL.rotation, 'x', 2.9);
      to(p.armR.rotation, 'x', 2.9);
      to(p.armL.rotation, 'z', -0.3 - Math.sin(ph) * 0.15);
      to(p.armR.rotation, 'z', 0.3 + Math.sin(ph) * 0.15);
    }
    p.head.rotation.z += (head - p.head.rotation.z) * k;
    // a standing character: tone the running stride of the celebration poses down to a little dance
    if (STANDING[mode]) {
      p.legL.rotation.x *= 0.35;
      p.legR.rotation.x *= 0.35;
    }
    if (mode === 'idle') {
      const breathe = Math.sin(ph) * 0.03;
      p.armL.rotation.z = -0.08 - breathe;
      p.armR.rotation.z = 0.08 + breathe;
    }
  }
  MT.pose = pose;

  // ------------------------------------------------------------ Teddy's basketball and hoop

  function ballTexture() {
    const [c, g] = Kit.gfx.makeCanvas(256, 128);
    g.fillStyle = '#f07b1f';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#2a160a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(256, 64);
    for (const x of [64, 192]) {
      g.moveTo(x, 0);
      g.lineTo(x, 128);
    }
    g.moveTo(128, 0);
    g.bezierCurveTo(90, 40, 90, 88, 128, 128);
    g.moveTo(0, 0);
    g.bezierCurveTo(38, 40, 38, 88, 0, 128);
    g.stroke();
    return Kit.gfx.toTexture(c);
  }

  function shadowTexture() {
    return Kit.gfx.radialTexture(128, [[0, 'rgba(20,40,0,0.5)'], [0.6, 'rgba(20,40,0,0.22)'], [1, 'rgba(20,40,0,0)']]);
  }

  function buildHoop() {
    const g = new T.Group();
    const [c, x] = Kit.gfx.makeCanvas(160, 112);
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 160, 112);
    x.lineWidth = 8;
    x.strokeStyle = '#ff5a1f';
    x.strokeRect(6, 6, 148, 100);
    x.lineWidth = 6;
    x.strokeRect(52, 46, 56, 44);
    const white = Kit.gfx.std('#f4f4f4'), front = Kit.gfx.std('#ffffff', { map: Kit.gfx.toTexture(c) });
    g.add(new T.Mesh(new T.BoxGeometry(1.3, 0.9, 0.06), [white, white, white, white, front, white]));
    const orange = Kit.gfx.std('#ff5a1f', { roughness: 0.4, metalness: 0.3 });
    const bracket = new T.Mesh(new T.BoxGeometry(0.12, 0.06, RIM.z - RIM.r), orange);
    bracket.position.set(0, RIM.y, (RIM.z - RIM.r) / 2);
    g.add(bracket);
    const rim = new T.Mesh(new T.TorusGeometry(RIM.r, 0.035, 8, 28), orange);
    rim.rotation.x = Math.PI / 2 - 0.45; // nearly flat, tipped toward the camera so you can see the hoop
    rim.position.set(0, RIM.y, RIM.z);
    g.add(rim);
    const [nc, nx] = Kit.gfx.makeCanvas(128, 64);
    nx.strokeStyle = '#ffffff';
    nx.lineWidth = 3;
    for (let i = -8; i < 16; i++) {
      nx.beginPath();
      nx.moveTo(i * 16, 0);
      nx.lineTo(i * 16 + 64, 64);
      nx.moveTo(i * 16 + 64, 0);
      nx.lineTo(i * 16, 64);
      nx.stroke();
    }
    const net = new T.Mesh(
      new T.CylinderGeometry(RIM.r, RIM.r * 0.62, 0.42, 16, 1, true),
      new T.MeshBasicMaterial({ map: Kit.gfx.toTexture(nc), transparent: true, side: T.DoubleSide, depthWrite: false }),
    );
    net.rotation.x = -0.45;
    net.position.set(0, RIM.y - 0.2, RIM.z + 0.09);
    g.add(net);
    g.visible = false;
    return g;
  }

  // ------------------------------------------------------------ an actor

  function makeActor() {
    let scene = null, flyers = null, holder = null, p = null, entry = null, shadow = null, ball = null, hoop = null;
    const st = { mode: 'idle', pose: 'idle', t: 0, phase: 0, hopY: 0, hopV: 0, sigIx: 0, beat: -1, loop: null, ballT: -1, look: 0, face: null, mul: 1, scale: 1, side: 1, worried: false };
    const ballV = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), rimAt = new T.Vector3();
    const home = new T.Vector3();
    // face the camera, turned toward the jar (side 1: he stands left of the jar)
    const facing = () => (st.face !== null ? st.face : Math.PI + 0.42 * st.side);

    function init(sc, fl) {
      scene = sc;
      flyers = fl;
      holder = new T.Group();
      scene.add(holder);
      shadow = new T.Sprite(new T.SpriteMaterial({ map: shadowTexture(), depthWrite: false, transparent: true }));
      shadow.scale.set(1.6, 0.34, 1);
      shadow.position.set(0, 0.03, 0);
      holder.add(shadow);
      ball = new T.Mesh(new T.SphereGeometry(BALL_SIZE, 20, 14), Kit.gfx.std('#ffffff', { map: ballTexture(), roughness: 0.6 }));
      ball.visible = false;
      scene.add(ball);
      hoop = buildHoop();
      scene.add(hoop);
    }

    // Build the character for roster entry `id`; `mul` scales him (a buddy is smaller: entry.buddyScale).
    function set(id, mul = 1) {
      entry = Kit.roster.get(id) || Kit.roster.list[0];
      if (p) holder.remove(p.root);
      p = Kit.people.build(entry.look);
      p.root.rotation.y = facing();
      holder.add(p.root);
      st.mul = mul;
      st.sigIx = 0;
      st.mode = 'idle';
      st.loop = null;
      st.ballT = -1;
      st.worried = false;
      ball.visible = hoop.visible = false;
      pose(p, 0, 'idle', 1);
      return entry;
    }

    // Stand at (x, y, z) at `size` world units tall (times the buddy scale); side 1 = left of the jar.
    function place(x, y, z, size, side) {
      const s = (size / 2.05) * st.mul;
      holder.scale.setScalar(s);
      home.set(x, y, z);
      holder.position.copy(home);
      st.scale = s;
      st.side = side;
    }

    // Start a reaction. Returns the pose used.
    function react(kind) {
      if (!p) return null;
      if (st.loop && kind !== 'hello' && kind !== 'idle') return st.pose; // game over: keep celebrating
      switch (kind) {
        case 'bounce':
          if (st.mode === 'idle') st.hopV = Math.max(st.hopV, 1.8);
          return st.pose;
        case 'cheer':
          if (st.mode === 'signature') return st.pose;
          return begin('cheer', 'cheer', DUR.cheer, 3.4);
        case 'signature': {
          if (st.mode === 'signature' && st.t > 0.5) return st.pose;
          const sig = entry.signature || ['wave'];
          const ps = sig[st.sigIx++ % sig.length];
          return begin('signature', ps, DUR.signature, hopFor(ps));
        }
        case 'hello':
          st.loop = null;
          return begin('signature', Kit.roster.signature(entry, 'hello'), DUR.hello, 2.6);
        case 'goodbye': {
          const ps = Kit.roster.signature(entry, 'goodbye');
          return begin('signature', ps, DUR.signature, hopFor(ps));
        }
        case 'worry':
          st.worried = true;
          if (st.mode === 'idle') begin('worry', 'worry', DUR.worry, 0);
          return 'worry';
        case 'calm':
          st.worried = false;
          if (st.mode === 'worry') return begin('cheer', 'cheer', 0.6, 2.4);
          return st.pose;
        case 'over': {
          // goodbye pose first, then keep cycling the celebrations until the next game
          const sig = entry.signature || ['wave'];
          const ps = Kit.roster.signature(entry, 'goodbye');
          st.sigIx = sig.indexOf(ps) + 1;
          st.loop = true;
          st.loopWait = 0.8;
          st.worried = false;
          return begin('signature', ps, DUR.signature, hopFor(ps));
        }
        case 'idle':
          st.loop = null;
          st.worried = false;
          st.mode = 'idle';
          st.pose = 'idle';
          return 'idle';
      }
      return null;
    }

    // Play any pose for `dur` seconds (the buddy's run, nom, give and shake), unless a celebration is on.
    function act(ps, dur, hop = 0, force = false) {
      if (!p || (!force && st.mode === 'signature' && st.t > 0.2)) return st.pose;
      if (st.mode === 'act' && st.pose === ps) {
        st.t = Math.max(st.t, dur); // already doing it: keep the cycle going
        return ps;
      }
      return begin('act', ps, dur, hop);
    }

    const hopFor = (ps) => (ps === 'jumpshot' ? 5.2 : ps === 'peace' ? 2.6 : 1.4);

    function showHoop() {
      const s = st.scale;
      // the hoop pops up on the jar's side of him, high up
      hoop.position.set(holder.position.x + 2.2 * s * st.side, holder.position.y + 3.4 * s, holder.position.z + 0.2 * s);
      hoop.rotation.y = -0.25 * st.side;
      hoop.visible = true;
      st.hoopT = 0;
    }

    function begin(mode, ps, dur, hop) {
      st.mode = mode;
      st.pose = ps;
      st.t = dur;
      st.phase = 0;
      st.beat = -1;
      if (hop) st.hopV = hop;
      st.since = 0;
      st.bursts = 0;
      if (ps === 'jumpshot') {
        st.ballT = 0;
        st.swished = false;
        showHoop();
      }
      return ps;
    }

    // lookX: where to look, -1 (his left on screen) .. 1 (right)
    function update(dt, lookX) {
      if (!p) return;
      st.t -= dt;
      if (st.mode !== 'idle' && st.t <= 0) {
        st.mode = 'idle';
        st.pose = 'idle';
      }
      if (st.mode === 'idle' && st.worried) begin('worry', 'worry', DUR.worry, 0);
      if (st.loop && st.mode === 'idle') {
        st.loopWait -= dt;
        if (st.loopWait <= 0) {
          st.loopWait = 0.8;
          const sig = entry.signature || ['wave'];
          const ps = sig[st.sigIx++ % sig.length];
          begin('signature', ps, DUR.signature, hopFor(ps));
        }
      }
      st.phase += dt * (SPEED[st.pose] || 2.2);
      p.root.rotation.y += (facing() - p.root.rotation.y) * (1 - Math.exp(-10 * dt));
      pose(p, st.phase, st.pose, 1 - Math.exp(-14 * dt));
      // hop
      st.hopV -= 14 * dt;
      st.hopY = Math.max(0, st.hopY + st.hopV * dt);
      if (st.hopY === 0 && st.hopV < 0) st.hopV = 0;
      p.root.position.y = st.hopY;
      shadow.material.opacity = 1 / (1 + st.hopY * 1.5);
      // head follows the fruit
      st.look += ((lookX || 0) * 0.6 - st.look) * (1 - Math.exp(-5 * dt));
      p.head.rotation.y = st.look;

      holder.updateMatrixWorld(true);
      // boxing: a POW at each punch
      if (st.pose === 'boxing') {
        const beat = Math.floor((((st.phase / (Math.PI * 2)) % 1) + 1) % 1 * 4);
        if (beat !== st.beat) {
          st.beat = beat;
          if (beat === 0 || beat === 2) {
            MT.sfx.kit('punch');
            Kit.people.handWorld(p, beat === 0 ? -1 : 1, tmp);
            flyers.add('💥', tmp.x + 0.25 * st.scale * st.side, tmp.y, tmp.z + 0.6, rand(0.5, 1.2) * st.side, rand(0.4, 1), 0.6 * st.scale, 0.45, 0, 0);
          }
        }
      }
      // the Y pose: ✌️ and stars float up from both hands, three little bursts
      st.since += dt;
      if (st.pose === 'peace' && st.bursts < 3 && st.since > 0.15 + st.bursts * 0.55) {
        st.bursts++;
        for (const s of [-1, 1]) {
          Kit.people.handWorld(p, s, tmp);
          flyers.add(Math.random() < 0.7 ? '✌️' : '⭐', tmp.x, tmp.y, tmp.z + 0.6, s * rand(0.3, 0.9), rand(1.6, 2.6), rand(0.45, 0.6) * st.scale, 1.1, rand(-1, 1), 0.15);
        }
      }
      updateBall(dt);
    }

    // Teddy's jump shot: the ball rides up in his hands, leaves them at the top of the jump, drops through the hoop.
    function updateBall(dt) {
      if (hoop.visible) {
        st.hoopT += dt;
        const k = st.hoopT < 0.25 ? st.hoopT / 0.25 : st.hoopT > 2.2 ? Math.max(0, 1 - (st.hoopT - 2.2) / 0.25) : 1;
        hoop.scale.setScalar(st.scale * (k < 1 ? k * (1.25 - 0.25 * k) : 1));
        if (st.hoopT > 2.45) hoop.visible = false;
      }
      if (st.ballT < 0) return;
      st.ballT += dt;
      const s = st.scale, g = 9 * s;
      ball.scale.setScalar(s);
      hoop.updateMatrixWorld(true);
      rimAt.set(0, RIM.y, RIM.z).applyMatrix4(hoop.matrixWorld);
      if (st.ballT < 0.38) {
        Kit.people.handWorld(p, -1, tmp);
        Kit.people.handWorld(p, 1, tmp2);
        ball.position.copy(tmp).add(tmp2).multiplyScalar(0.5);
        ball.position.y += BALL_SIZE * s;
        ball.position.z = rimAt.z;
        ball.visible = true;
        // aim: reach the rim centre (a ball-radius above it) SHOT_TIME seconds after release
        ballV.set((rimAt.x - ball.position.x) / SHOT_TIME, (rimAt.y + BALL_SIZE * s * 0.5 - ball.position.y) / SHOT_TIME + 0.5 * g * SHOT_TIME, 0);
      } else {
        ballV.y -= g * dt;
        ball.position.addScaledVector(ballV, dt);
        ball.rotation.z -= 6 * dt;
        if (!st.swished && st.ballT > 0.38 + SHOT_TIME) {
          st.swished = true;
          ballV.x *= 0.15; // the net catches it
          ballV.y *= 0.5;
          MT.sfx.kit('swish');
          if (actor.onSwish) actor.onSwish(rimAt);
        }
        if (st.ballT > 2.3) {
          ball.visible = false;
          st.ballT = -1;
        }
      }
    }

    const actor = {
      init, set, place, react, act, update,
      onSwish: null,
      home,
      get entry() { return entry; },
      get person() { return p; },
      get mode() { return st.mode; },
      get pose() { return st.pose; },
      get root() { return holder; },
      get scale() { return st.scale; },
      get side() { return st.side; },
      // turn to face a direction (radians, as root.rotation.y), or null to face the camera again
      set face(a) { st.face = a; },
      set visible(v) {
        holder.visible = v;
        if (!v) {
          ball.visible = false;
          hoop.visible = false;
          st.ballT = -1;
        }
      },
      get visible() { return holder.visible; },
    };
    return actor;
  }

  MT.makeActor = makeActor;
  MT.hero = makeActor();
})();
