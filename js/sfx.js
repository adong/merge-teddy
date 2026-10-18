/* Merge Teddy — sound. Kit.sound plays the shared effects (coin, powerup, punch, swish, click) and the music;
   the jar's own sounds below are built from its tone() and hiss(), so they share its mixer and mute. Every call is
   a silent no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const MT = (window.MT = window.MT || {});
  const S = () => window.Kit && Kit.sound;
  const tone = (o) => S() && S().tone(o);
  const hiss = (o) => S() && S().hiss(o);
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

  MT.sfx = {
    init() { if (S()) S().init(); },
    // any shared kit effect by name: MT.sfx.kit('powerup')
    kit(name, ...args) {
      const s = S();
      if (s && typeof s[name] === 'function') s[name](...args);
    },
    music(mode) { if (S()) S().music(mode); },
    toggleMute() { return S() ? S().toggleMute() : true; },
    isMuted() { return S() ? S().isMuted() : true; },
    suspend() { if (S()) S().suspend(); },
    resume() { if (S()) S().resume(); },

    // letting go of a fruit: a soft little "plip"
    drop() {
      tone({ type: 'triangle', f: 700, to: 420, dur: 0.07, vol: 0.1 });
    },
    // a fruit landing: a soft thump, deeper and louder for big fruit
    thud(level) {
      const k = level / 9;
      tone({ f: 210 - k * 120, to: 70 - k * 25, dur: 0.12 + k * 0.08, vol: 0.08 + k * 0.14 });
    },
    // a merge: a juicy "pop-bloop", lower for bigger fruit, with a note that climbs with the chain
    merge(level, combo) {
      const base = 1150 / (1 + level * 0.16);
      tone({ f: base, to: base * 2.1, dur: 0.08, vol: 0.22 });
      hiss({ filter: 'highpass', f: 3500, to: 7000, dur: 0.05, vol: 0.12 });
      tone({ type: 'triangle', f: base * 0.55, to: base * 1.15, dur: 0.16, vol: 0.18, at: 0.04 });
      hiss({ filter: 'lowpass', f: 1400, to: 300, dur: 0.14, vol: 0.12, at: 0.02 }); // the juice
      if (combo > 1) tone({ type: 'square', f: NOTES[Math.min(combo, NOTES.length - 1)], dur: 0.12, vol: 0.05, lp: 3500, at: 0.08 });
    },
    // a brand-new kind of fruit in this game: a sparkly two-note chime
    discover() {
      tone({ type: 'triangle', f: 1319, dur: 0.12, vol: 0.12, at: 0.12 });
      tone({ type: 'triangle', f: 1976, dur: 0.3, vol: 0.12, at: 0.22 });
    },
    // a watermelon! a little fanfare with a cheer
    fanfare() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'square', f, dur: i === 5 ? 0.5 : 0.13, vol: 0.07, lp: 3200, at: i * 0.11 }));
      [262, 330, 392].forEach((f) => tone({ type: 'triangle', f, dur: 0.9, vol: 0.08, at: 0.55 }));
      hiss({ filter: 'bandpass', f: 1800, q: 0.6, dur: 1.0, vol: 0.1, attack: 0.15, at: 0.45 });
    },
    // the buddy gobbling a fruit: "nom nom"
    nom() {
      tone({ type: 'square', f: 260, to: 190, dur: 0.07, vol: 0.09, lp: 1100 });
      tone({ type: 'square', f: 300, to: 210, dur: 0.08, vol: 0.09, lp: 1100, at: 0.13 });
    },
    // the jar is nearly full: a gentle "uh-oh"
    warn() {
      tone({ type: 'triangle', f: 660, dur: 0.16, vol: 0.12 });
      tone({ type: 'triangle', f: 494, dur: 0.26, vol: 0.12, at: 0.18 });
    },
    // ...and it's fine again
    calm() {
      tone({ type: 'triangle', f: 494, dur: 0.12, vol: 0.1 });
      tone({ type: 'triangle', f: 740, dur: 0.2, vol: 0.1, at: 0.13 });
    },
    // the buddy shaking the jar: a glassy rattle
    shake() {
      for (let i = 0; i < 8; i++) {
        hiss({ filter: 'bandpass', f: 2400 + (i % 2) * 900, q: 3, dur: 0.06, vol: 0.12, at: i * 0.09 });
        tone({ type: 'triangle', f: 1800 + (i % 3) * 300, dur: 0.05, vol: 0.04, at: i * 0.09 + 0.02 });
      }
    },
    // a fruit flying out of the jar
    whee() {
      tone({ f: 420, to: 1300, dur: 0.32, vol: 0.12 });
    },
    // game over: soft and friendly, going down
    over() {
      [784, 659, 523, 392].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.28, vol: 0.13, at: i * 0.17 }));
    },
    // the last fruit popping at the end of a game
    plink(i) {
      tone({ f: 900 + (i % 6) * 120, to: 1600 + (i % 6) * 120, dur: 0.06, vol: 0.08 });
    },
  };
})();
