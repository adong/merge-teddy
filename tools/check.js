#!/usr/bin/env node
/* Headless check for the jar: merges chain correctly and the physics stays steady.
   Run from the game folder:  node tools/check.js
   It loads js/physics.js and js/jar.js (no browser, no Three.js) and exits non-zero if anything fails. */
'use strict';
const path = require('path');
require(path.join(__dirname, '../js/physics.js'));
require(path.join(__dirname, '../js/jar.js'));
const MT = globalThis.MT, FR = MT.FRUITS, J = MT.JAR;

let failed = 0;
function ok(cond, msg) {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}`);
  if (!cond) failed++;
}
// a seeded random, so a failure can be replayed
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const run = (jar, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) jar.update(1 / 60); };
const levels = (jar) => jar.fruits.map((b) => b.level).sort((a, b) => a - b);

console.log('merges, one level at a time');
for (let L = 0; L < FR.length - 1; L++) {
  const jar = MT.makeJar({ random: lcg(1) }), r = FR[L].r;
  jar.place(L, -r - 0.004, r);
  jar.place(L, r + 0.004, r);
  run(jar, 1);
  const got = levels(jar);
  ok(got.length === 1 && got[0] === L + 1 && jar.score === MT.mergePoints(L),
    `two ${FR[L].id.padEnd(10)} -> ${FR[L + 1].id.padEnd(10)} (+${MT.mergePoints(L)})  got [${got.map((l) => FR[l].id)}] score ${jar.score}`);
}
{
  const jar = MT.makeJar({ random: lcg(2) }), r = FR[9].r;
  jar.place(9, 0, r);
  jar.place(9, 0.05, 3 * r + 0.004);
  run(jar, 1);
  const mega = jar.events.filter((e) => e.type === 'megamelon').length;
  ok(jar.fruits.length === 0 && jar.score === MT.MEGA_POINTS && mega === 1, `two watermelons pop (+${MT.MEGA_POINTS}): ${jar.fruits.length} left, score ${jar.score}`);
}

console.log('a chain reaction');
{
  // a column: orange, grape, strawberry, cherry; dropping a cherry on top should climb all the way to an apple
  const jar = MT.makeJar({ random: lcg(3) });
  let y = 0;
  for (const L of [3, 2, 1, 0]) {
    y += FR[L].r;
    jar.place(L, 0, y);
    y += FR[L].r + 0.002;
  }
  jar.drop(0, 0);
  run(jar, 3);
  const merges = jar.events.filter((e) => e.type === 'merge');
  ok(levels(jar).join() === '4', `cherry dropped on the column -> [${levels(jar).map((l) => FR[l].id)}]`);
  ok(merges.map((e) => e.level).join() === '1,2,3,4', `merges in order: ${merges.map((e) => FR[e.level].id).join(' -> ')}`);
  ok(Math.max(...merges.map((e) => e.combo)) === 4 && jar.score === 1 + 3 + 6 + 10, `combo x${Math.max(...merges.map((e) => e.combo))}, score ${jar.score}`);
}

console.log('the line, the warning, the buddy\'s save');
{
  const jar = MT.makeJar({ random: lcg(4) });
  // a fruit pinned above the line (frozen, so the rule is tested without waiting on physics)
  const pin = () => { const b = jar.place(4, 0, J.LINE + 0.3); b.frozen = true; };
  pin();
  let saves = 0;
  jar.guard = () => saves++ === 0; // the buddy saves once
  const seen = [];
  for (let t = 0; t < 20 && !jar.over; t += 1 / 60) {
    jar.update(1 / 60);
    for (const e of jar.events.splice(0)) {
      seen.push(`${e.type}@${jar.time.toFixed(1)}s`);
      if (e.type === 'save') {
        seen[seen.length - 1] += ` (${e.popped.length} hopped out)`;
        pin(); // and another one sticks up
      }
    }
  }
  ok(seen.some((s) => s.startsWith('warn')), `warning first (${seen.filter((s) => !s.startsWith('merge')).join(', ')})`);
  ok(seen.filter((s) => s.startsWith('save')).length === 1 && jar.over, 'saved once, then game over');
}

console.log('200 drops');
{
  const rand = lcg(20261017), jar = MT.makeJar({ random: rand });
  let saves = 0;
  jar.guard = () => { saves++; return true; }; // keep going: the test is about the physics, not winning
  // the fastest anything can honestly go: falling from the drop height to the floor
  // (plus the landing bounce, which a small fruit hit by a falling big one can pick up)
  const FALL = (Math.sqrt(2 * jar.world.gravity * J.DROP_Y) + 1.5) * (1 + jar.world.bounce);
  let fastest = 0, worstAny = 0, worstSettled = 0, maxBodies = 0, nan = false, frameMs = 0, worstFrameMs = 0, frames = 0;
  let restWorst = 0, creepWorst = 0, rests = 0;
  const made = new Array(FR.length + 1).fill(0);
  const frame = () => {
    const t0 = process.hrtime.bigint();
    jar.update(1 / 60);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    frameMs += ms;
    worstFrameMs = Math.max(worstFrameMs, ms);
    frames++;
    for (const e of jar.events.splice(0)) {
      if (e.type === 'merge') made[e.level]++;
      if (e.type === 'megamelon') made[FR.length]++;
    }
    maxBodies = Math.max(maxBodies, jar.fruits.length);
    for (const b of jar.fruits) {
      if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) nan = true;
      fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
    }
    // Overlap after solving (a fruit born this frame, from a merge, hasn't been through the solver yet). While a
    // merged fruit grows in or a drop lands, the pile gets shoved and a small fruit can be pinned for a moment;
    // a settled pile (nothing dropped or merged for half a second) should show no overlap at all.
    if (!jar.fruits.some((b) => jar.time - b.born < 1 / 60 + 1e-9)) {
      const o = jar.world.maxOverlap(), lastDrop = Math.max(...jar.fruits.filter((b) => b.dropped).map((b) => b.born), -9);
      worstAny = Math.max(worstAny, o);
      if (jar.time - jar.lastMerge > 0.5 && jar.time - lastDrop > 0.5 && jar.calmFor <= 0) worstSettled = Math.max(worstSettled, o);
    }
  };
  for (let d = 0; d < 200; d++) {
    // a simple player: aim at the topmost fruit that matches, else somewhere random
    const level = jar.randomLevel(), r = FR[level].r;
    const match = jar.fruits.filter((b) => b.level === level).sort((a, b) => b.y - a.y)[0];
    const x = match && rand() < 0.7 ? match.x + (rand() - 0.5) * 0.2 : (rand() - 0.5) * (J.W - 2 * r);
    jar.drop(x, level);
    for (let f = 0; f < 40; f++) frame();
    if (d % 25 === 24) {
      // every 25 drops: hands off for 4 s, then everything should be still, and stay put
      // (with the line switched off, so the buddy doesn't shake the jar in the middle of it)
      jar.calmFor = 6;
      for (let f = 0; f < 240; f++) frame();
      restWorst = Math.max(restWorst, ...jar.fruits.map((b) => Math.hypot(b.vx, b.vy)));
      const at = jar.fruits.map((b) => [b, b.x, b.y]), merges = jar.merges;
      for (let f = 0; f < 120; f++) frame();
      // (unless a late merge moved things on purpose)
      if (jar.merges === merges) {
        creepWorst = Math.max(creepWorst, ...at.map(([b, x, y]) => (b.dead ? 0 : Math.hypot(b.x - x, b.y - y))));
        rests++;
      }
    }
  }
  console.log(`       ${jar.drops} drops, ${jar.merges} merges, score ${jar.score}, ${jar.fruits.length} fruit left (max ${maxBodies}), ${saves} saves`);
  console.log(`       made: ${FR.slice(1).map((f, i) => `${f.emoji}${made[i + 1]}`).join(' ')}  megamelon ${made[FR.length]}`);
  console.log(`       solver: ${(frameMs / frames).toFixed(3)} ms per frame on average, worst ${worstFrameMs.toFixed(2)} ms`);
  ok(!nan, 'no NaN positions or speeds');
  ok(worstSettled < 0.02, `settled pile: worst overlap ${worstSettled.toFixed(4)} (< 0.02 jar units)`);
  ok(worstAny < 0.25, `while fruit land and pop in: worst overlap ${worstAny.toFixed(4)} (< 0.25, for a moment)`);
  ok(fastest < FALL, `no launches: fastest fruit ${fastest.toFixed(2)} units/s (a free fall from the top is ${FALL.toFixed(1)})`);
  ok(restWorst < 0.05, `comes to rest: fastest fruit after 4 s hands-off ${restWorst.toFixed(4)} units/s (< 0.05, ${rests} pauses)`);
  ok(creepWorst < 0.005, `no creeping: moved ${creepWorst.toFixed(5)} units in the next 2 s (< 0.005)`);
  ok(jar.fruits.every((b) => b.x - b.r >= J.W / -2 - 0.01 && b.x + b.r <= J.W / 2 + 0.01 && b.y - b.r >= -0.01), 'everything inside the jar');
  ok(jar.merges > 100 && made[5] > 0, `merges kept happening (${jar.merges}), reached at least a pear`);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
