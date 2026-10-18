/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "WaTTermelon",
  keys: [
    ["aim", "← → or A D"],
    ["drop the fruit", "Space Enter or ↓"],
    ["call your brother", "T"],
    ["pause", "P or Esc"],
    ["sound on / off", "M"],
  ],
  touch: "Slide a finger to aim and lift it to drop, or move the mouse and click. Tap your brother's face (bottom right) to call him.",
});
