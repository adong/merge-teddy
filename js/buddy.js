/* Merge Teddy — the buddy: the other brother comes to help, like Metro Surfer's and FruiTTy Kids' buddies.
   Kit.roster.buddyFor(you) picks him: Tommy for everyone, Teddy when Tommy is playing. Call him with his button,
   the T key or his card on the title screen, as often as you like. A visit is about 10 s:
     run in from the right → hello (Tommy's Y, Teddy's boxing) → gobble the three smallest fruit, one at a time,
     "NOM!" → hand you a treat → goodbye (Tommy's Y, Teddy's jump shot) → run off.
   While he's there (the first 9.6 s) he guards you once: if the jar would end the game, he shakes it instead, the
   fruit poking over the line hop out, and "TEDDY SAVED YOU!". Calling him again once he's handed over his treat
   makes him say hi again: three more nibbles, another treat and another save (a call before that is saved up). */
(function () {
  'use strict';
  const T = THREE;
  const MT = (window.MT = window.MT || {});
  const Kit = window.Kit;
  const { pick, rand } = Kit.gfx;

  const V = { hello: 0.35, gobble: [1.4, 1.85, 2.3], giveAt: 3.3, throwAt: 3.65, byeAt: 8.2, guardUntil: 9.6 }; // seconds into a visit
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const NOM_TIME = 0.5; // a gobbled fruit's flight to his mouth

  let api = null, actor = null, entry = null, offX = 20;
  const b = { on: false, t: 0, x: 20, said: false, gobbled: 0, given: false, bye: false, saveUsed: false, shakeT: 0, treats: 0, queued: false };
  const treat = { sprite: null, flyT: -1, holdT: 0, from: new T.Vector3(), to: new T.Vector3() };
  const noms = []; // fruit flying into his mouth
  const tmp = new T.Vector3();

  function init(a) {
    api = a;
    actor = MT.makeActor();
    actor.init(a.scene, a.flyers);
    actor.visible = false;
    actor.onSwish = a.onSwish;
    treat.sprite = new T.Sprite(new T.SpriteMaterial({ depthWrite: false, transparent: true }));
    treat.sprite.visible = false;
    treat.sprite.renderOrder = 9;
    a.scene.add(treat.sprite);
  }

  // The buddy for this player. Rebuilds him only when he changes.
  function setFor(heroId) {
    const id = Kit.roster.buddyFor(heroId);
    if (entry && entry.id === id) return entry;
    if (b.on) dismiss();
    entry = Kit.roster.get(id);
    actor.set(id, entry.buddyScale || 0.8);
    const tag = Kit.gfx.nameTag(entry.name, entry.tag || '#ffb02e');
    tag.position.y = 2.55;
    actor.person.root.add(tag);
    actor.visible = false;
    return entry;
  }

  // His spot (right of the jar) and where he runs in from (off the right edge of the view).
  function place(x, y, z, size, offEdge) {
    actor.place(x, y, z, size, -1);
    offX = offEdge;
    if (!b.on) b.x = offX;
    actor.root.position.x = b.x;
  }

  function call() {
    if (!b.on) return summon();
    if (b.given || b.t >= V.guardUntil) return again();
    b.queued = true; // he's still busy with this visit: once he's handed over his treat, he says hi again
    return 'queued';
  }

  // say hi again: more nibbles, another treat, another save
  function again() {
    Object.assign(b, { t: V.hello - 0.05, said: false, gobbled: 0, given: false, bye: false, saveUsed: false, queued: false });
    api.toast(`${entry.name}'S HERE!`);
    MT.sfx.kit('powerup');
    return 'again';
  }

  function summon() {
    Object.assign(b, { on: true, t: 0, x: offX, said: false, gobbled: 0, given: false, bye: false, saveUsed: false, shakeT: 0, queued: false });
    actor.visible = true;
    actor.react('idle');
    actor.root.position.x = b.x;
    api.toast(`${entry.name}'S HERE!`);
    MT.sfx.kit('powerup');
    return 'summoned';
  }

  function dismiss() {
    b.on = false;
    actor.visible = false;
    clearNoms();
  }

  // The game is ending: skip to the goodbye.
  function leave() {
    if (b.on && b.t < V.guardUntil) b.t = V.guardUntil;
  }

  const guarding = () => b.on && b.t < V.guardUntil;

  // The jar asks before ending the game: he saves you once per call.
  function canSave() {
    if (!guarding() || b.saveUsed) return false;
    b.saveUsed = true;
    return true;
  }

  // He shakes the jar (the game shakes the jar itself and flings the fruit that hop out).
  function shake() {
    b.shakeT = 1.1;
    actor.act('shake', 1.1, 2.2, true);
    api.toast(`${entry.name} SAVED YOU!`);
  }

  // ---------------------------------------------------------------- gobbling

  function gobbleOne() {
    const got = api.gobble(); // { level, pos: world Vector3, r } or null
    if (!got) return;
    const art = MT.fruitArt.make(got.level);
    art.group.position.copy(got.pos);
    art.group.scale.setScalar(got.r);
    art.group.renderOrder = 7;
    api.scene.add(art.group);
    noms.push({ art, t: 0, from: got.pos.clone(), r: got.r, spin: rand(-8, 8) });
    actor.act('nom', 0.8, 1.6, true);
  }

  function mouth(out) {
    actor.root.updateMatrixWorld(true);
    return actor.person.head.localToWorld(out.set(0, 0.05, 0.25));
  }

  function updateNoms(dt) {
    for (let i = noms.length - 1; i >= 0; i--) {
      const n = noms[i];
      n.t += dt / NOM_TIME;
      const k = Math.min(1, n.t);
      mouth(tmp);
      const g = n.art.group;
      g.position.lerpVectors(n.from, tmp, k);
      g.position.y += Math.sin(k * Math.PI) * 1.8;
      g.position.z = n.from.z + (tmp.z - n.from.z) * k + 0.3;
      g.scale.setScalar(n.r * (1 - 0.75 * k));
      n.art.body.rotation.z += n.spin * dt;
      if (k >= 1) {
        api.scene.remove(g);
        MT.fruitArt.dispose(n.art);
        noms.splice(i, 1);
        api.nom(tmp, MT.FRUITS[n.art.level]);
      }
    }
  }

  function clearNoms() {
    for (const n of noms) {
      api.scene.remove(n.art.group);
      MT.fruitArt.dispose(n.art);
    }
    noms.length = 0;
  }

  // ---------------------------------------------------------------- the treat

  function giveTreat() {
    const [emoji, label] = pick(TREATS);
    treat.sprite.material.map = Kit.gfx.emojiTexture(emoji);
    treat.sprite.material.needsUpdate = true;
    actor.root.updateMatrixWorld(true);
    Kit.people.handWorld(actor.person, 1, treat.from);
    treat.from.z += 0.5;
    if (treat.sprite.parent !== api.scene) api.scene.add(treat.sprite);
    treat.sprite.position.copy(treat.from);
    treat.sprite.scale.setScalar(0.9 * MT.hero.scale);
    treat.sprite.visible = true;
    treat.flyT = 0;
    treat.holdT = 0;
    b.treats++;
    api.toast(`${emoji} ${label} FROM ${entry.name}!`);
    MT.sfx.kit('coin', 6);
  }

  function updateTreat(dt) {
    const hero = MT.hero;
    if (treat.flyT >= 0) {
      // arc from his hand into your left hand (the one on the jar's side: you face the camera)
      treat.flyT += dt / 0.7;
      hero.root.updateMatrixWorld(true);
      Kit.people.handWorld(hero.person, -1, treat.to);
      treat.to.z += 0.5;
      const k = Math.min(1, treat.flyT);
      treat.sprite.position.lerpVectors(treat.from, treat.to, k);
      treat.sprite.position.y += Math.sin(k * Math.PI) * 3;
      treat.sprite.material.rotation = k * Math.PI * 2;
      if (k >= 1) {
        treat.flyT = -1;
        treat.holdT = 9;
        treat.sprite.material.rotation = 0;
        hero.person.armL.add(treat.sprite);
        treat.sprite.position.set(0, -0.82, -0.3); // camera side of the hand
        treat.sprite.scale.setScalar(0.9);
        hero.react('cheer');
      }
    } else if (treat.holdT > 0) {
      treat.holdT -= dt;
      if (treat.holdT <= 0) dropTreat();
    }
  }

  function dropTreat() {
    treat.flyT = -1;
    treat.holdT = 0;
    treat.sprite.visible = false;
    if (treat.sprite.parent) treat.sprite.parent.remove(treat.sprite);
  }

  // ---------------------------------------------------------------- the visit

  function update(dt) {
    updateTreat(dt);
    updateNoms(dt);
    if (!b.on) return;
    b.t += dt;
    b.shakeT = Math.max(0, b.shakeT - dt);
    const t = b.t, s = actor.scale, leaving = t >= V.guardUntil;
    const target = leaving ? offX : actor.home.x;
    const step = 7.5 * s * dt; // running speed
    b.x += Math.max(-step, Math.min(step, target - b.x));
    const running = Math.abs(target - b.x) > 0.02 * s;
    actor.root.position.x = b.x;
    if (running) {
      actor.face = target < b.x ? Math.PI / 2 : -Math.PI / 2; // face where he's running
      actor.act('run', 0.2, 0, true);
    } else {
      actor.face = null;
      if (!leaving && b.shakeT <= 0) {
        if (!b.said && t > V.hello) {
          b.said = true;
          actor.react('hello');
        }
        if (b.gobbled < V.gobble.length && t > V.gobble[b.gobbled]) {
          b.gobbled++;
          gobbleOne();
        }
        if (!b.given && t > V.giveAt) actor.act('give', 0.6, 0, true);
        if (!b.given && t > V.throwAt) {
          b.given = true;
          giveTreat();
        }
        if (b.queued && b.given && t > V.throwAt + 1.2) again();
        if (!b.bye && t > V.byeAt) {
          b.bye = true;
          actor.react('goodbye');
        }
      }
    }
    if (leaving && !running) dismiss();
    // look at the jar
    actor.update(dt, b.shakeT > 0 || noms.length ? 0.2 : 0.45);
  }

  MT.buddy = {
    init, setFor, place, call, summon, dismiss, leave, update, dropTreat, guarding, canSave, shake,
    get entry() { return entry; },
    get actor() { return actor; },
    get on() { return b.on; },
    get t() { return b.t; },
    get given() { return b.given; },
    get gobbled() { return b.gobbled; },
    get saveReady() { return guarding() && !b.saveUsed; },
    get holding() { return treat.holdT > 0 || treat.flyT >= 0; },
    get treats() { return b.treats; },
    // 1 → 0 over the guarding time, for the HUD bar
    get guardLeft() { return guarding() ? 1 - b.t / V.guardUntil : 0; },
    GUARD_UNTIL: V.guardUntil,
  };
})();
