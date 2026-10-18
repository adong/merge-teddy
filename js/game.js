/* Merge Teddy — the game: the scene, the jar, layout, input, HUD and the main loop.
   The jar's rules and physics live in jar.js and physics.js (2D, in jar units: the inside is 6 wide, the floor is
   y = 0). The 3D jar is drawn around that same frame, so a fruit's (x, y) is its place in the jar group. The camera
   looks straight at the jar and is fitted so the jar, the drop zone and the two characters fill the screen:
   side by side in landscape, and in portrait the jar stands on a table with the characters in front of it. */
(function () {
  'use strict';
  const T = THREE, MT = window.MT, Kit = window.Kit, S = MT.sfx, FR = MT.FRUITS, J = MT.JAR;
  const { rand } = Kit.gfx;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- tuning
  const FOV = 30;
  const WALL = 0.28; // glass thickness
  const DEPTH = 2.2; // how deep the jar looks
  const BASE_Y = -0.6; // bottom of the jar's wooden base
  const BACKDROP_Z = -16;
  const COOLDOWN = 0.5; // after a drop, the next fruit appears this much later
  const AIM_SPEED = 6.5; // jar units per second with the arrow keys
  const CHEER_FROM = 4, SIGNATURE_FROM = 6; // merging into an apple makes him cheer; a peach or bigger, his move

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('mergeTeddy.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('mergeTeddy.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };
  const bestFor = (id) => store.get('best.' + id, 0);

  let renderer, scene, camera, overlay, flyers, jarG, fruitG, backdrop, table, lineMesh, hanging = null;
  const jar = MT.makeJar();
  const arts = new Map(); // body id -> fruit picture
  const ghosts = []; // merging fruit sliding together, fruit hopping out of a shaken jar, the last pops
  const timers = [];
  const view = { w: 1, h: 1, s: 1, cx: 0, cy: 0, D: 20, portrait: false, ground: BASE_Y };
  const G = {
    state: 'loading', clock: 0, heroId: 'teddy', aim: 0, cur: 0, next: 1, cooldown: 0, held: 0, newBest: false,
    keys: { left: false, right: false }, pressing: null, shake: 0, jarShake: 0, endQ: [], endT: 0, made: new Set(),
    hold: false, autoPause: true, lastScore: 0,
  };
  const ui = {};
  let portraits = {};

  // ---------------------------------------------------------------- view helpers

  const tmpV = new T.Vector3();
  // a point in the jar's frame -> screen pixels
  function jarToScreen(x, y, z = 0) {
    tmpV.set(x, y, z);
    jarG.localToWorld(tmpV);
    return worldToScreen(tmpV);
  }
  function worldToScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * view.w, y: (0.5 - p.y * 0.5) * view.h };
  }
  // screen x -> jar x (the camera looks straight at the jar, which sits at the origin)
  const screenToJarX = (px) => view.cx + (px - view.w / 2) / view.s;

  // ---------------------------------------------------------------- the backdrop: a sunny orchard

  function backdropTexture() {
    const [c, g] = Kit.gfx.makeCanvas(1024, 1024);
    const HILL = 640; // where the lawn starts
    let grd = g.createLinearGradient(0, 0, 0, HILL);
    grd.addColorStop(0, '#5cc4ff');
    grd.addColorStop(0.7, '#a9e4ff');
    grd.addColorStop(1, '#e4f8ff');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, HILL);
    // sun
    grd = g.createRadialGradient(820, 150, 10, 820, 150, 170);
    grd.addColorStop(0, 'rgba(255,250,200,1)');
    grd.addColorStop(0.3, 'rgba(255,240,150,0.9)');
    grd.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = grd;
    g.fillRect(600, 0, 424, 360);
    // clouds (they wrap around the edges, so the picture tiles sideways)
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [x, y, s] of [[140, 150, 1], [480, 90, 0.8], [700, 260, 0.9], [980, 190, 0.7]]) {
      for (const dx of [-1024, 0, 1024]) {
        for (const [ox, oy, r] of [[0, 0, 46], [40, -18, 40], [80, 0, 44], [40, 14, 40], [-36, 10, 32], [116, 12, 30]]) {
          g.beginPath();
          g.arc(x + dx + ox * s, y + oy * s, r * s, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // hills: two layers of gentle waves (whole periods, so they tile)
    const hill = (y0, amp, n, ph, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, HILL + 10);
      for (let x = 0; x <= 1024; x += 8) g.lineTo(x, y0 - amp * (0.5 + 0.5 * Math.sin((x / 1024) * Math.PI * 2 * n + ph)));
      g.lineTo(1024, HILL + 10);
      g.fill();
    };
    hill(HILL - 70, 90, 2, 0.5, '#8fd16a');
    // orchard trees on the far hill
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 113.7, y = HILL - 70 - 90 * (0.5 + 0.5 * Math.sin((x / 1024) * Math.PI * 4 + 0.5)) + 6;
      g.fillStyle = '#7a5230';
      g.fillRect(x - 5, y - 30, 10, 32);
      g.fillStyle = i % 2 ? '#4fae4a' : '#5bbf52';
      g.beginPath();
      g.arc(x, y - 52, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ['#ff4b5c', '#ffb02e', '#ff7a1a'][i % 3];
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(x + Math.cos(k * 1.3 + i) * 20, y - 52 + Math.sin(k * 1.9 + i) * 18, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
    hill(HILL - 10, 60, 3, 2.1, '#74c158');
    // the lawn: mown stripes
    grd = g.createLinearGradient(0, HILL, 0, 1024);
    grd.addColorStop(0, '#6cc04a');
    grd.addColorStop(1, '#4e9e36');
    g.fillStyle = grd;
    g.fillRect(0, HILL, 1024, 1024 - HILL);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let x = 0; x < 1024; x += 128) {
      g.beginPath();
      g.moveTo(x, HILL);
      g.lineTo(x + 64, HILL);
      g.lineTo(x + 64 + 120, 1024);
      g.lineTo(x - 120 + 64, 1024);
      g.fill();
    }
    // flowers
    for (let i = 0; i < 40; i++) {
      const x = (i * 211) % 1024, y = HILL + 30 + ((i * 97) % (1024 - HILL - 40));
      g.fillStyle = ['#ffffff', '#ffd400', '#ff9bc0'][i % 3];
      g.beginPath();
      g.arc(x, y, 3 + (y - HILL) / 120, 0, Math.PI * 2);
      g.fill();
    }
    const t = Kit.gfx.toTexture(c);
    t.wrapS = T.RepeatWrapping;
    return { tex: t, hill: HILL / 1024 };
  }

  function buildBackdrop() {
    const { tex, hill } = backdropTexture();
    backdrop = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, depthWrite: false }));
    backdrop.position.z = BACKDROP_Z;
    backdrop.renderOrder = -10;
    backdrop.userData.hill = hill;
    scene.add(backdrop);
  }

  // Fit the backdrop behind the view so its lawn starts a little above the ground line.
  function layoutBackdrop() {
    const k = (view.D - BACKDROP_Z) / view.D; // how much bigger the view is back there
    const halfH = (view.h / 2 / view.s) * k, halfW = (view.w / 2 / view.s) * k;
    const hillY = view.cy + (view.ground + 1.2 - view.cy) * k;
    const f = backdrop.userData.hill; // the hill line, as a fraction of the picture from the top
    const top = view.cy + halfH + 1, bottom = view.cy - halfH - 1;
    const H = Math.max((top - hillY) / f, (hillY - bottom) / (1 - f)), W = halfW * 2 + 2;
    backdrop.scale.set(W, H, 1);
    backdrop.position.set(view.cx, hillY + (f - 0.5) * H, BACKDROP_Z);
    backdrop.material.map.repeat.x = W / H; // the picture tiles sideways instead of stretching
  }

  // ---------------------------------------------------------------- the jar

  function glassTexture() {
    const [c, g] = Kit.gfx.makeCanvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    // two soft diagonal shine streaks and a bright edge
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.moveTo(28, 0);
    g.lineTo(58, 0);
    g.lineTo(8, 256);
    g.lineTo(-22, 256);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(70, 0);
    g.lineTo(80, 0);
    g.lineTo(30, 256);
    g.lineTo(20, 256);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(240, 0, 10, 256);
    return Kit.gfx.toTexture(c);
  }

  function dashTexture() {
    const [c, g] = Kit.gfx.makeCanvas(256, 16);
    g.fillStyle = '#ffffff';
    for (let x = 0; x < 256; x += 32) {
      Kit.gfx.roundRect(g, x + 2, 3, 20, 10, 5);
      g.fill();
    }
    const t = Kit.gfx.toTexture(c);
    t.wrapS = T.RepeatWrapping;
    t.repeat.x = 6;
    return t;
  }

  function buildJar() {
    jarG = new T.Group();
    scene.add(jarG);
    const glass = new T.MeshStandardMaterial({ color: '#e6faff', transparent: true, opacity: 0.38, roughness: 0.06, metalness: 0.1, depthWrite: false });
    const edge = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
    const W2 = J.W / 2, H = J.H, bottom = -0.25;
    // the back: a soft blue pane, so the fruit stand out
    const back = new T.Mesh(new T.PlaneGeometry(J.W + 2 * WALL, H - bottom), new T.MeshBasicMaterial({ color: '#cdeefc', transparent: true, opacity: 0.62, depthWrite: false }));
    back.position.set(0, (H + bottom) / 2, -DEPTH / 2);
    back.renderOrder = -2;
    jarG.add(back);
    // side walls, glass floor and the lip
    for (const s of [-1, 1]) {
      const wall = new T.Mesh(new T.BoxGeometry(WALL, H - bottom, DEPTH), glass);
      wall.position.set(s * (W2 + WALL / 2), (H + bottom) / 2, 0);
      wall.renderOrder = 1;
      jarG.add(wall);
      const shine = new T.Mesh(new T.BoxGeometry(0.06, H - bottom - 0.3, 0.02), edge);
      shine.position.set(s * (W2 + 0.04), (H + bottom) / 2, DEPTH / 2 + 0.02);
      shine.renderOrder = 11;
      jarG.add(shine);
    }
    const floor = new T.Mesh(new T.BoxGeometry(J.W + 2 * WALL, -bottom, DEPTH), glass);
    floor.position.set(0, bottom / 2, 0);
    jarG.add(floor);
    const lipMat = new T.MeshBasicMaterial({ color: '#f6fdff', transparent: true, opacity: 0.8, depthWrite: false });
    for (const z of [-1, 1]) {
      const lip = new T.Mesh(new T.BoxGeometry(J.W + 2 * WALL + 0.24, 0.2, 0.12), lipMat);
      lip.position.set(0, H + 0.04, z * (DEPTH / 2 + 0.03));
      lip.renderOrder = z > 0 ? 12 : -1;
      jarG.add(lip);
    }
    for (const s of [-1, 1]) {
      const lip = new T.Mesh(new T.BoxGeometry(WALL + 0.24, 0.2, DEPTH + 0.18), lipMat);
      lip.position.set(s * (W2 + WALL / 2), H + 0.04, 0);
      lip.renderOrder = 12;
      jarG.add(lip);
    }
    // the front glass: just shine, so it doesn't hide the fruit
    const front = new T.Mesh(new T.PlaneGeometry(J.W + 2 * WALL, H - bottom), new T.MeshBasicMaterial({ map: glassTexture(), transparent: true, depthWrite: false }));
    front.position.set(0, (H + bottom) / 2, DEPTH / 2 + 0.01);
    front.renderOrder = 10;
    jarG.add(front);
    // the wooden base
    const wood = Kit.gfx.std('#c98a4b', { roughness: 0.8 });
    const base = new T.Mesh(new T.BoxGeometry(J.W + 2 * WALL + 0.5, bottom - BASE_Y, DEPTH + 0.5), wood);
    base.position.set(0, (BASE_Y + bottom) / 2, 0);
    jarG.add(base);
    const trim = new T.Mesh(new T.BoxGeometry(J.W + 2 * WALL + 0.6, 0.08, DEPTH + 0.6), Kit.gfx.std('#a86e38', { roughness: 0.8 }));
    trim.position.set(0, bottom - 0.02, 0);
    jarG.add(trim);
    // the line: a dashed stripe on the front glass that glows when the jar is nearly full
    lineMesh = new T.Mesh(new T.PlaneGeometry(J.W, 0.09), new T.MeshBasicMaterial({ map: dashTexture(), color: '#ff7aa2', transparent: true, opacity: 0.6, depthWrite: false }));
    lineMesh.position.set(0, J.LINE, DEPTH / 2 + 0.02);
    lineMesh.renderOrder = 13;
    jarG.add(lineMesh);
    // fruit live inside, so they shake with the jar
    fruitG = new T.Group();
    jarG.add(fruitG);
  }

  // A wooden table for portrait screens, where the jar stands up high and the kids stand in front.
  function buildTable() {
    table = new T.Group();
    const wood = Kit.gfx.std('#b8783f', { roughness: 0.85 }), dark = Kit.gfx.std('#8f5a2c', { roughness: 0.85 });
    const top = new T.Mesh(new T.BoxGeometry(J.W + 2.4, 0.32, DEPTH + 1.2), wood);
    top.position.y = -0.16;
    table.add(top);
    const apron = new T.Mesh(new T.BoxGeometry(J.W + 2.0, 0.4, 0.1), dark);
    apron.position.set(0, -0.5, (DEPTH + 1.2) / 2 - 0.15);
    table.add(apron);
    table.legs = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new T.Mesh(new T.BoxGeometry(0.34, 1, 0.34), dark);
        leg.position.set(sx * (J.W / 2 + 0.7), 0, sz * (DEPTH / 2 + 0.2));
        table.add(leg);
        table.legs.push(leg);
      }
    }
    scene.add(table);
  }

  // ---------------------------------------------------------------- layout

  // Fit the world box (x0..x1, y0..y1 at z = 0) into the screen, leaving room for the HUD.
  function fit(box, pad) {
    const w = view.w, h = view.h;
    const L = pad.l, R = w - pad.r, Tp = pad.t, B = h - pad.b;
    const s = Math.min((R - L) / (box.x1 - box.x0), (B - Tp) / (box.y1 - box.y0));
    return { s, cx: (box.x0 + box.x1) / 2 - ((L + R) / 2 - w / 2) / s, cy: (box.y0 + box.y1) / 2 + ((Tp + B) / 2 - h / 2) / s };
  }

  const LAND = { x0: -7.4, x1: 7.4, y0: BASE_Y - 0.7, y1: J.DROP_Y + 1.05 };
  const PORT = { x0: -3.8, x1: 3.8, y0: -4.1, y1: J.DROP_Y + 1.05 };
  const PORT_GROUND = -3.5;

  function layout() {
    const w = view.w, h = view.h;
    const land = fit(LAND, { l: 8, r: 8, t: w > 620 ? 46 : 8, b: 8 }); // (room for the fruit chain on top)
    const port = fit(PORT, { l: 6, r: 6, t: 78, b: 10 });
    view.portrait = port.s > land.s * 1.12;
    const f = view.portrait ? port : land;
    view.s = f.s;
    view.cx = f.cx;
    view.cy = f.cy;
    view.ground = view.portrait ? PORT_GROUND : BASE_Y;
    view.D = h / view.s / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.aspect = w / h;
    camera.position.set(view.cx, view.cy, view.D);
    camera.near = 1;
    camera.far = view.D - BACKDROP_Z + 10;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // the table (portrait only)
    table.visible = view.portrait;
    if (view.portrait) {
      table.position.set(0, BASE_Y, 0);
      const legH = BASE_Y - 0.32 - PORT_GROUND;
      for (const leg of table.legs) {
        leg.scale.y = legH;
        leg.position.y = -0.32 - legH / 2;
      }
    }
    // the characters: beside the jar in landscape; in portrait, in front of the table
    const viewRight = view.cx + w / 2 / view.s;
    if (view.portrait) {
      MT.hero.place(-1.95, PORT_GROUND, 2.4, 3.1, 1);
      MT.buddy.place(1.35, PORT_GROUND, 2.4, 3.1, viewRight + 2.5); // (clear of his button)
    } else {
      const x = J.W / 2 + WALL + 2.05;
      MT.hero.place(-x, BASE_Y, 0.8, 4.3, 1);
      MT.buddy.place(x, BASE_Y, 0.8, 4.3, viewRight + 3);
    }
    layoutBackdrop();
  }

  function resize() {
    // a hidden or collapsed page can report 0 × 0: keep a sane view until it has a real size
    view.w = window.innerWidth || view.w || 800;
    view.h = window.innerHeight || view.h || 600;
    renderer.setSize(view.w, view.h, false);
    overlay.resize(view.w, view.h, renderer.getPixelRatio());
    layout();
  }

  // ---------------------------------------------------------------- fruit pictures

  function artFor(b) {
    let a = arts.get(b.id);
    if (!a) {
      a = MT.fruitArt.make(b.level);
      a.pop = b.dropped ? 1 : 0; // a merged fruit pops in with a squish
      a.group.position.z = 0.0004 * (b.id % 40); // no flicker where two pictures touch
      fruitG.add(a.group);
      arts.set(b.id, a);
    }
    return a;
  }

  function dropArt(id) {
    const a = arts.get(id);
    if (!a) return null;
    arts.delete(id);
    return a;
  }

  function freeArt(a) {
    fruitG.remove(a.group);
    MT.fruitArt.dispose(a);
  }

  // Keep the pictures in step with the bodies.
  function syncArts(dt) {
    const alive = new Set();
    for (const b of jar.fruits) {
      alive.add(b.id);
      const a = artFor(b);
      a.group.position.x = b.x;
      a.group.position.y = b.y;
      a.body.rotation.z = b.angle;
      let k = 1;
      if (a.pop < 1) {
        a.pop = Math.min(1, a.pop + dt / 0.35);
        k = 1 + 0.2 * Math.sin(Math.PI * a.pop) * (1 - a.pop * 0.4);
      }
      a.group.scale.set(b.r * k, b.r * (2 - k), 1);
    }
    for (const [id, a] of arts) {
      if (!alive.has(id)) {
        arts.delete(id);
        freeArt(a);
      }
    }
  }

  // ---------------------------------------------------------------- ghosts: pictures that move on their own

  // two merging fruit slide into the spot where the new one appears
  function mergeGhost(a, b, x, y) {
    for (const body of [a, b]) {
      const art = dropArt(body.id);
      if (!art) continue;
      ghosts.push({ art, kind: 'merge', t: 0, life: 0.1, x0: body.x, y0: body.y, x, y, r: body.r });
    }
  }

  // a fruit hopping out of the shaken jar
  function flingGhost(body, i) {
    const art = dropArt(body.id) || (() => { const a = MT.fruitArt.make(body.level); fruitG.add(a.group); return a; })();
    const side = body.x < 0 ? -1 : 1;
    ghosts.push({ art, kind: 'fling', t: -i * 0.08, life: 2.2, x: body.x, y: body.y, vx: side * rand(3, 6), vy: rand(9, 13), r: body.r, spin: rand(-10, 10) });
  }

  function updateGhosts(dt) {
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i];
      g.t += dt;
      if (g.t < 0) continue;
      const a = g.art.group;
      if (g.kind === 'merge') {
        const k = Math.min(1, g.t / g.life);
        a.position.set(g.x0 + (g.x - g.x0) * k, g.y0 + (g.y - g.y0) * k, 0.03);
        a.scale.setScalar(g.r * (1 - 0.45 * k));
      } else if (g.kind === 'fling') {
        g.vy -= 26 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        a.position.set(g.x, g.y, 1.4);
        g.art.body.rotation.z += g.spin * dt;
        a.scale.setScalar(g.r);
      }
      if (g.t >= g.life) {
        freeArt(g.art);
        ghosts.splice(i, 1);
      }
    }
  }

  function clearGhosts() {
    for (const g of ghosts) freeArt(g.art);
    ghosts.length = 0;
  }

  // ---------------------------------------------------------------- the fruit you're holding

  function setHanging(level) {
    if (hanging) {
      fruitG.remove(hanging.group);
      MT.fruitArt.dispose(hanging);
    }
    hanging = level === null ? null : MT.fruitArt.make(level);
    if (hanging) {
      hanging.pop = 0;
      hanging.group.position.z = 0.05;
      fruitG.add(hanging.group);
    }
  }

  const aimRange = (level) => J.W / 2 - FR[level].r - 0.001;

  function updateHanging(dt) {
    if (!hanging) return;
    const ready = G.state === 'play' && G.cooldown <= 0;
    hanging.group.visible = ready;
    if (!ready) return;
    const r = FR[G.cur].r;
    G.aim = clamp(G.aim, -aimRange(G.cur), aimRange(G.cur));
    hanging.pop = Math.min(1, hanging.pop + dt / 0.3);
    const k = hanging.pop < 1 ? 1 + 0.25 * Math.sin(Math.PI * hanging.pop) - 0.6 * (1 - hanging.pop) : 1;
    hanging.group.position.x = G.aim;
    hanging.group.position.y = J.DROP_Y + Math.sin(G.clock * 3) * 0.05;
    hanging.group.scale.setScalar(r * k);
    hanging.body.rotation.z = Math.sin(G.clock * 2) * 0.12;
  }

  function nextFruit() {
    G.cur = G.next;
    G.next = jar.randomLevel();
    setHanging(G.cur);
    ui.nextImg.src = MT.fruitArt.icon(G.next);
    ui.nextImg.classList.remove('pop');
    void ui.nextImg.offsetWidth;
    ui.nextImg.classList.add('pop');
  }

  function drop(force) {
    if (G.state !== 'play' || (G.cooldown > 0 && !force)) return null;
    const b = jar.drop(G.aim, G.cur);
    G.cooldown = COOLDOWN;
    if (hanging) hanging.group.visible = false;
    S.drop();
    MT.hero.react('bounce');
    return b;
  }

  // ---------------------------------------------------------------- what happened in the jar

  function fruitScreen(x, y) {
    return jarToScreen(x, y, 0);
  }

  function handleEvents() {
    for (const e of jar.events.splice(0)) {
      if (e.type === 'merge') onMerge(e);
      else if (e.type === 'megamelon') onMegamelon(e);
      else if (e.type === 'warn') onWarn();
      else if (e.type === 'calm') onCalm();
      else if (e.type === 'save') onSave(e);
      else if (e.type === 'over') endGame();
    }
  }

  function onMerge(e) {
    mergeGhost(e.a, e.b, e.x, e.y);
    const f = FR[e.level], from = FR[e.from], p = fruitScreen(e.x, e.y), px = f.r * view.s;
    overlay.burst(p.x, p.y, from.color, 10 + e.level * 3, 220 + e.level * 45, 4 + e.level * 0.8);
    overlay.burst(p.x, p.y, f.color, 6 + e.level * 2, 160 + e.level * 40, 4 + e.level * 0.8);
    overlay.ring(p.x, p.y, '#ffffff', px * 1.1);
    overlay.text('+' + e.pts, p.x, p.y - px * 0.4, { size: 24 + e.level * 2.4, color: e.level >= 6 ? '#fff3a0' : '#ffd400' });
    if (e.combo >= 2) overlay.text(`COMBO ×${e.combo}`, p.x, p.y - px - 30, { size: 26 + e.combo * 3, color: '#7df9ff', life: 1.1 });
    S.merge(e.level, e.combo);
    addScore();
    if (e.level >= 5) G.shake = Math.max(G.shake, 0.08 + (e.level - 5) * 0.04);
    if (!G.made.has(e.level)) {
      G.made.add(e.level);
      if (e.level >= 3 && e.level < 9) {
        toast(`NEW! ${f.emoji} ${f.name}`, 'new');
        S.discover();
      }
      renderChain();
    }
    if (e.level === 9) return celebrateMelon('🍉 WATERMELON! 🍉', `+${e.pts}`, p);
    if (e.level >= SIGNATURE_FROM || e.combo >= 4) {
      MT.hero.react('signature');
      if (MT.buddy.on) MT.buddy.actor.react('cheer');
    } else if (e.level >= CHEER_FROM || e.combo >= 3) MT.hero.react('cheer');
    else MT.hero.react('bounce');
  }

  function onMegamelon(e) {
    for (const body of [e.a, e.b]) {
      const art = dropArt(body.id);
      if (art) freeArt(art);
      const p = fruitScreen(body.x, body.y);
      overlay.burst(p.x, p.y, '#ff4d6d', 40, 700, 10);
      overlay.burst(p.x, p.y, '#2f9e4a', 24, 500, 9);
    }
    const p = fruitScreen(e.x, e.y);
    addScore();
    celebrateMelon('MEGA MELON!', `+${e.pts}`, p);
  }

  // The big one: confetti, a banner, a fanfare, and both brothers celebrating.
  function celebrateMelon(title, sub, p) {
    overlay.confetti(170);
    overlay.confetti(60, p.x, p.y);
    ui.banner.innerHTML = `${title}<small>${sub}</small>`;
    ui.banner.classList.remove('on');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('on');
    ui.flash.classList.remove('on');
    void ui.flash.offsetWidth;
    ui.flash.classList.add('on');
    S.fanfare();
    G.shake = 0.35;
    MT.hero.react('signature');
    after(1.9, () => MT.hero.react('signature'));
    after(1.0, () => overlay.confetti(90));
    if (MT.buddy.on) MT.buddy.actor.react('signature');
  }

  function onWarn() {
    toast('ALMOST FULL!', 'warn');
    S.warn();
    MT.hero.react('worry');
  }

  function onCalm() {
    S.calm();
    MT.hero.react('calm');
  }

  // The buddy saves a game over: he shakes the jar and the fruit over the line hop out.
  function onSave(e) {
    MT.buddy.shake();
    G.jarShake = 1.1;
    S.shake();
    e.popped.forEach((b, i) => flingGhost(b, i));
    if (e.popped.length) after(0.15, () => S.whee());
    MT.hero.react('calm');
    const p = jarToScreen(0, J.LINE + 1);
    overlay.text('WHEE!', p.x, p.y, { size: 40, color: '#ffffff', life: 1.2 });
  }

  function addScore() {
    if (jar.score === G.lastScore) return;
    G.lastScore = jar.score;
    ui.score.textContent = jar.score;
    ui.score.classList.remove('bump');
    void ui.score.offsetWidth;
    ui.score.classList.add('bump');
    if (jar.score > G.best && !G.newBest && G.best > 0) {
      G.newBest = true;
      toast('★ NEW BEST! ★');
      S.kit('powerup');
    }
    ui.hudBest.textContent = Math.max(G.best, jar.score);
  }

  // The buddy gobbles one fruit: take it out of the jar and hand the game its place in the world.
  function gobble() {
    const got = jar.gobble(1)[0];
    if (!got) return null;
    const a = dropArt(got.id);
    if (a) freeArt(a);
    const pos = new T.Vector3(got.x, got.y, 0.2);
    jarG.localToWorld(pos);
    return { level: got.level, pos, r: got.r * jarG.scale.x };
  }

  function nomFx(at, f) {
    const p = worldToScreen(at), up = MT.buddy.actor.scale * view.s * 1.1; // above his name tag
    overlay.text('NOM!', p.x - up * 0.3, p.y - up, { size: 34, color: '#ffffff', life: 0.9 });
    overlay.burst(p.x, p.y, f.color, 10, 220, 5);
    S.nom();
  }

  // ---------------------------------------------------------------- game flow

  function demoJar() {
    jar.clear();
    jar.guard = null;
    // a few fruit resting in the jar behind the title screen
    const set = [[9, -1.3, 1.7], [8, 1.55, 1.4], [6, 1.9, 3.9], [5, -0.4, 4.0], [4, -2.2, 4.0], [3, 0.9, 5.4], [2, -1.4, 5.5], [1, 2.4, 5.4], [0, 0.1, 6.0]];
    for (const [L, x, y] of set) jar.place(L, x, y);
  }

  function startGame() {
    S.init();
    jar.clear();
    jar.guard = () => G.state === 'play' && MT.buddy.canSave();
    for (const [, a] of arts) freeArt(a);
    arts.clear();
    clearGhosts();
    overlay.clear();
    flyers.clear();
    timers.length = 0;
    Object.assign(G, { state: 'play', cooldown: 0.3, newBest: false, made: new Set([0, 1, 2, 3, 4]), endQ: [], lastScore: 0, aim: 0, jarShake: 0, overShown: false });
    G.best = bestFor(G.heroId);
    G.next = jar.randomLevel();
    G.next = Math.min(G.next, 2); // start small
    nextFruit();
    ui.score.textContent = '0';
    ui.hudBest.textContent = G.best;
    renderChain();
    show('hud');
    S.music('play');
    MT.hero.react('hello');
  }

  function endGame() {
    G.state = 'ending';
    G.endT = 0;
    // the fruit pop one by one, from the top down
    G.endQ = jar.fruits.slice().sort((a, b) => b.y + b.r - (a.y + a.r));
    setHanging(null);
    MT.hero.react('idle');
    MT.buddy.leave();
    S.over();
    S.music('over');
  }

  function updateEnding(dt) {
    G.endT += dt;
    if (G.endT < 0.9) return;
    while (G.endQ.length && G.endT > 0.9 + (G.endQ.done || 0) * 0.07) {
      const b = G.endQ.shift();
      G.endQ.done = (G.endQ.done || 0) + 1;
      jar.world.remove(b);
      const a = dropArt(b.id);
      if (a) freeArt(a);
      const p = fruitScreen(b.x, b.y);
      overlay.burst(p.x, p.y, FR[b.level].color, 8, 260, 5);
      S.plink(G.endQ.done);
    }
    if (!G.endQ.length && !G.overShown) {
      G.overShown = true;
      after(0.7, showOver);
    }
  }

  function showOver() {
    G.state = 'over';
    G.overShown = false;
    const best = bestFor(G.heroId);
    const newBest = jar.score > best;
    if (newBest) store.set('best.' + G.heroId, jar.score);
    const big = Math.max(0, jar.biggest);
    ui.ovScore.textContent = jar.score;
    ui.ovBiggest.innerHTML = `<img alt="" src="${MT.fruitArt.icon(big)}">${FR[big].name}`;
    ui.ovMerges.textContent = jar.merges;
    ui.ovBest.textContent = Math.max(best, jar.score);
    ui.ovBestLabel.textContent = MT.hero.entry.name + "'S BEST";
    ui.ovTitle.textContent = big >= 9 ? 'WATERMELON HERO!' : jar.score >= 1500 ? 'AMAZING!' : jar.score >= 400 ? 'GREAT JOB!' : 'NICE ONE!';
    ui.newBest.classList.toggle('on', newBest);
    show('over');
    buildPicker();
    MT.hero.react('over');
    if (newBest) S.kit('powerup');
  }

  function goTitle() {
    G.state = 'title';
    setHanging(null);
    for (const [, a] of arts) freeArt(a);
    arts.clear();
    clearGhosts();
    demoJar();
    show('title');
    buildPicker();
    S.music('title');
    MT.hero.react('idle');
  }

  function setPaused(on) {
    if (on && G.state === 'play') {
      G.state = 'paused';
      show('pause', true);
      S.music('pause');
      G.pressing = null;
    } else if (!on && G.state === 'paused') {
      G.state = 'play';
      show('hud');
      S.music('play');
    }
  }

  function show(which, keepHud) {
    ui.title.classList.toggle('hidden', which !== 'title');
    ui.over.classList.toggle('hidden', which !== 'over');
    ui.pause.classList.toggle('hidden', which !== 'pause');
    ui.hud.classList.toggle('hidden', !(which === 'hud' || keepHud));
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '') + (text.length > 22 ? ' long' : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    setTimeout(() => el.remove(), 1600);
  }

  // run fn after `sec` seconds of game clock (pauses with the game)
  function after(sec, fn) {
    timers.push({ at: G.clock + sec, fn });
  }

  function renderChain() {
    if (!ui.chain.children.length) {
      FR.forEach((f, i) => {
        const img = document.createElement('img');
        img.src = MT.fruitArt.icon(i);
        img.alt = f.name;
        img.title = f.name;
        ui.chain.appendChild(img);
      });
    }
    const top = Math.max(...G.made);
    [...ui.chain.children].forEach((img, i) => {
      img.classList.toggle('made', G.made.has(i));
      img.classList.toggle('top', i === top && i > 4);
    });
  }

  // ---------------------------------------------------------------- characters and the picker

  function setHero(id, react) {
    const e = Kit.roster.get(id) ? id : 'teddy';
    G.heroId = e;
    MT.buddy.dropTreat(); // it was in the old hero's hand
    MT.hero.set(e);
    setBuddy(e);
    layout();
    store.set('hero', e);
    if (ui.picker) {
      ui.picker.querySelectorAll('.avatar').forEach((b) => b.setAttribute('aria-checked', b.dataset.id === e ? 'true' : 'false'));
      ui.bestName.textContent = Kit.roster.get(e).name;
      ui.bestTitle.textContent = bestFor(e);
    }
    if (react) MT.hero.react('hello');
  }

  // The buddy who comes for this player: rebuild him and relabel his button, HUD row and title card.
  function setBuddy(heroId) {
    const b = MT.buddy.setFor(heroId);
    const nice = b.name[0] + b.name.slice(1).toLowerCase();
    ui.buddyFace.src = ui.pwBuddyFace.src = portraits[b.id] || '';
    ui.buddyName.textContent = b.name;
    ui.buddyBtn.title = `Call ${nice} (T)`;
    ui.buddyKey.textContent = nice;
    const card = $('buddyCard');
    if (card) {
      card.querySelector('img').src = portraits[b.id] || '';
      card.querySelector('.nm').textContent = b.name;
    }
  }

  function callBuddy() {
    S.init();
    if (G.state === 'paused' || G.state === 'loading') return null;
    return MT.buddy.call();
  }

  function buildPicker() {
    ui.picker.innerHTML = '';
    for (const c of Kit.roster.list) {
      const b = document.createElement('button');
      b.className = 'avatar' + (c.id === 'teddy' || c.id === 'tommy' ? ' hero' : '');
      b.dataset.id = c.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', c.id === G.heroId ? 'true' : 'false');
      b.innerHTML = `<img alt="" src="${portraits[c.id] || ''}"><span class="nm">${c.name}</span><span class="bs">BEST ${bestFor(c.id)}</span>`;
      b.addEventListener('click', () => {
        S.init();
        S.kit('click');
        setHero(c.id, true);
        if (G.state === 'over') goTitle();
      });
      ui.picker.appendChild(b);
      if (c.id === 'tommy') ui.picker.appendChild(Object.assign(document.createElement('i'), { className: 'brk' }));
    }
    // the buddy card: tap it and he comes right now
    const bd = MT.buddy.entry;
    const card = document.createElement('button');
    card.className = 'avatar buddy';
    card.id = 'buddyCard';
    card.title = 'Call your buddy (T)';
    card.innerHTML = `<img alt="" src="${portraits[bd.id] || ''}"><span class="nm">${bd.name}</span><span class="bs">BUDDY · TAP ME!</span>`;
    card.addEventListener('click', () => {
      S.kit('click');
      callBuddy();
      card.blur();
    });
    ui.picker.appendChild(card);
    ui.bestName.textContent = Kit.roster.get(G.heroId).name;
    ui.bestTitle.textContent = bestFor(G.heroId);
  }

  function buildLogo() {
    const t = MT.TITLE.toUpperCase(), i = t.indexOf('TT');
    ui.logo.innerHTML = i > 0 ? `<span class="l1">${t.slice(0, i)}<em>T</em><em>T</em>${t.slice(i + 2)}</span>` : `<span class="l1">${t}</span>`;
    document.title = `${MT.TITLE} · Teddy & Tommy`;
  }

  // ---------------------------------------------------------------- input

  function bindInput() {
    const cv = renderer.domElement;
    const aimAt = (e) => {
      if (G.state === 'play') G.aim = screenToJarX(e.clientX);
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      S.init();
      if (G.state !== 'play') return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      G.pressing = e.pointerId;
      aimAt(e);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      // a mouse aims just by moving; a finger aims while it's down
      if (e.pointerType === 'mouse' || G.pressing === e.pointerId) aimAt(e);
    });
    cv.addEventListener('pointerup', (e) => {
      if (G.pressing !== e.pointerId) return;
      G.pressing = null;
      aimAt(e);
      drop();
    });
    cv.addEventListener('pointercancel', () => { G.pressing = null; });

    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        if (G.state === 'title' && !e.repeat) cycleHero(-1);
        G.keys.left = true;
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        if (G.state === 'title' && !e.repeat) cycleHero(1);
        G.keys.right = true;
      } else if (k === 'm' || k === 'M') toggleMute();
      else if (k === 't' || k === 'T') callBuddy();
      else if (k === 'p' || k === 'P' || k === 'Escape') setPaused(G.state === 'play');
      else if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 's' || k === 'S') {
        if (document.activeElement && document.activeElement.tagName === 'BUTTON' && k === 'Enter') return;
        e.preventDefault();
        if (e.repeat) return;
        S.init();
        if (G.state === 'play') drop();
        else if ((G.state === 'title' || G.state === 'over') && (k === ' ' || k === 'Enter')) startGame();
        else if (G.state === 'paused' && k === ' ') setPaused(false);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') G.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') G.keys.right = false;
    });
    window.addEventListener('blur', () => { G.keys.left = G.keys.right = false; });
    $('playBtn').addEventListener('click', startGame);
    $('againBtn').addEventListener('click', startGame);
    $('heroBtn').addEventListener('click', () => { S.kit('click'); goTitle(); });
    $('resumeBtn').addEventListener('click', () => setPaused(false));
    $('quitBtn').addEventListener('click', goTitle);
    $('pauseBtn').addEventListener('click', (e) => { setPaused(true); e.currentTarget.blur(); });
    $('muteBtn').addEventListener('click', (e) => { toggleMute(); e.currentTarget.blur(); });
    ui.buddyBtn.addEventListener('click', (e) => {
      callBuddy();
      e.currentTarget.blur();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) setPaused(true);
        S.suspend();
      } else S.resume();
    });
    window.addEventListener('resize', resize);
  }

  function cycleHero(d) {
    const ids = Kit.roster.list.map((c) => c.id), i = ids.indexOf(G.heroId);
    setHero(ids[(i + ids.length + d) % ids.length], true);
  }

  function toggleMute() {
    S.init();
    const m = S.toggleMute();
    ui.muteBtn.textContent = m ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- loop

  function tick(dt) {
    G.clock += dt;
    if (G.state === 'paused' || G.state === 'loading') return;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (G.clock >= timers[i].at) {
        const fn = timers[i].fn;
        timers.splice(i, 1);
        fn();
      }
    }
    if (G.state === 'play') {
      const dir = (G.keys.right ? 1 : 0) - (G.keys.left ? 1 : 0);
      if (dir) G.aim += dir * AIM_SPEED * dt;
      if (G.cooldown > 0) {
        G.cooldown -= dt;
        if (G.cooldown <= 0) nextFruit();
      }
    }
    if (G.state !== 'ending' && G.state !== 'over') jar.update(dt);
    // a soft thump when a dropped fruit first lands
    for (const b of jar.fruits) {
      if (b.dropped && !b.landed && b.touching && b.age > 0.05) {
        b.landed = true;
        S.thud(b.level);
      }
    }
    handleEvents();
    if (G.state === 'ending') updateEnding(dt);
    syncArts(dt);
    updateGhosts(dt);
    updateHanging(dt);
    overlay.update(dt);
    flyers.update(dt, 9);

    // the hero watches your aim (or the top of the pile)
    const heroX = MT.hero.root.position.x;
    const watchX = G.state === 'play' ? G.aim : 0;
    MT.hero.update(dt, clamp((watchX - heroX) / 6, -1, 1));
    MT.buddy.update(dt);
    const guard = MT.buddy.guardLeft;
    ui.pwBuddy.classList.toggle('on', guard > 0);
    ui.buddyBtn.classList.toggle('guarding', guard > 0);
    if (guard > 0) {
      ui.pwBuddyFill.style.transform = `scaleX(${guard})`;
      ui.pwShield.classList.toggle('used', !MT.buddy.saveReady);
    }

    // the line glows as the jar gets close to full
    const d = jar.dangerLevel();
    lineMesh.material.opacity = 0.55 + d * (0.35 + 0.1 * Math.sin(G.clock * 12));
    lineMesh.material.color.setRGB(1, 0.48 - d * 0.3, 0.64 - d * 0.4);
    lineMesh.scale.y = 1 + d * 1.5;
    G.shake = Math.max(0, G.shake - dt);
    G.jarShake = Math.max(0, G.jarShake - dt);
  }

  function drawAim() {
    if (G.state !== 'play' || G.cooldown > 0 || !hanging) return;
    const r = FR[G.cur].r, land = jar.landingY(G.aim, r);
    const a = jarToScreen(G.aim, J.DROP_Y - r), b = jarToScreen(G.aim, land + r * 0.2);
    const g = overlay.ctx;
    g.save();
    g.setLineDash([8, 10]);
    g.lineDashOffset = -G.clock * 30;
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, Math.max(a.y, b.y));
    g.stroke();
    g.restore();
  }

  function render() {
    const s = G.shake, js = G.jarShake;
    camera.position.x = view.cx + (s > 0 ? Math.sin(G.clock * 70) * s * 0.4 : 0);
    camera.position.y = view.cy + (s > 0 ? Math.cos(G.clock * 53) * s * 0.3 : 0);
    jarG.position.x = js > 0 ? Math.sin(G.clock * 38) * 0.16 * Math.min(1, js * 2) : 0;
    jarG.rotation.z = js > 0 ? Math.sin(G.clock * 29) * 0.035 * Math.min(1, js * 2) : 0;
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    overlay.draw();
    drawAim();
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!G.hold) {
      tick(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    try {
      await Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* system fonts */ }
    try {
      renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('loading').textContent = 'This browser can’t run WebGL, so the game can’t start.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 1, 100);
    scene.add(new T.HemisphereLight('#ffffff', '#6a9a50', 0.95));
    const sun = new T.DirectionalLight('#fff6e0', 1.1);
    sun.position.set(-5, 9, 10);
    scene.add(sun);

    Object.assign(ui, {
      hud: $('hud'), title: $('title'), over: $('over'), pause: $('pause'), score: $('score'), hudBest: $('hudBest'),
      toasts: $('toasts'), banner: $('banner'), flash: $('flash'), nextImg: $('nextImg'), chain: $('chain'),
      muteBtn: $('muteBtn'), picker: $('picker'), bestName: $('bestName'), bestTitle: $('bestTitle'), logo: $('logo'),
      ovScore: $('ovScore'), ovBiggest: $('ovBiggest'), ovMerges: $('ovMerges'), ovBest: $('ovBest'), ovBestLabel: $('ovBestLabel'),
      ovTitle: $('ovTitle'), newBest: $('newBest'),
      buddyBtn: $('buddyBtn'), buddyFace: $('buddyFace'), buddyName: $('buddyName'), buddyKey: $('buddyKeyName'),
      pwBuddy: $('pwBuddy'), pwBuddyFace: $('pwBuddyFace'), pwBuddyFill: $('pwBuddyFill'), pwShield: $('pwShield'),
    });
    buildLogo();
    $('tagline').textContent = 'Drop the fruit in the jar. Two the same make a bigger one. Can you grow a watermelon? 🍉';
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';

    MT.fruitArt.init();
    buildBackdrop();
    buildJar();
    buildTable();
    overlay = MT.fx.makeOverlay($('fx'));
    overlay.ctx = $('fx').getContext('2d');
    flyers = MT.fx.makeFlyers(scene);
    const onSwish = (at) => {
      const p = worldToScreen(at);
      overlay.text('SWISH!', p.x, p.y + 30, { color: '#ff9f1c', size: 30, life: 1 });
    };
    MT.hero.init(scene, flyers);
    MT.hero.onSwish = onSwish;
    MT.buddy.init({ scene, flyers, toast, onSwish, gobble, nom: nomFx });
    try {
      portraits = Kit.portraits(Kit.roster.list, { size: 152 });
    } catch (e) {
      portraits = {};
    }
    resize();
    setHero(store.get('hero', 'teddy'));
    bindInput();
    goTitle();
    // settle the demo jar before the first frame is seen
    for (let i = 0; i < 90; i++) jar.update(1 / 60);
    renderer.compile(scene, camera);
    $('loading').remove();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- console hooks for testing and showing off

  window.game = {
    get state() { return G.state; },
    G, jar, view,
    start(id) {
      if (id) setHero(id);
      startGame();
      return G.state;
    },
    title() { goTitle(); return G.state; },
    // Advance `seconds` of game time right now, drawing every frame (the Browser pane throttles animation).
    step(seconds = 1) {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
        tick(1 / 60);
        render();
      }
      return game.info();
    },
    // Drop the current fruit at jar x (-3 .. 3), skipping the wait between drops.
    drop(x = 0) {
      if (G.state !== 'play') return null;
      if (G.cooldown > 0) {
        G.cooldown = 0;
        nextFruit();
      }
      G.aim = clamp(x, -aimRange(G.cur), aimRange(G.cur));
      const b = drop(true);
      return b ? { level: b.level, fruit: FR[b.level].id, x: +b.x.toFixed(2) } : null;
    },
    info() {
      return {
        state: G.state, hero: G.heroId, score: jar.score, fruits: jar.fruits.length, merges: jar.merges,
        biggest: jar.biggest >= 0 ? FR[jar.biggest].id : null, danger: +jar.danger.toFixed(2), current: FR[G.cur].id, next: FR[G.next].id,
        layout: view.portrait ? 'portrait' : 'landscape', heroPose: MT.hero.pose,
      };
    },
    // put a fruit anywhere in the jar: level 0 (cherry) .. 9 (watermelon)
    place(level, x, y) { const b = jar.place(level, x, y); return b.id; },
    setNext(level) { G.next = level; return FR[level].id; },
    hero(kind) { return MT.hero.react(kind); },
    setHero(id) { setHero(id, true); return G.heroId; },
    buddy() { return callBuddy(); },
    buddyInfo() {
      const r = MT.buddy.actor.root.position;
      return { id: MT.buddy.entry.id, on: MT.buddy.on, t: +MT.buddy.t.toFixed(2), guarding: MT.buddy.guarding(), saveReady: MT.buddy.saveReady, gobbled: MT.buddy.gobbled, given: MT.buddy.given, holding: MT.buddy.holding, pose: MT.buddy.actor.pose, x: +r.x.toFixed(2), home: +MT.buddy.actor.home.x.toFixed(2) };
    },
    // fill the jar past the line (to try the warning, the buddy's save and the game over)
    overfill() {
      const lv = [8, 7, 6, 5, 4, 3, 2, 1, 0, 9];
      let y = 1.5;
      for (let i = 0; i < lv.length; i++) jar.place(lv[i], ((i % 3) - 1) * 1.6, (y += 1.2));
      return jar.fruits.length;
    },
    celebrate() { celebrateMelon('🍉 WATERMELON! 🍉', '+45', { x: view.w / 2, y: view.h / 2 }); },
    pause(on = true) { setPaused(on); return G.state; },
    // the Browser pane hides the page between test steps; this stops that from pausing the game
    set autoPause(on) { G.autoPause = !!on; },
    // hold(true) stops the live loop so only step() moves time: screenshots then show exactly what step() drew
    hold(on = true) { G.hold = !!on; return G.hold; },
  };

  boot();
})();
