/* Merge Teddy — effects. Two layers:
   - MT.fx.makeOverlay(canvas): a 2D canvas over the game for juice drops, rings, floating words (+15, NOM!,
     COMBO x3) and confetti, all in screen pixels;
   - MT.fx.makeFlyers(scene): emoji sprites in the 3D scene that float up and fade (💥, ✌️, ⭐), for the
     characters' celebrations. */
(function () {
  'use strict';
  const T = THREE;
  const MT = (window.MT = window.MT || {});
  const Kit = window.Kit;
  const { rand, FONT } = Kit.gfx;
  const CONFETTI = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957', '#ff9a1f', '#b388ff', '#ffffff'];

  function makeOverlay(canvas) {
    const g = canvas.getContext('2d');
    const drops = [], rings = [], words = [], bits = [];
    let w = 1, h = 1, dpr = 1;
    return {
      resize(W, H, DPR) {
        w = W;
        h = H;
        dpr = DPR;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
      },
      // juice: n drops in `color` flying out from (x, y), `size` px across, `speed` px/s
      burst(x, y, color, n, speed, size) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), v = speed * rand(0.35, 1);
          drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.35, r: size * rand(0.35, 1), color, t: 0, life: rand(0.45, 0.8) });
        }
      },
      ring(x, y, color, r) {
        rings.push({ x, y, color, r, t: 0, life: 0.4 });
      },
      // a word that pops up and floats away: opts { color, size, life, rise, stroke }
      text(str, x, y, o = {}) {
        words.push({ str, x, y, t: 0, color: o.color || '#ffd400', size: o.size || 30, life: o.life || 0.9, rise: o.rise != null ? o.rise : 60, rot: o.rot != null ? o.rot : rand(-0.12, 0.12) });
      },
      // confetti: n pieces from the top of the screen, or bursting from (x, y) when given
      confetti(n, x, y) {
        for (let i = 0; i < n; i++) {
          const burst = x !== undefined;
          const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(250, 750);
          bits.push({
            x: burst ? x : rand(0, w), y: burst ? y : rand(-h * 0.3, -10),
            vx: burst ? Math.cos(a) * v : rand(-40, 40), vy: burst ? Math.sin(a) * v : rand(60, 200),
            s: rand(7, 13), rot: rand(0, 6), vr: rand(-9, 9), flip: rand(0, 6), color: CONFETTI[i % CONFETTI.length], t: 0, life: rand(2.2, 3.6),
          });
        }
      },
      get busy() { return drops.length + rings.length + words.length + bits.length; },
      clear() {
        drops.length = rings.length = words.length = bits.length = 0;
      },
      update(dt) {
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.t += dt;
          d.vy += 900 * dt;
          d.vx *= 1 - 1.5 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.t > d.life) drops.splice(i, 1);
        }
        for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > rings[i].life) rings.splice(i, 1);
        for (let i = words.length - 1; i >= 0; i--) if ((words[i].t += dt) > words[i].life) words.splice(i, 1);
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i];
          b.t += dt;
          b.vy += 420 * dt;
          b.vx *= 1 - 1.8 * dt;
          b.vy *= 1 - 1.8 * dt; // air: they flutter down slowly
          b.x += (b.vx + Math.sin(b.t * 4 + b.flip) * 40) * dt;
          b.y += b.vy * dt;
          b.rot += b.vr * dt;
          if (b.t > b.life || b.y > h + 30) bits.splice(i, 1);
        }
      },
      draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        for (const r of rings) {
          const k = r.t / r.life;
          g.globalAlpha = (1 - k) * 0.9;
          g.lineWidth = 6 * (1 - k) + 1;
          g.strokeStyle = r.color;
          g.beginPath();
          g.arc(r.x, r.y, r.r * (0.5 + k * 0.9), 0, Math.PI * 2);
          g.stroke();
        }
        for (const d of drops) {
          const k = d.t / d.life;
          g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
          g.fillStyle = d.color;
          g.beginPath();
          g.arc(d.x, d.y, d.r * (1 - k * 0.4), 0, Math.PI * 2);
          g.fill();
        }
        for (const b of bits) {
          g.globalAlpha = b.t > b.life - 0.5 ? Math.max(0, (b.life - b.t) / 0.5) : 1;
          g.save();
          g.translate(b.x, b.y);
          g.rotate(b.rot);
          g.scale(1, Math.cos(b.t * 6 + b.flip));
          g.fillStyle = b.color;
          g.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66);
          g.restore();
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        for (const wd of words) {
          const k = wd.t / wd.life;
          const pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - ((k - 0.15) / 0.1) * 0.2 : 1;
          g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          g.save();
          g.translate(wd.x, wd.y - wd.rise * k);
          g.rotate(wd.rot);
          g.scale(pop, pop);
          g.font = `${wd.size}px ${FONT}`;
          g.lineWidth = Math.max(4, wd.size * 0.2);
          const str = Kit.lang ? Kit.lang.t(wd.str) : wd.str; // NOM!, WHEE!, COMBO ×3 in 中文 too
          g.strokeStyle = '#14121f';
          g.strokeText(str, 0, 0);
          g.fillStyle = wd.color;
          g.fillText(str, 0, 0);
          g.restore();
        }
        g.globalAlpha = 1;
      },
    };
  }

  function makeFlyers(scene) {
    const list = [];
    return {
      add(emoji, x, y, z, vx, vy, size, life, spin = 0, grav = 0.3) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture(emoji), transparent: true, depthWrite: false }));
        sp.position.set(x, y, z);
        sp.scale.set(size, size, 1);
        sp.renderOrder = 8;
        scene.add(sp);
        list.push({ sp, vx, vy, t: 0, life, size, spin, grav });
      },
      update(dt, g) {
        for (let i = list.length - 1; i >= 0; i--) {
          const f = list[i];
          f.t += dt;
          if (f.t >= f.life) {
            scene.remove(f.sp);
            f.sp.material.dispose();
            list.splice(i, 1);
            continue;
          }
          f.vy -= g * f.grav * dt;
          f.sp.position.x += f.vx * dt;
          f.sp.position.y += f.vy * dt;
          f.sp.material.rotation += f.spin * dt;
          const k = f.t / f.life;
          f.sp.material.opacity = k > 0.6 ? (1 - k) / 0.4 : 1;
          const s = f.size * (k < 0.15 ? 0.4 + k * 4 : 1);
          f.sp.scale.set(s, s, 1);
        }
      },
      clear() {
        list.forEach((f) => {
          scene.remove(f.sp);
          f.sp.material.dispose();
        });
        list.length = 0;
      },
    };
  }

  MT.fx = { makeOverlay, makeFlyers };
})();
