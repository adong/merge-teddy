/* 中文 for WaTTermelon: the words on the page, the toasts, the banner, the ? panel and the words that pop up over
   the jar (NOM!, WHEE!, COMBO ×3, drawn on a canvas through Kit.lang.t in js/fx.js). Kit.lang is kit/lang.js.
   The kids' names, the other characters' names and the game's name and logo (which Alan picked) stay in English. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'WaTTermelon', 'Claude Code', 'Esc']);

  const FRUIT = {
    CHERRY: '樱桃', STRAWBERRY: '草莓', GRAPE: '葡萄', ORANGE: '橙子', APPLE: '苹果',
    PEAR: '梨', PEACH: '桃子', PINEAPPLE: '菠萝', MELON: '哈密瓜', WATERMELON: '西瓜',
  };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add(FRUIT); // the fruit chain's tooltips, and the biggest fruit on the results card
  L.add({
    // title screen
    'Drop the fruit in the jar. Two the same make a bigger one. Can you grow a watermelon?': '把水果丢进罐子里，两个一样的会变成更大的。你能变出大西瓜吗？',
    'Drop the fruit in the jar. Two the same make a bigger one. Can you grow a watermelon? 🍉': '把水果丢进罐子里，两个一样的会变成更大的。你能变出大西瓜吗？🍉',
    'PICK YOUR PLAYER': '选一个人来玩', 'Pick your player': '选一个人来玩', 'ZOMBIE': '僵尸',
    'BUDDY · TAP ME!': '点我帮忙', 'Call your buddy (T)': '叫兄弟来帮忙 (T)',
    '🖱️ move to aim, click to drop': '🖱️ 移动鼠标瞄准，点一下放下', 'aim': '瞄准', 'drop': '放下', 'call': '叫', 'sound': '声音',
    '👆 slide your finger to aim, lift it to drop': '👆 手指滑动瞄准，松开就放下',
    "'S BEST": ' 的最高分',
    // the HUD
    'NEXT': '下一个', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'Your buddy is here to help': '兄弟来帮忙啦', "He'll save you once": '他能救你一次',
    'Call Tommy (T)': '叫 Tommy 来帮忙 (T)', 'Call Teddy (T)': '叫 Teddy 来帮忙 (T)',
    // pause and the results
    '🏠 MENU': '🏠 菜单', 'P · Esc · Space': 'P · Esc · 空格',
    'GREAT JOB!': '真棒！', 'WATERMELON HERO!': '西瓜小英雄！', 'AMAZING!': '太厉害了！', 'NICE ONE!': '不错哦！',
    'BIGGEST FRUIT': '最大的水果', 'MERGES': '合成次数', '★ NEW BEST! ★': '★ 新纪录！★',
    '↻ PLAY AGAIN': '↻ 再玩一次', '🧒 CHANGE PLAYER': '🧒 换个人玩', 'Space · Enter': '空格 · 回车',
    // toasts and the banner
    'ALMOST FULL!': '快满啦！', '🍉 WATERMELON! 🍉': '🍉 大西瓜！🍉', 'MEGA MELON!': '超级大西瓜！',
    // words that pop up over the jar (canvas)
    'NOM!': '啊呜！', 'WHEE!': '飞咯！', 'SWISH!': '唰！进球！',
    // loading
    'LOADING…': '加载中…', 'This browser can’t run WebGL, so the game can’t start.': '这个浏览器跑不了 WebGL，游戏开不了。',
    // the ? panel (js/keys.js)
    'drop the fruit': '放下水果',
    "Slide a finger to aim and lift it to drop, or move the mouse and click. Tap your brother's face (bottom right) to call him.":
      '手指滑动瞄准，松开就放下；也可以移动鼠标再点一下。点右下角兄弟的头像，叫他来帮忙。',
  });

  L.rule(/^(.+)'S BEST$/, '$1 的最高分');
  L.rule(/^BEST (\d+)$/, '最高分 $1');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^NEW! (\S+) ([A-Z]+)$/, (m, emoji, name) => `新水果！${emoji} ${FRUIT[name] || name}`);
  L.rule(/^COMBO ×(\d+)$/, '连击 ×$1');
})();
