# WaTTermelon (working title)

[![WaTTermelon title screen](docs/screenshot.jpg)](https://adong.github.io/merge-teddy/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

A fruit-merging jar game starring Teddy and Tommy, in the style of 合成大西瓜 (the "make a big watermelon" game). Drop fruit into a glass jar; two of the same that touch squish together into the next one up, all the way to a watermelon. It's built with Claude Code from plain JavaScript and Three.js, in the same style as Metro Surfer and FruiTTy Kids.
There are no image, model or audio files: the fruit are painted on canvases, the jar and the orchard are drawn in code, the characters come from the shared kit (`kit/`), and every sound is synthesised.

The name lives in one place, `js/title.js` (`MT.TITLE`), so it's easy to rename.

## Play

- **Double-click `index.html`.** It works offline, because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/merge-teddy.html` is the whole game in one file. AirDrop or email it, then open it in a browser.
- **Rebuild that file** after any edit: `python3 kit/tools/bundle.py . --name merge-teddy`
- **Get kit updates** (new poses, characters or sounds) from `~/claude-games/kit`: `python3 ../kit/tools/sync.py .`, then rebuild.
- **Check the jar's physics and rules** without a browser: `node tools/check.js`
- Best scores and the chosen player are saved per browser, one best score per character.

| Mouse | Touch | Keys | |
|---|---|---|---|
| move over the jar | slide a finger | ← → (or A D) | aim |
| click | lift your finger | Space, Enter or ↓ | drop the fruit |
| buddy button (bottom right) or his title card | same | T | call your buddy |
| click a card | tap a card | ← → on the title screen | pick your player |
| ▶ PLAY | ▶ PLAY | Space / Enter | start, or play again |
| ❚❚ button | ❚❚ button | P / Esc | pause |
| 🔊 button | 🔊 button | M | sound on/off |

## How it plays

- **The chain:** cherry → strawberry → grape → orange → apple → pear → peach → pineapple → melon → watermelon. You're handed the five smallest (smaller ones more often), and the NEXT bubble shows what's coming. The strip at the top of the screen shows the whole chain, and lights up each fruit once you've made it.
- **Merging:** two of the same that touch pop into the next size up, with a juicy splash, a squish and points: a cherry pair is +1, then +3, +6, +10, +15, +21, +28, +36, and a melon pair making a watermelon is +45. If two watermelons ever meet, both pop for +100: MEGA MELON! Merges that follow each other quickly show as a COMBO.
- **New fruit:** the first pear, peach, pineapple and melon of a game get a "NEW!" toast and a chime.
- **The line:** a dashed line near the top of the jar. A fruit that has settled above it makes the line glow pink. After 0.7 s a gentle "ALMOST FULL!" warning plays and your character puts his hands on his cheeks. If it's still over after 3.2 s, the game ends: the fruit pop one by one and your character keeps celebrating on the results screen. A fruit that's still falling never counts.
- **The characters:** your player stands beside the jar (in portrait, in front of the table the jar stands on), watches where you aim, and hops when you drop. Merging into an apple makes him cheer; a peach or bigger, or a chain of 4, gets his **signature move**:
  - **TEDDY** takes turns with a Mike Tyson-style boxing combo (jab, straight, with a 💥 at each punch) and a basketball jump shot through a hoop that pops up beside him ("SWISH!").
  - **TOMMY** does his Y pose (比耶): both arms up with peace fingers and ✌️ floating up.
  - **ZOOM, LUNA, BOLT, BRUNO and the ZOMBIE** wave (the zombie's arms reach out, as zombies' do).
- **A watermelon** gets the big party: a white flash, confetti from the sky and from the fruit, a "🍉 WATERMELON! 🍉" banner, a fanfare, and two signature moves in a row. The buddy celebrates too, if he's there.

## Your buddy

Tap the big buddy button (bottom right, with his face on it), press **T**, or tap his dashed **BUDDY · TAP ME!** card on the title screen, and the other brother comes to help. It's Tommy for everyone, and Teddy when Tommy is playing (`Kit.roster.buddyFor`). A visit lasts about 10 s:

- He runs in from the right, wearing a name tag, and says hi with his signature move (Tommy's Y, or Teddy's boxing).
- He **gobbles the three smallest fruit** in the jar, one at a time: each one flies out of the jar into his mouth, "NOM!".
- He **hands you a treat** (🍦 💧 🧃 🍪 🍉 🍌, with a toast like "🍦 ICE CREAM FROM TOMMY!"). It arcs over into your hand and you hold it for a while.
- **He has your back:** while he's there, a game over is prevented once. When the jar would end the game, he grabs it and shakes it instead: the jar rocks, the fruit poking over the line hop out ("WHEE!"), the rest jiggle down, and "TOMMY SAVED YOU!" (or "TEDDY SAVED YOU!") pops up. While he's guarding, his button glows and a bar with his face under the score shows the time left; the 🛡️ next to it fades once the save is used.
- He says bye with his goodbye move (Tommy's Y, or Teddy's jump shot) and runs off.
- Call him as often as you like. Once he's handed over his treat, another call makes him say hi again: three more nibbles, another treat, another save. A call before that is remembered, and he says hi again right after the treat.

## Testing from the browser console

`window.game` drives the game without a mouse. That's how it was checked in the Browser pane, where `requestAnimationFrame` is throttled while the pane is hidden:

```js
game.autoPause = false; game.hold(true)  // stop the live loop; only step() moves time
game.start('tommy')                       // start a game as Tommy
game.drop(1.5)                            // drop the current fruit at jar x = 1.5 (the jar runs from -3 to 3)
game.step(2)                              // advance 2 s of game time, drawing every frame
game.info()                               // score, fruit count, biggest fruit, danger time, layout, pose
game.place(8, -1.43, 5)                   // put a fruit anywhere: 0 = cherry .. 9 = watermelon
game.overfill()                           // pile fruit past the line (try the warning, the save, the game over)
game.buddy(); game.buddyInfo()            // call the buddy, like T; then see his visit
game.celebrate()                          // the watermelon party
```

What was checked in the Browser pane: both pairings (Teddy calling Tommy, Tommy calling Teddy), in landscape (1280 × 800), iPad-ish portrait and phone portrait (375 × 812). The buddy gobbled three fruit, handed over a treat, saved one overfilled jar with a shake (the over-the-line fruit flew out), and the next overfill after he left ended the game. Touch, mouse and keyboard were checked with synthetic events: a finger aims while it's down and drops where it lifts; a mouse aims on hover and drops on click; the arrows aim and Space drops; T, P and M work.

## The physics

`js/physics.js` is a small 2D circle solver written for this game (no library). It's position-based with small steps: every 1/60 s frame is split into 8 substeps, each of which moves the fruit, pushes overlapping circles apart (heavier fruit move less) with friction, and reads the velocity back from how far each one moved. Three extras keep it calm for little players:

- An overlap that was already there (a merged fruit growing into its neighbours) is pushed out without turning into a launch: the speed a push can leave behind is capped, except for the small bounce of a hard landing, and the pushes alone can never speed a fruit past 7 units/s (only gravity can).
- A merged fruit pops in at 60 % of its old size and grows smoothly over 0.2 s, a little every substep.
- A fruit that stays in one spot for half a second goes to sleep until something bumps it, a fruit near it leaves the jar, or the jar is shaken. Without that, a small fruit pinched between two big ones would slowly ooze out forever.

`node tools/check.js` loads the solver and the jar rules in node and checks:

- every level merges into the next with the right points, and two watermelons pop for +100;
- a cherry dropped on a column of orange, grape, strawberry and cherry chains all the way to an apple (combo ×4, 20 points);
- the warning comes first, the buddy's save works once, and the next time it's game over;
- 200 drops by a simple bot: no NaN, nothing launched faster than a free fall from the top, the pile always comes fully to rest (checked every 25 drops), nothing creeps afterwards, a settled pile shows no overlap, overlaps while fruit land or pop in stay small, and everything stays inside the jar. It also prints the solver's time per frame (well under 1 ms).

It passed with the built-in seed and with five other seeds.

## Files

```
index.html       page, HUD and screens (CSS inline)
js/title.js      the game's name (MT.TITLE), in one place
js/physics.js    the 2D circle solver (no Three.js, runs in node too)
js/jar.js        the jar's rules: the ten fruit, drops, merges, points, the line, the buddy's gobble and shake (runs in node too)
js/sfx.js        drop, thud, merge pop, chime, fanfare, nom, warning, rattle, built on Kit.sound.tone / hiss
js/fruits.js     the fruit pictures: painted bodies with faces, and the shading layer that doesn't turn
js/fx.js         juice drops, rings, floating words and confetti on a 2D overlay; emoji sprites for the characters
js/hero.js       MT.makeActor: a character beside the jar, with reactions, signature moves and Teddy's ball and hoop; MT.hero is you
js/buddy.js      the buddy: his visit, gobbling, treat and the jar-shake save
js/game.js       the scene, the jar, layout (landscape and portrait), input, events, HUD, main loop, window.game
js/zh.js         中文 for every word the player sees (Kit.lang): page text, toasts, the ? panel, NOM! / WHEE! / COMBO
tools/check.js   the headless physics and rules check (node)
kit/             copy of ~/claude-games/kit (Three.js r149, people, roster, portraits, sound, bundler); edit the kit there, not here
dist/merge-teddy.html  the single-file build
```

## Kit candidates

These live in this game for now. Move them into `~/claude-games/kit` if another game wants them:

- **More poses** (`MT.pose` in `js/hero.js`): `worry` (hands on cheeks, head wobbling), `nom` (hands to the mouth, chewing), `shake` (both hands forward, rocking something), `cheer` (both arms straight up), plus the standing-leg damping for `peace` / `wave` that FruiTTy Kids also uses.
- **A character beside something** (`MT.makeActor` in `js/hero.js`): like FruiTTy Kids' chef, but placed at any spot, size and side, with the hoop popping up on the side he faces.
- **The 2D circle solver** (`js/physics.js`): any game that needs stacking balls, marbles or bubbles. It has no Three.js dependency.
- **Sounds** in `js/sfx.js`: `merge(level, combo)`, `thud(level)`, `fanfare`, `nom`, `warn` / `calm`, `shake`, `whee`.

## Not verified

- **Sound:** the effects and music run through Web Audio, but no one has listened to them yet.
- **Real touch devices:** phone and iPad layouts were checked in the browser's device emulation, and touch input with synthetic pointer events, but not with fingers on a real device or in iOS Safari.
- **Live animation timing:** the Browser pane throttles animation while it's hidden, so the game was stepped by hand (`game.step`). The CSS toasts and the watermelon banner only animate when the page draws frames, so the banner was photographed held at its on-screen pose.
