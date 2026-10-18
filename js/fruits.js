/* Merge Teddy — the fruit pictures. Each of the ten fruit (MT.FRUITS, in jar.js) is painted once on a canvas:
   a round body in its colour with its own pattern (seeds, dimples, stripes, a net, a crosshatch), a stem or
   leaves poking out, and a happy little face. A shared shading layer (a soft highlight top-left, a darker rim)
   sits on top and doesn't turn when the fruit rolls, so the light always comes from the same side.
   The painted circle has radius 100 px on a 256 px canvas, so a plane 2.56 units wide scaled by the fruit's
   radius lines up exactly with its physics circle. */
(function () {
  'use strict';
  const T = THREE;
  const MT = (window.MT = window.MT || {});
  const Kit = window.Kit;
  const { shade } = Kit.gfx;
  const SIZE = 256, C = 128, R = 100;
  MT.FRUIT_PLANE = SIZE / R; // plane size per unit of radius

  // a little seeded random, so every fruit looks the same each time
  function seeded(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }

  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
  }

  function leaf(g, x, y, len, wid, ang, color) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -wid, len, 0);
    g.quadraticCurveTo(len * 0.5, wid, 0, 0);
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = shade(color, -0.45);
    g.stroke();
    g.beginPath();
    g.moveTo(len * 0.1, 0);
    g.lineTo(len * 0.8, 0);
    g.lineWidth = 2.5;
    g.strokeStyle = shade(color, -0.3);
    g.stroke();
    g.restore();
  }

  function stem(g, x0, y0, x1, y1, color, width) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 - 8, (y0 + y1) / 2, x1, y1);
    g.lineCap = 'round';
    g.lineWidth = width + 6;
    g.strokeStyle = shade(color, -0.5);
    g.stroke();
    g.lineWidth = width;
    g.strokeStyle = color;
    g.stroke();
  }

  // The face: shiny eyes, a smile and rosy cheeks. Big fruit get an open, laughing mouth.
  function face(g, big, sparkle) {
    const ey = 4, ex = 30;
    g.fillStyle = '#2a1a14';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(C + s * ex, C + ey, 10, 13, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      circle(g, C + s * ex - 3, C + ey - 5, 4.5);
      g.fill();
      circle(g, C + s * ex + 4, C + ey + 4, 2);
      g.fill();
    }
    if (sparkle) {
      g.fillStyle = '#fff6a8';
      for (const s of [-1, 1]) {
        const x = C + s * 58, y = C - 22;
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, rr = i % 2 ? 3 : 9;
          g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.fill();
      }
    }
    // cheeks
    g.fillStyle = 'rgba(255, 110, 140, 0.55)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(C + s * 50, C + 24, 13, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    // mouth
    g.lineCap = 'round';
    if (big) {
      g.beginPath();
      g.moveTo(C - 15, C + 24);
      g.quadraticCurveTo(C, C + 46, C + 15, C + 24);
      g.closePath();
      g.fillStyle = '#5a1a22';
      g.fill();
      g.beginPath();
      g.ellipse(C, C + 34, 7, 4, 0, 0, Math.PI * 2);
      g.fillStyle = '#ff7b8a';
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(C - 12, C + 24);
      g.quadraticCurveTo(C, C + 36, C + 12, C + 24);
      g.lineWidth = 5;
      g.strokeStyle = '#2a1a14';
      g.stroke();
    }
  }

  // Each fruit's own look, painted inside the clipped body circle (pattern) and outside it (stems, leaves).
  const PAINT = {
    cherry: {
      body(g) {},
      top(g) {
        stem(g, C + 2, C - 92, C + 26, C - 124, '#5f9e2f', 7);
        leaf(g, C + 22, C - 118, 40, 14, -0.25, '#6cc04a');
      },
    },
    strawberry: {
      body(g, rnd) {
        g.fillStyle = '#ffe680';
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 8; col++) {
            const x = C - 90 + col * 26 + (row % 2) * 13, y = C - 70 + row * 26;
            if ((x - C) ** 2 + (y - C) ** 2 > 88 * 88) continue;
            if (Math.abs(x - C) < 64 && y > C - 18 && y < C + 46) continue; // keep the face clear
            g.beginPath();
            g.ellipse(x + rnd() * 3, y, 3.2, 5, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      },
      top(g) {
        for (let i = 0; i < 6; i++) leaf(g, C, C - 88, 44, 13, -Math.PI / 2 + (i - 2.5) * 0.48, '#4caf3e');
        stem(g, C, C - 96, C + 6, C - 122, '#3e8f32', 6);
      },
    },
    grape: {
      body(g) {
        const light = 'rgba(255, 255, 255, 0.16)', dark = 'rgba(40, 0, 70, 0.25)';
        const spots = [[-58, -52], [0, -70], [58, -52], [-78, 6], [78, 6], [-56, 60], [0, 78], [56, 60]];
        for (const [x, y] of spots) {
          circle(g, C + x, C + y, 30);
          g.fillStyle = light;
          g.fill();
          g.lineWidth = 3;
          g.strokeStyle = dark;
          g.stroke();
        }
      },
      top(g) {
        stem(g, C, C - 94, C - 4, C - 124, '#7a5230', 7);
        leaf(g, C - 2, C - 112, 46, 16, 0.35, '#5fb64a');
      },
    },
    orange: {
      body(g, rnd) {
        g.fillStyle = 'rgba(160, 70, 0, 0.22)';
        for (let i = 0; i < 70; i++) {
          const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 92;
          circle(g, C + Math.cos(a) * d, C + Math.sin(a) * d, 2.2);
          g.fill();
        }
      },
      top(g) {
        circle(g, C, C - 96, 7);
        g.fillStyle = '#6b8f2a';
        g.fill();
        leaf(g, C + 2, C - 98, 42, 15, -0.55, '#4fae3c');
      },
    },
    apple: {
      body(g) {
        g.beginPath();
        g.ellipse(C, C - 92, 22, 9, 0, 0, Math.PI);
        g.fillStyle = 'rgba(40, 90, 10, 0.35)';
        g.fill();
        g.fillStyle = 'rgba(255, 240, 120, 0.18)';
        g.beginPath();
        g.ellipse(C + 40, C + 40, 46, 36, -0.5, 0, Math.PI * 2);
        g.fill();
      },
      top(g) {
        stem(g, C, C - 88, C + 6, C - 122, '#7a5230', 8);
        leaf(g, C + 6, C - 112, 46, 16, -0.3, '#3f9a33');
      },
    },
    pear: {
      body(g, rnd) {
        g.fillStyle = 'rgba(140, 100, 20, 0.28)';
        for (let i = 0; i < 40; i++) {
          const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 90;
          circle(g, C + Math.cos(a) * d, C + Math.sin(a) * d, 1.8 + rnd() * 1.5);
          g.fill();
        }
        g.fillStyle = 'rgba(150, 210, 60, 0.25)';
        g.beginPath();
        g.ellipse(C - 30, C - 50, 60, 40, 0.3, 0, Math.PI * 2);
        g.fill();
      },
      top(g) {
        stem(g, C - 2, C - 92, C - 10, C - 124, '#7a5230', 8);
        leaf(g, C - 8, C - 116, 44, 15, 0.4, '#5aa83c');
      },
    },
    peach: {
      body(g) {
        const grd = g.createLinearGradient(C - 100, C + 100, C + 100, C - 100);
        grd.addColorStop(0, 'rgba(255, 210, 120, 0.55)');
        grd.addColorStop(1, 'rgba(255, 90, 110, 0.35)');
        g.fillStyle = grd;
        g.fillRect(0, 0, SIZE, SIZE);
        g.beginPath();
        g.moveTo(C + 4, C - 98);
        g.bezierCurveTo(C + 52, C - 70, C + 58, C - 20, C + 42, C + 2);
        g.lineWidth = 5;
        g.strokeStyle = 'rgba(200, 70, 70, 0.45)';
        g.stroke();
      },
      top(g) {
        leaf(g, C + 2, C - 96, 48, 17, -0.45, '#4fae3c');
        leaf(g, C - 2, C - 96, 40, 14, -2.6, '#5fbf48');
      },
    },
    pineapple: {
      body(g) {
        g.strokeStyle = 'rgba(150, 80, 0, 0.5)';
        g.lineWidth = 4;
        for (let i = -6; i <= 6; i++) {
          g.beginPath();
          g.moveTo(C + i * 30 - 120, C - 120);
          g.lineTo(C + i * 30 + 120, C + 120);
          g.stroke();
          g.beginPath();
          g.moveTo(C + i * 30 + 120, C - 120);
          g.lineTo(C + i * 30 - 120, C + 120);
          g.stroke();
        }
        g.fillStyle = 'rgba(120, 60, 0, 0.55)';
        for (let i = -6; i <= 6; i++) {
          for (let j = -6; j <= 6; j++) {
            const x = C + i * 30, y = C + j * 30 + 15 * (i % 2 ? 1 : 0) - 15;
            if (Math.abs(x - C) < 62 && y > C - 18 && y < C + 46) continue;
            circle(g, x, y + 15, 3);
            g.fill();
          }
        }
      },
      top(g) {
        const greens = ['#2f8f3a', '#3faa45', '#4fbf50'];
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.34;
          leaf(g, C + (i - 3) * 6, C - 86, i === 3 ? 44 : 38, 9, a, greens[i % 3]);
        }
      },
    },
    melon: {
      body(g, rnd) {
        g.strokeStyle = 'rgba(255, 250, 215, 0.7)';
        g.lineWidth = 3.5;
        g.lineCap = 'round';
        for (let i = 0; i < 28; i++) {
          let x = C + (rnd() - 0.5) * 210, y = C + (rnd() - 0.5) * 210;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (rnd() - 0.5) * 50;
            y += (rnd() - 0.5) * 50;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      },
      top(g) {
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(C - 18, C - 108);
        g.lineTo(C + 18, C - 108);
        g.moveTo(C, C - 96);
        g.lineTo(C, C - 110);
        g.lineWidth = 12;
        g.strokeStyle = '#4a6a20';
        g.stroke();
        g.lineWidth = 6;
        g.strokeStyle = '#8fbf4a';
        g.stroke();
      },
    },
    watermelon: {
      body(g) {
        g.fillStyle = '#1b6a2e';
        for (let i = -4; i <= 4; i++) {
          g.beginPath();
          const x0 = C + i * 44;
          g.moveTo(x0, C - 110);
          for (let y = -110; y <= 110; y += 18) g.lineTo(x0 + (Math.abs((y / 18) % 2) === 1 ? 9 : -9) * (1 - Math.abs(i) * 0.08), C + y);
          for (let y = 110; y >= -110; y -= 18) g.lineTo(x0 + 12 + (Math.abs((y / 18) % 2) === 1 ? 9 : -9) * (1 - Math.abs(i) * 0.08), C + y);
          g.closePath();
          g.fill();
        }
        // a lighter patch behind the face so it reads on the stripes
        const grd = g.createRadialGradient(C, C + 18, 10, C, C + 18, 80);
        grd.addColorStop(0, 'rgba(120, 210, 120, 0.55)');
        grd.addColorStop(1, 'rgba(120, 210, 120, 0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, SIZE, SIZE);
      },
      top(g) {
        g.beginPath();
        g.moveTo(C, C - 96);
        g.bezierCurveTo(C + 4, C - 112, C + 20, C - 116, C + 16, C - 104);
        g.bezierCurveTo(C + 12, C - 96, C + 26, C - 98, C + 30, C - 110);
        g.lineCap = 'round';
        g.lineWidth = 9;
        g.strokeStyle = '#3a5a18';
        g.stroke();
        g.lineWidth = 4;
        g.strokeStyle = '#7fb33a';
        g.stroke();
      },
    },
  };

  function paintBody(f, i) {
    const [c, g] = Kit.gfx.makeCanvas(SIZE, SIZE);
    const p = PAINT[f.id], rnd = seeded(1234 + i * 77);
    // stems and leaves behind the body
    p.top(g);
    // body
    circle(g, C, C, R);
    g.fillStyle = f.color;
    g.fill();
    g.save();
    circle(g, C, C, R);
    g.clip();
    p.body(g, rnd);
    g.restore();
    // outline
    circle(g, C, C, R - 2.5);
    g.lineWidth = 6;
    g.strokeStyle = shade(f.color, -0.5);
    g.stroke();
    face(g, i >= 6, i === 9);
    return c;
  }

  // The light: a soft highlight top-left, a little shine, a darker rim bottom-right.
  function paintShade() {
    const [c, g] = Kit.gfx.makeCanvas(SIZE, SIZE);
    g.save();
    circle(g, C, C, R - 3);
    g.clip();
    let grd = g.createRadialGradient(C + 26, C + 30, R * 0.55, C, C, R * 1.05);
    grd.addColorStop(0, 'rgba(40, 10, 30, 0)');
    grd.addColorStop(1, 'rgba(40, 10, 30, 0.32)');
    g.fillStyle = grd;
    g.fillRect(0, 0, SIZE, SIZE);
    grd = g.createRadialGradient(C - 36, C - 40, 4, C - 36, C - 40, R * 0.75);
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = 'rgba(255, 255, 255, 0.75)';
    g.beginPath();
    g.ellipse(C - 46, C - 56, 17, 9, -0.7, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return c;
  }

  let bodyTex = [], shadeTex = null, geo = null, icons = [];

  MT.fruitArt = {
    init() {
      const shadeCanvas = paintShade();
      shadeTex = Kit.gfx.toTexture(shadeCanvas);
      geo = new T.PlaneGeometry(MT.FRUIT_PLANE, MT.FRUIT_PLANE);
      MT.FRUITS.forEach((f, i) => {
        const body = paintBody(f, i);
        bodyTex[i] = Kit.gfx.toTexture(body);
        // a small picture with the light baked in, for the HUD (next fruit, the chain)
        const [ic, ig] = Kit.gfx.makeCanvas(128, 128);
        ig.drawImage(body, 0, 0, 128, 128);
        ig.drawImage(shadeCanvas, 0, 0, 128, 128);
        icons[i] = ic.toDataURL();
      });
    },
    // A fruit to show: { group, body, light }. Scale group by the radius, turn body with the fruit's angle.
    make(level) {
      const group = new T.Group();
      const body = new T.Mesh(geo, new T.MeshBasicMaterial({ map: bodyTex[level], transparent: true, depthWrite: false }));
      const light = new T.Mesh(geo, new T.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false }));
      light.position.z = 0.002;
      group.add(body, light);
      return { group, body, light, level };
    },
    texture: (level) => bodyTex[level],
    icon: (level) => icons[level],
    dispose(f) {
      f.body.material.dispose();
      f.light.material.dispose();
    },
  };
})();
