'use strict';
/* ============================================================
   TRAILBLOOM — scenes.js
   All procedural drawing: skies, worlds, characters, shoe,
   capsules, growth stages, hotspot objects, menu tableau.
   ============================================================ */

/* ---------- color helpers ---------- */
function hexRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function hexLerp(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function rgba(hex, a) { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

const Scenes = {
  W: window.innerWidth, H: window.innerHeight,
  setSize(w, h) { this.W = w; this.H = h; },
  groundY() { return this.H * 0.74; },
  parallaxX(wx, camFx, d) { return (wx - camFx) * d + this.W / 2; },

  /* ================= SKY & LANDSCAPE PRIMITIVES ================= */
  sky(ctx, top, mid, bot, li = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, hexLerp(top, '#223a52', li * 0.35));
    g.addColorStop(0.55, hexLerp(mid, '#3d5a6e', li * 0.3));
    g.addColorStop(1, hexLerp(bot, '#54706a', li * 0.32));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  },
  stars(ctx, seed, n, t, yMax, alpha) {
    const r = mulberry32(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = r() * this.W, y = r() * yMax, tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + r()) + i));
      ctx.globalAlpha = alpha * tw;
      ctx.fillStyle = i % 7 === 0 ? '#cfe6ff' : '#ffffff';
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    ctx.restore();
  },
  moon(ctx, x, y, r, alpha) {
    drawGlow(ctx, x, y, r * 4, 'rgba(150,190,240,0.5)', alpha * 0.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#dfe9f5';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,180,205,0.5)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.15, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  },
  sun(ctx, x, y, r, t, inten) {
    drawGlow(ctx, x, y, r * 6, 'rgba(255,214,150,0.75)', 0.55 * inten);
    ctx.fillStyle = '#ffe9c0';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    /* rays */
    ctx.save();
    ctx.translate(x, y); ctx.rotate(t * 0.05);
    ctx.strokeStyle = rgba('#ffd9a0', 0.12 * inten);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
      ctx.lineTo(Math.cos(a) * r * (3.4 + Math.sin(t * 0.7 + i) * 0.5), Math.sin(a) * r * (3.4 + Math.cos(t * 0.6 + i) * 0.5));
      ctx.stroke();
    }
    ctx.restore();
    /* lens flare dots along diagonal */
    ctx.globalAlpha = 0.16 * inten;
    const fx = ['#ffdfae', '#ffd0d8', '#c4ecff'];
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = fx[i - 1];
      ctx.beginPath();
      ctx.arc(x - (x - this.W / 2) * (i * 0.55) * 2, y - (y - this.H / 2) * (i * 0.55) * 2, 14 - i * 2.4 + Math.sin(t + i) * 2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  ridge(ctx, baseY, amp, color, seed, phase, step = 110) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, this.H + 40);
    const r = mulberry32(seed);
    const off = [];
    for (let i = 0; i < 40; i++) off.push(r());
    for (let x = -20; x <= this.W + 40; x += step) {
      const i = Math.floor((x + phase) / step);
      const h = off[((i % off.length) + off.length) % off.length];
      ctx.lineTo(x, baseY - h * amp);
    }
    ctx.lineTo(this.W + 40, this.H + 40);
    ctx.closePath();
    ctx.fill();
  },
  fogBands(ctx, t, alpha, color = '90,130,180') {
    for (let i = 0; i < 3; i++) {
      const y = this.H * (0.55 + i * 0.09);
      const x = ((t * (6 + i * 5)) % (this.W + 600)) - 300;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 340);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 90, this.W, 180);
    }
  },

  /* ================= TREES ================= */
  treePine(ctx, x, y, s, tone, sway = 0) {
    ctx.fillStyle = tone;
    ctx.fillRect(x - 2 * s, y - 26 * s, 4 * s, 26 * s);
    for (let i = 0; i < 4; i++) {
      const w = (16 - i * 3) * s, yy = y - (24 + i * 12) * s;
      ctx.beginPath();
      ctx.moveTo(x - w + sway * i, yy);
      ctx.lineTo(x + w + sway * i, yy);
      ctx.lineTo(x + sway * i, yy - 15 * s);
      ctx.closePath(); ctx.fill();
    }
  },
  treeDead(ctx, x, y, s, tone, sway = 0) {
    ctx.strokeStyle = tone;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2 * s + sway, y - 24 * s, x + sway * 1.6, y - 46 * s);
    ctx.stroke();
    ctx.lineWidth = 1.6 * s;
    const br = [[-1, 0.6, 14], [1, 0.45, 20], [-0.8, 0.25, 30], [0.9, 0.15, 36]];
    for (const [d, h, len] of br) {
      ctx.beginPath();
      ctx.moveTo(x + sway * h, y - h * 46 * s);
      ctx.quadraticCurveTo(x + d * len * 0.5 * s, y - (h * 46 + 8) * s, x + d * len * s + sway * h, y - (h * 46 + (4 + len * 0.3)) * s);
      ctx.stroke();
    }
  },
  treeRound(ctx, x, y, s, tone, sway = 0) {
    ctx.fillStyle = tone;
    ctx.fillRect(x - 2.4 * s, y - 24 * s, 4.8 * s, 24 * s);
    ctx.beginPath();
    ctx.ellipse(x + sway, y - 33 * s, 15 * s, 13 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 9 * s + sway, y - 27 * s, 9 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 9 * s + sway, y - 28 * s, 9 * s, 8 * s, 0, 0, TAU);
    ctx.fill();
  },
  treeDream(ctx, x, y, s, tone, t) {
    ctx.strokeStyle = tone;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 3 * s, y - 22 * s, x, y - 40 * s);
    ctx.stroke();
    ctx.lineWidth = 1.4 * s;
    for (let i = 0; i < 5; i++) {
      const lx = x + (i - 2) * 7 * s;
      const sw = Math.sin(t * 1.1 + i + x * 0.05) * 4 * s;
      ctx.beginPath();
      ctx.moveTo(lx, y - 36 * s);
      ctx.quadraticCurveTo(lx + sw * 0.5, y - 20 * s, lx + sw, y - 6 * s);
      ctx.stroke();
    }
    drawGlow(ctx, x, y - 44 * s, 16 * s, 'rgba(255,190,220,0.4)', 0.5);
  },

  /* ================= GROUND & GRASS ================= */
  ground(ctx, gy, c1, c2, li = 0) {
    const g = ctx.createLinearGradient(0, gy - 30, 0, this.H);
    g.addColorStop(0, hexLerp(c1, '#3c7a4c', li * 0.55));
    g.addColorStop(1, hexLerp(c2, '#2c5a3a', li * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, gy - 26, this.W, this.H - gy + 30);
  },
  grass(ctx, gy, camFx, color, playerWX, t, li = 0, dens = 1) {
    const step = 16 / Math.max(dens, 0.4);
    const i0 = Math.floor((camFx - this.W / 2 - 40) / step);
    const i1 = Math.ceil((camFx + this.W / 2 + 40) / step);
    ctx.strokeStyle = hexLerp(color, '#5cae6c', li * 0.65);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const wx = i * step + hash1(i) * 8;
      const sx = this.parallaxX(wx, camFx, 1);
      const h = 7 + hash1(i * 3) * 13;
      const lean = (hash1(i * 7) - 0.5) * 6;
      let bend = 0;
      const dx = wx - playerWX;
      if (Math.abs(dx) < 70) bend = -Math.sign(dx) * (1 - Math.abs(dx) / 70) * 11 * Math.sin(t * 3 + i);
      const wind = Math.sin(t * 1.4 + wx * 0.02) * 2.4;
      ctx.moveTo(sx, gy + 3);
      ctx.quadraticCurveTo(sx + lean * 0.4, gy - h * 0.5, sx + lean + wind + bend, gy - h);
    }
    ctx.stroke();
  },
  water(ctx, x, w, gy, t, moonX) {
    const h = this.H - gy + 30;
    const g = ctx.createLinearGradient(0, gy - 6, 0, gy + h * 0.5);
    g.addColorStop(0, 'rgba(90,140,190,0.30)');
    g.addColorStop(1, 'rgba(20,40,70,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, gy + 14, w / 2, 26, 0, 0, TAU);
    ctx.fill();
    if (moonX !== undefined) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = 'rgba(200,225,255,0.7)';
      for (let i = 0; i < 5; i++) {
        const yy = gy - 2 + i * 6;
        const ww = (26 - i * 4) * (0.8 + Math.sin(t * 1.6 + i) * 0.2);
        ctx.beginPath();
        ctx.moveTo(moonX - ww, yy);
        ctx.quadraticCurveTo(moonX, yy + 2, moonX + ww, yy);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(160,210,255,0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const yy = gy + 4 + i * 7;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.4 + Math.sin(t * 0.9 + i * 2) * 8, yy);
      ctx.quadraticCurveTo(x, yy + 2, x + w * 0.36 + Math.sin(t * 0.8 + i) * 8, yy);
      ctx.stroke();
    }
  },

  /* ================= WORLDS ================= */
  drawForest(ctx, cam, t, env, part) {
    const gy = this.groundY(), li = env.light, W = this.W;
    this.sky(ctx, '#02040c', '#061224', '#0a1c34', li);
    this.stars(ctx, 11, 90, t, this.H * 0.5, 0.5 + li * 0.2);
    this.moon(ctx, W * 0.74, this.H * 0.2, 30, 0.85);
    this.ridge(ctx, gy - 90, 60, hexLerp('#040a16', '#12283c', li * 0.4), 5, cam.fx * 0.16);
    this.fogBands(ctx, t, 0.05);
    this.ridge(ctx, gy - 30, 46, hexLerp('#060e1d', '#183048', li * 0.4), 9, cam.fx * 0.3);
    /* mid dead trees */
    const step = 240, r0 = Math.floor((cam.fx * 0.55 - W) / step), r1 = Math.ceil((cam.fx * 0.55 + W) / step);
    for (let i = r0; i <= r1; i++) {
      const wx = i * step + hash1(i * 13) * 130;
      const sx = this.parallaxX(wx, cam.fx, 0.55);
      this.treeDead(ctx, sx, gy - 14, 1.5 + hash1(i) * 0.9, hexLerp('#0a1424', '#1c3a44', li * 0.5), Math.sin(t * 0.7 + i) * 2);
    }
    this.fogBands(ctx, t * 0.7, 0.055);
    this.ground(ctx, gy, '#0d2036', '#0a1826', li);
    /* near trees depth 1 */
    const s2 = 340, n0 = Math.floor((cam.fx - W) / s2), n1 = Math.ceil((cam.fx + W) / s2);
    for (let i = n0; i <= n1; i++) {
      if (hash1(i * 29) < 0.42) continue;
      const wx = i * s2 + hash1(i * 3) * 190;
      const sx = this.parallaxX(wx, cam.fx, 1);
      this.treeDead(ctx, sx, gy + 6, 2.1 + hash1(i * 5) * 1.2, hexLerp('#13233c', '#28503f', li * 0.6), Math.sin(t * 0.6 + i * 2) * 3);
    }
    this.grass(ctx, gy + 8, cam.fx, '#1c4258', env.playerX !== undefined ? env.playerX : -9999, t, li);
  },
  drawForestFront(ctx, cam, t, env) {
    const gy = this.groundY();
    ctx.fillStyle = rgba('#030810', 0.9);
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    for (let x = 0; x <= this.W; x += 60) {
      ctx.lineTo(x, gy + 34 + Math.sin(x * 0.01 + 2) * 8);
    }
    ctx.lineTo(this.W, this.H);
    ctx.closePath(); ctx.fill();
  },

  drawValley(ctx, cam, t, env) {
    const gy = this.groundY(), li = env.light, W = this.W;
    this.sky(ctx, '#03060f', '#081628', '#0e2438', li);
    this.stars(ctx, 21, 130, t, this.H * 0.55, 0.6);
    this.moon(ctx, W * 0.36, this.H * 0.22, 42, 0.95);
    this.ridge(ctx, gy - 120, 90, hexLerp('#050c18', '#1a3244', li * 0.4), 31, cam.fx * 0.14);
    this.ridge(ctx, gy - 70, 66, hexLerp('#081224', '#20403c', li * 0.45), 37, cam.fx * 0.26);
    this.fogBands(ctx, t * 0.6, 0.07);
    this.ridge(ctx, gy - 20, 36, hexLerp('#0b182c', '#2a4c40', li * 0.5), 41, cam.fx * 0.44);
    this.ground(ctx, gy, '#0d1e30', '#0a1626', li);
    /* pond */
    const px = this.parallaxX(1800, cam.fx, 1);
    this.water(ctx, px, 620, gy + 10, t, W * 0.36);
    /* reeds */
    const step = 46, i0 = Math.floor((cam.fx - W) / step), i1 = Math.ceil((cam.fx + W) / step);
    ctx.strokeStyle = hexLerp('#1b4048', '#3f7a52', li * 0.6);
    ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let i = i0; i <= i1; i++) {
      if (hash1(i * 17) < 0.5) continue;
      const wx = i * step + hash1(i) * 20;
      const sx = this.parallaxX(wx, cam.fx, 1);
      if (Math.abs(sx - px) < 240) continue;
      const h = 16 + hash1(i * 3) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, gy + 6);
      ctx.quadraticCurveTo(sx + 2, gy - h * 0.5, sx + 5 + Math.sin(t + i) * 3, gy - h);
      ctx.stroke();
    }
    this.grass(ctx, gy + 6, cam.fx, '#1e4a4e', env.playerX !== undefined ? env.playerX : -9999, t, li);
  },

  drawAbstract(ctx, cam, t, env) {
    const gy = this.groundY(), li = env.light, W = this.W;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, hexLerp('#070312', '#241a3a', li * 0.3));
    g.addColorStop(0.6, hexLerp('#0e0a20', '#2c2450', li * 0.3));
    g.addColorStop(1, hexLerp('#120e26', '#38305c', li * 0.3));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.H);
    this.stars(ctx, 51, 40, t, this.H * 0.4, 0.35);
    /* horizon glow */
    drawGlow(ctx, W * 0.5, gy - 60, 300, 'rgba(150,110,255,0.28)', 0.5 + Math.sin(t * 0.5) * 0.15);
    /* perspective grid */
    ctx.strokeStyle = 'rgba(140,120,220,0.16)';
    ctx.lineWidth = 1;
    const vpx = W * 0.5 - (cam.fx % 400) * 0.12;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(vpx + i * 40, gy);
      ctx.lineTo(vpx + i * 320, this.H);
      ctx.stroke();
    }
    for (let i = 1; i < 7; i++) {
      const yy = gy + Math.pow(i / 7, 1.8) * (this.H - gy);
      ctx.globalAlpha = 1 - i * 0.1;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    /* floating shapes */
    const step = 300, i0 = Math.floor((cam.fx * 0.7 - W) / step), i1 = Math.ceil((cam.fx * 0.7 + W) / step);
    for (let i = i0; i <= i1; i++) {
      const wx = i * step + hash1(i * 7) * 160;
      const sx = this.parallaxX(wx, cam.fx, 0.7);
      const sy = this.H * (0.2 + hash1(i * 3) * 0.4);
      const sz = 14 + hash1(i * 11) * 26;
      const kind = Math.floor(hash1(i * 13) * 3);
      const hue = [`rgba(150,120,255,`, `rgba(120,200,255,`, `rgba(255,150,220,`][Math.floor(hash1(i * 5) * 3)];
      const rot = t * (0.2 + hash1(i) * 0.5) * (hash1(i * 9) > 0.5 ? 1 : -1);
      ctx.save();
      ctx.translate(sx, sy + Math.sin(t * 0.6 + i) * 14);
      ctx.rotate(rot);
      drawGlow(ctx, 0, 0, sz * 2.2, hue + '0.5)', 0.4);
      ctx.strokeStyle = hue + '0.85)';
      ctx.lineWidth = 1.4;
      if (kind === 0) { ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); }
      else if (kind === 1) { ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, sz / 2.9, 0, TAU); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(0, -sz / 2); ctx.lineTo(sz / 2, sz / 2); ctx.lineTo(-sz / 2, sz / 2); ctx.closePath(); ctx.stroke(); }
      ctx.restore();
    }
    /* reflective floor */
    ctx.fillStyle = hexLerp('#0a0818', '#2c2a4a', li * 0.4);
    ctx.fillRect(0, gy, W, this.H - gy);
    ctx.fillStyle = 'rgba(160,130,255,0.05)';
    ctx.fillRect(0, gy, W, 3);
  },

  drawDream(ctx, cam, t, env) {
    const gy = this.groundY(), li = env.light, W = this.W;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, hexLerp('#120a24', '#3a2c50', li * 0.3));
    g.addColorStop(0.55, hexLerp('#241540', '#4c3a64', li * 0.3));
    g.addColorStop(1, hexLerp('#33204c', '#5c4870', li * 0.3));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.H);
    this.stars(ctx, 71, 60, t, this.H * 0.45, 0.4);
    /* soft glow orbs */
    for (let i = 0; i < 4; i++) {
      const ox = ((i * 530 + t * 12) % (W + 400)) - 200;
      drawGlow(ctx, ox, this.H * (0.25 + 0.13 * i), 120, 'rgba(255,180,220,0.30)', 0.4 + Math.sin(t * 0.8 + i) * 0.12);
    }
    this.ridge(ctx, gy - 60, 50, hexLerp('#1c1235', '#443c60', li * 0.35), 61, cam.fx * 0.2);
    this.ground(ctx, gy, '#241a3e', '#180f2c', li);
    /* glowing path stones */
    const step = 200, i0 = Math.floor((cam.fx - W) / step), i1 = Math.ceil((cam.fx + W) / step);
    for (let i = i0; i <= i1; i++) {
      const wx = i * step + hash1(i * 3) * 60;
      const sx = this.parallaxX(wx, cam.fx, 1);
      const sy = gy + 18 + hash1(i * 7) * 26;
      drawGlow(ctx, sx, sy, 26, 'rgba(255,200,240,0.5)', 0.35 + Math.sin(t * 1.2 + i) * 0.18);
      ctx.fillStyle = 'rgba(230,190,235,0.5)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 9, 3.4, 0, 0, TAU); ctx.fill();
    }
    /* dream trees */
    const s2 = 460, j0 = Math.floor((cam.fx - W) / s2), j1 = Math.ceil((cam.fx + W) / s2);
    for (let i = j0; i <= j1; i++) {
      if (hash1(i * 23) < 0.35) continue;
      const wx = i * s2 + hash1(i * 5) * 220;
      const sx = this.parallaxX(wx, cam.fx, 1);
      this.treeDream(ctx, sx, gy + 4, 1.6 + hash1(i) * 0.7, hexLerp('#2e2050', '#4c3c70', li * 0.5), t);
    }
    this.grass(ctx, gy + 6, cam.fx, '#3c2c5c', env.playerX !== undefined ? env.playerX : -9999, t, li, 0.7);
  },

  drawBloom(ctx, cam, t, env) {
    const gy = this.groundY(), li = Math.max(env.light, 0.55), W = this.W;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, hexLerp('#274a66', '#7fb4d8', 0.35 + li * 0.4));
    g.addColorStop(0.5, hexLerp('#7a9bb0', '#ffd9a8', 0.3 + li * 0.45));
    g.addColorStop(1, hexLerp('#b7c4b5', '#ffe9c4', 0.3 + li * 0.4));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.H);
    /* sun */
    this.sun(ctx, W * 0.62, this.H * 0.3, 34, t, 0.7 + li * 0.4);
    /* mountain ridges with snowcaps */
    this.ridge(ctx, gy - 190, 150, hexLerp('#5a7590', '#8fb0c4', li * 0.3), 81, cam.fx * 0.12);
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.ridge(ctx, gy - 190, 0, 'rgba(0,0,0,0)', 81, cam.fx * 0.12);
    ctx.restore();
    this.ridge(ctx, gy - 110, 100, hexLerp('#48684f', '#6a9a6c', li * 0.3), 87, cam.fx * 0.24);
    this.ridge(ctx, gy - 40, 55, hexLerp('#3c6347', '#5f9460', li * 0.3), 91, cam.fx * 0.42);
    this.ground(ctx, gy, '#4c8a54', '#3a7048', li);
    /* meadow flowers */
    const step = 42, i0 = Math.floor((cam.fx - W) / step), i1 = Math.ceil((cam.fx + W) / step);
    const cols = ['#ff9ecb', '#ffd9a0', '#fff3d6', '#c4ecff'];
    const fdens = 0.25 + li * 0.55;
    for (let i = i0; i <= i1; i++) {
      const h1 = hash1(i * 19);
      if (h1 > fdens) continue;
      const wx = i * step + hash1(i) * 26;
      const sx = this.parallaxX(wx, cam.fx, 1);
      const sy = gy + 10 + hash1(i * 3) * 40;
      const c = cols[Math.floor(hash1(i * 7) * 4)];
      const sway = Math.sin(t * 1.3 + i) * 2;
      ctx.strokeStyle = '#3f7a4c'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy + 6); ctx.quadraticCurveTo(sx + 1, sy - 3, sx + sway, sy - 8); ctx.stroke();
      drawGlow(ctx, sx + sway, sy - 9, 6, c, 0.65);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(sx + sway, sy - 9, 2.1, 0, TAU); ctx.fill();
    }
    this.grass(ctx, gy + 8, cam.fx, '#5aa668', env.playerX !== undefined ? env.playerX : -9999, t, li, 1.1);
  },

  /* ================= MENU TABLEAU ================= */
  drawMenuAmbient(ctx, t, intro, env, mx) {
    const gy = this.groundY(), W = this.W, li = env.light;
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, this.H);
    this.stars(ctx, 11, 110, t, this.H * 0.5, 0.55);
    /* soft blue light rises behind the mountain */
    if (intro.light > 0) {
      drawGlow(ctx, W * 0.5 + mx * 12, gy - 130, 320, 'rgba(110,170,235,0.4)', intro.light * 0.8);
    }
    /* mountain silhouette rises */
    if (intro.mtn > 0) {
      ctx.save();
      ctx.globalAlpha = intro.mtn;
      ctx.translate(0, (1 - intro.mtn) * 46);
      this.ridge(ctx, gy - 40, 170, '#050b18', 5, mx * 30);
      this.ridge(ctx, gy - 5, 110, '#081224', 9, 60 + mx * 55);
      ctx.restore();
    }
    this.fogBands(ctx, t, 0.045);
    this.ground(ctx, gy, '#0b1a2e', '#081220', li);
    this.grass(ctx, gy + 8, 0, '#1c4258', -9999, t, li);
    /* characters */
    if (intro.chars > 0) {
      ctx.save(); ctx.globalAlpha = intro.chars;
      this.drawJuvia(ctx, W * 0.46 + mx * 8, gy + 14, 1.15, { t, dir: 1, moving: false });
      this.drawGray(ctx, W * 0.54 + mx * 12, gy + 14, 1.18, { t, dir: -1, moving: false });
      ctx.restore();
    }
    /* shoe */
    if (intro.shoe > 0) {
      ctx.save();
      ctx.globalAlpha = intro.shoe;
      const bob = Math.sin(t * 1.2) * 5;
      this.drawShoeProfile(ctx, W * 0.5 + mx * 20, gy + 64 + bob, 0.62, { t, glow: 0.6 });
      ctx.restore();
    }
    this.drawForestFront(ctx, { fx: 0 }, t, env);
  },

  /* ================= CHARACTERS ================= */
  drawGray(ctx, x, y, s, o) {
    const t = o.t || 0;
    if (o.glow) drawGlow(ctx, x, y - 46 * s, 58 * s, 'rgba(140,200,255,0.5)', 0.55 * o.glow);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (o.dir || 1), s);
    const breathe = Math.sin(t * 1.7) * 1.1;
    const wp = o.walkPh || 0;
    const la = o.moving ? Math.sin(wp) * 0.55 : 0.05;
    const bob = o.moving ? Math.abs(Math.sin(wp)) * 1.8 : 0;
    ctx.translate(0, -bob);
    const body = '#0a1424', rim = 'rgba(125,175,225,0.55)';
    /* legs */
    ctx.strokeStyle = body; ctx.lineCap = 'round'; ctx.lineWidth = 5;
    for (const sgn of [1, -1]) {
      const a = la * sgn;
      ctx.beginPath();
      ctx.moveTo(0, -36 + breathe * 0.3);
      ctx.lineTo(Math.sin(a) * 8, -18);
      ctx.lineTo(Math.sin(a) * 15, 0);
      ctx.stroke();
    }
    /* torso */
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-5.5, -35 + breathe * 0.3);
    ctx.quadraticCurveTo(-9, -52, -3.5, -63 + breathe);
    ctx.lineTo(6, -62 + breathe);
    ctx.quadraticCurveTo(9.5, -50, 7, -35 + breathe * 0.3);
    ctx.closePath(); ctx.fill();
    /* scarf flutter */
    ctx.strokeStyle = '#1d3a58'; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(1, -60 + breathe);
    ctx.quadraticCurveTo(-12, -56 + Math.sin(t * 2.6) * 3, -20, -46 + Math.sin(t * 2.2 + 1) * 4);
    ctx.stroke();
    /* arm */
    ctx.strokeStyle = body; ctx.lineWidth = 4.2;
    const aa = o.moving ? -Math.sin(wp) * 0.6 : Math.sin(t * 1.1) * 0.06;
    ctx.beginPath();
    ctx.moveTo(3, -59 + breathe);
    ctx.lineTo(3 + Math.sin(aa) * 7, -48);
    ctx.lineTo(3 + Math.sin(aa) * 12, -38 + Math.cos(aa) * 3);
    ctx.stroke();
    /* head + spiky hair */
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(4, -71 + breathe, 7, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, -75 + breathe);
    ctx.lineTo(-6, -82 + breathe); ctx.lineTo(-1, -78 + breathe);
    ctx.lineTo(-0.5, -85 + breathe); ctx.lineTo(3, -79 + breathe);
    ctx.lineTo(6.5, -84 + breathe); ctx.lineTo(8, -77 + breathe);
    ctx.lineTo(11, -79 + breathe); ctx.lineTo(10, -73 + breathe);
    ctx.closePath(); ctx.fill();
    /* rim light */
    ctx.strokeStyle = rim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(4, -71 + breathe, 7, -2.4, -0.4); ctx.stroke();
    /* eye glint (blink) */
    if (!o.back && (t % 4.4) > 0.14) {
      ctx.fillStyle = 'rgba(210,235,255,0.85)';
      ctx.fillRect(7.5, -72.5 + breathe, 2.2, 1.3);
    }
    ctx.restore();
  },
  drawJuvia(ctx, x, y, s, o) {
    const t = o.t || 0;
    if (o.glow) drawGlow(ctx, x, y - 44 * s, 56 * s, 'rgba(150,190,255,0.5)', 0.55 * o.glow);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (o.dir || 1), s);
    const breathe = Math.sin(t * 1.9 + 1) * 1;
    const wp = o.walkPh || 0;
    const la = o.moving ? Math.sin(wp) * 0.5 : 0.04;
    const bob = o.moving ? Math.abs(Math.sin(wp)) * 1.6 : 0;
    ctx.translate(0, -bob);
    const body = '#0d1830', rim = 'rgba(140,185,235,0.5)';
    /* legs */
    ctx.strokeStyle = body; ctx.lineCap = 'round'; ctx.lineWidth = 4.6;
    for (const sgn of [1, -1]) {
      const a = la * sgn;
      ctx.beginPath();
      ctx.moveTo(0, -34 + breathe * 0.3);
      ctx.lineTo(Math.sin(a) * 7, -17);
      ctx.lineTo(Math.sin(a) * 13, 0);
      ctx.stroke();
    }
    /* coat (flared) */
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-6, -33 + breathe * 0.3);
    ctx.quadraticCurveTo(-11, -48, -5, -61 + breathe);
    ctx.lineTo(6, -60 + breathe);
    ctx.quadraticCurveTo(11, -47, 9 + Math.sin(t * 2) * 1.5, -33 + breathe * 0.3);
    ctx.quadraticCurveTo(1, -29, -6, -33 + breathe * 0.3);
    ctx.closePath(); ctx.fill();
    /* long hair ribbons */
    ctx.strokeStyle = '#16294a'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const hx = -2 - i * 2.4, ph = t * 2.1 + i * 1.3;
      ctx.beginPath();
      ctx.moveTo(hx, -64 + breathe);
      ctx.quadraticCurveTo(hx - 6 + Math.sin(ph) * 2, -46, hx - 9 + Math.sin(ph) * 3.4, -26 + Math.cos(ph) * 2);
      ctx.stroke();
    }
    /* arm */
    ctx.strokeStyle = body; ctx.lineWidth = 3.8;
    const aa = o.moving ? -Math.sin(wp) * 0.55 : Math.sin(t * 1.3 + 2) * 0.07;
    ctx.beginPath();
    ctx.moveTo(2.5, -57 + breathe);
    ctx.lineTo(2.5 + Math.sin(aa) * 6, -47);
    ctx.lineTo(2.5 + Math.sin(aa) * 11, -37 + Math.cos(aa) * 3);
    ctx.stroke();
    /* head + beret */
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(3.5, -68 + breathe, 6.6, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2.5, -73.5 + breathe, 7.6, 3, -0.18, 0, TAU);
    ctx.fill();
    /* rim */
    ctx.strokeStyle = rim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(3.5, -68 + breathe, 6.6, -2.5, -0.5); ctx.stroke();
    if (!o.back && (t % 3.9) > 0.13) {
      ctx.fillStyle = 'rgba(215,238,255,0.85)';
      ctx.fillRect(6.8, -69.5 + breathe, 2, 1.2);
    }
    ctx.restore();
  },

  /* ================= HOTSPOT OBJECTS ================= */
  drawHotspotObject(ctx, type, x, y, t, env, scale = 1, focus = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (focus > 0) drawGlow(ctx, 0, -20, 70, 'rgba(255,225,180,0.55)', 0.5 * focus);
    switch (type) {
      case 'firefly': {
        const p = 0.5 + 0.5 * Math.sin(t * 2.4);
        drawGlow(ctx, Math.sin(t * 1.1) * 26, -46 + Math.cos(t * 0.9) * 12, 16 + p * 12, 'rgba(200,240,160,0.95)', 0.8);
        ctx.fillStyle = '#e6ffd0';
        ctx.beginPath(); ctx.arc(Math.sin(t * 1.1) * 26, -46 + Math.cos(t * 0.9) * 12, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'dying': {
        ctx.strokeStyle = '#3a4a42'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3, -14, 12, -24); ctx.stroke();
        ctx.fillStyle = '#41504a';
        ctx.beginPath(); ctx.ellipse(13, -26, 6, 2.4, 0.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2, -12, 5, 2, -0.6, 0, TAU); ctx.fill();
        drawGlow(ctx, 12, -26, 14, 'rgba(150,220,170,0.5)', 0.25 + 0.15 * Math.sin(t * 1.4));
        break;
      }
      case 'stone': {
        ctx.fillStyle = '#141d30';
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(-9, -40); ctx.quadraticCurveTo(0, -48, 9, -38); ctx.lineTo(12, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(140,200,255,${0.4 + 0.3 * Math.sin(t * 1.8)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -22); ctx.moveTo(-4, -30); ctx.lineTo(4, -30); ctx.stroke();
        drawGlow(ctx, 0, -28, 26, 'rgba(120,180,255,0.45)', 0.4 + 0.2 * Math.sin(t * 1.8));
        break;
      }
      case 'shape': {
        ctx.save();
        ctx.translate(0, -34); ctx.rotate(t * 0.6);
        drawGlow(ctx, 0, 0, 34, 'rgba(180,140,255,0.6)', 0.55);
        ctx.strokeStyle = 'rgba(200,170,255,0.9)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'lantern': {
        ctx.strokeStyle = '#241a3a'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -52); ctx.quadraticCurveTo(0, -62, 12, -62); ctx.stroke();
        const sw = Math.sin(t * 1.3) * 0.12;
        ctx.save(); ctx.translate(12, -62); ctx.rotate(sw);
        drawGlow(ctx, 0, 10, 26, 'rgba(255,205,150,0.8)', 0.75);
        ctx.fillStyle = '#ffd9a0';
        roundRect(ctx, -4, 4, 8, 12, 3); ctx.fill();
        ctx.restore();
        break;
      }
      case 'pool': {
        const a = 0.3 + 0.2 * Math.sin(t * 1.1);
        drawGlow(ctx, 0, -2, 44, 'rgba(255,170,220,0.5)', a);
        ctx.strokeStyle = `rgba(255,190,230,${a + 0.2})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, -2, 34, 10, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'vista': {
        let sy = 0;
        for (let i = 0; i < 4; i++) {
          const w = 14 - i * 2.6;
          ctx.fillStyle = hexLerp('#141d30', '#3a4c44', env.light * 0.4);
          roundRect(ctx, -w / 2 + Math.sin(i * 2.4) * 2, sy - 7, w, 7, 3); ctx.fill();
          sy -= 8;
        }
        drawGlow(ctx, 0, sy - 4, 22, 'rgba(160,220,255,0.4)', 0.3 + 0.2 * Math.sin(t));
        break;
      }
      case 'gate': {
        ctx.strokeStyle = 'rgba(150,210,255,0.5)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-22, -58, 0, -62); ctx.quadraticCurveTo(22, -58, 22, 0); ctx.stroke();
        const a = 0.35 + 0.25 * Math.sin(t * 1.6);
        drawGlow(ctx, 0, -30, 40, 'rgba(150,210,255,0.5)', a);
        break;
      }
      case 'soil': {
        ctx.fillStyle = hexLerp('#231a12', '#2e2a18', env.light);
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, TAU); ctx.fill();
        const a = 0.25 + 0.2 * Math.sin(t * 1.7);
        drawGlow(ctx, 0, -3, 22, 'rgba(180,240,190,0.5)', a);
        break;
      }
    }
    ctx.restore();
  },

  /* ================= GROWTH (planted seeds) ================= */
  drawGrowth(ctx, x, y, stage, t, s = 1, kind = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(t * 1.3 + x * 0.05) * 0.035);
    /* soil mound */
    ctx.fillStyle = '#241b12';
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 4.4, 0, 0, TAU); ctx.fill();
    if (stage < 0.05) { ctx.restore(); return; }
    const H = stage * 34;
    ctx.strokeStyle = '#4c8a54'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(2, -H * 0.5, 0, -H); ctx.stroke();
    const leaves = Math.min(4, Math.ceil(stage * 3) + 1);
    for (let i = 0; i < leaves; i++) {
      const ly = -H * (0.3 + i * 0.2), sgn = i % 2 ? 1 : -1;
      ctx.fillStyle = i % 2 ? '#57a05f' : '#4a8f52';
      ctx.beginPath();
      ctx.ellipse(sgn * (5 + i), ly, 6.5 - i * 0.7, 2.4, sgn * 0.5, 0, TAU);
      ctx.fill();
    }
    if (stage >= 2) {
      const buds = Math.min(3, Math.ceil(stage) - 1);
      for (let i = 0; i < buds; i++) {
        const by = -H * (0.75 + i * 0.1), bx = (i - 1) * 7;
        ctx.fillStyle = '#ffe9c0';
        ctx.beginPath(); ctx.arc(bx, by, 2, 0, TAU); ctx.fill();
      }
    }
    if (stage >= 3) {
      const petals = 6, pr = 4 + Math.sin(t * 1.2 + x) * 0.5;
      const col = ['#ff9ecb', '#ffd9a0', '#c4ecff'][kind % 3];
      drawGlow(ctx, 0, -H, 16, col, 0.7);
      ctx.fillStyle = col;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + t * 0.1;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * pr, -H + Math.sin(a) * pr, 4.4, 2.2, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath(); ctx.arc(0, -H, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  /* ================= TRAILBLOOM SHOE ================= */
  drawShoeProfile(ctx, cx, cy, s, o = {}) {
    const t = o.t || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    if (o.glow) drawGlow(ctx, 0, -20, 170, 'rgba(120,180,240,0.4)', o.glow * 0.7);
    /* sole */
    ctx.fillStyle = '#0c1626';
    ctx.beginPath();
    ctx.moveTo(-112, -4);
    ctx.quadraticCurveTo(-40, 8, 30, 6);
    ctx.quadraticCurveTo(90, 3, 118, -14);
    ctx.quadraticCurveTo(122, -22, 112, -24);
    ctx.quadraticCurveTo(40, -14, -30, -16);
    ctx.quadraticCurveTo(-90, -17, -110, -20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-110, -6); ctx.quadraticCurveTo(-40, 6, 30, 4); ctx.quadraticCurveTo(90, 1, 116, -15);
    ctx.stroke();
    /* tread ticks */
    ctx.strokeStyle = 'rgba(143,211,255,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const tx = -95 + i * 22;
      ctx.beginPath(); ctx.moveTo(tx, -8); ctx.lineTo(tx + 6, -6); ctx.stroke();
    }
    /* upper */
    const ug = ctx.createLinearGradient(0, -70, 0, -10);
    ug.addColorStop(0, '#1e3250');
    ug.addColorStop(1, '#101d33');
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.moveTo(-108, -20);
    ctx.quadraticCurveTo(-98, -52, -66, -62);
    ctx.quadraticCurveTo(-52, -66, -44, -58);
    ctx.quadraticCurveTo(-10, -46, 18, -44);
    ctx.quadraticCurveTo(66, -40, 108, -22);
    ctx.quadraticCurveTo(60, -12, -30, -14);
    ctx.quadraticCurveTo(-80, -15, -108, -20);
    ctx.closePath();
    ctx.fill();
    /* collar */
    ctx.fillStyle = '#0b1526';
    roundRect(ctx, -74, -70, 30, 12, 6); ctx.fill();
    /* laces */
    ctx.strokeStyle = 'rgba(210,230,250,0.8)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const lx = -30 + i * 13;
      ctx.beginPath();
      ctx.moveTo(lx, -50 + i * 2.4);
      ctx.quadraticCurveTo(lx + 7, -47 + i * 2.2, lx + 13, -49.5 + i * 2.4);
      ctx.stroke();
    }
    /* stitch accent */
    ctx.strokeStyle = 'rgba(255,158,203,0.5)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(-88, -30);
    ctx.quadraticCurveTo(-20, -38, 60, -30);
    ctx.stroke();
    ctx.setLineDash([]);
    /* heel pod housing */
    const pod = o.pod || 0;
    ctx.fillStyle = '#142338';
    roundRect(ctx, -124, -50, 22, 34, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.7)'; ctx.lineWidth = 1.2;
    roundRect(ctx, -124, -50, 22, 34, 6); ctx.stroke();
    /* pod indicator */
    ctx.fillStyle = pod > 0.5 ? '#9de8b0' : '#ff7d7d';
    ctx.beginPath(); ctx.arc(-113, -44, 2, 0, TAU); ctx.fill();
    if (pod > 0.05) {
      ctx.save();
      ctx.globalAlpha = pod;
      drawGlow(ctx, -113, -30, 16, 'rgba(157,232,176,0.8)', 0.8);
      ctx.restore();
    }
    ctx.restore();
  },

  drawShoeHeel(ctx, cx, cy, s, o = {}) {
    const t = o.t || 0, pod = o.pod || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    if (o.glow) drawGlow(ctx, 0, -10, 130, 'rgba(120,180,240,0.4)', o.glow * 0.7);
    /* sole base */
    ctx.fillStyle = '#0c1626';
    ctx.beginPath();
    ctx.moveTo(-62, 34); ctx.quadraticCurveTo(-70, -14, -56, -34);
    ctx.lineTo(56, -34); ctx.quadraticCurveTo(70, -14, 62, 34);
    ctx.closePath(); ctx.fill();
    /* upper back */
    const ug = ctx.createLinearGradient(0, -70, 0, 20);
    ug.addColorStop(0, '#22385a'); ug.addColorStop(1, '#101d33');
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.moveTo(-52, 30); ctx.quadraticCurveTo(-64, -12, -50, -30);
    ctx.lineTo(50, -30); ctx.quadraticCurveTo(64, -12, 52, 30);
    ctx.closePath(); ctx.fill();
    /* collar */
    ctx.fillStyle = '#0b1526';
    ctx.beginPath(); ctx.ellipse(0, -32, 52, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -32, 52, 12, 0, 0, TAU); ctx.stroke();
    /* heel pull tab */
    ctx.fillStyle = '#142338';
    roundRect(ctx, -10, -46, 20, 16, 5); ctx.fill();
    /* --- seed pod hatch --- */
    const hatchY = 4;
    /* inner compartment */
    ctx.fillStyle = '#060b16';
    roundRect(ctx, -34, hatchY - 26, 68, 30, 8); ctx.fill();
    if (pod > 0.1) {
      /* growing medium */
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, -34, hatchY - 26, 68, 30, 8);
      ctx.clip();
      ctx.fillStyle = '#173327';
      ctx.fillRect(-34, hatchY - 4, 68, 10);
      ctx.fillStyle = '#2c5a42';
      for (let i = 0; i < 9; i++) ctx.fillRect(-32 + i * 7.4, hatchY - 3 + Math.sin(i * 2.4) * 2, 3, 3);
      /* capsules peeking out */
      for (let i = 0; i < 2; i++) {
        const capX = -12 + i * 24 + (pod - 0.5) * 3;
        drawGlow(ctx, capX, hatchY - 12, 13, 'rgba(157,232,176,0.9)', pod);
        ctx.fillStyle = 'rgba(190,230,200,0.85)';
        roundRect(ctx, capX - 5, hatchY - 19, 10, 15, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(90,160,120,0.9)'; ctx.lineWidth = 1;
        roundRect(ctx, capX - 5, hatchY - 19, 10, 15, 5); ctx.stroke();
      }
      ctx.restore();
    }
    /* hatch shell (slides outward+up as it opens) */
    ctx.save();
    ctx.translate(0, -pod * 26);
    ctx.fillStyle = '#1a2c46';
    roundRect(ctx, -38, hatchY - 30, 76, 32, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.6)'; ctx.lineWidth = 1.2;
    roundRect(ctx, -38, hatchY - 30, 76, 32, 9); ctx.stroke();
    ctx.strokeStyle = 'rgba(143,211,255,0.3)';
    ctx.beginPath(); ctx.moveTo(-30, hatchY - 14); ctx.lineTo(30, hatchY - 14); ctx.stroke();
    ctx.restore();
    /* locking lever */
    ctx.save();
    ctx.translate(44, hatchY - 12);
    ctx.rotate(-pod * 0.9);
    ctx.fillStyle = pod > 0.5 ? '#9de8b0' : '#c8d4e2';
    roundRect(ctx, -3, -9, 6, 20, 3); ctx.fill();
    ctx.restore();
    /* status light */
    ctx.fillStyle = pod > 0.5 ? '#9de8b0' : '#ff7d7d';
    ctx.beginPath(); ctx.arc(0, -18, 2.6 + (pod > 0.5 ? Math.sin(t * 4) * 0.8 : 0), 0, TAU); ctx.fill();
    if (pod > 0.5) drawGlow(ctx, 0, -18, 12, 'rgba(157,232,176,0.9)', 0.8);
    ctx.restore();
  },

  drawShoeSole(ctx, cx, cy, s, o = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.12);
    ctx.scale(s, s);
    if (o.glow) drawGlow(ctx, 0, 0, 150, 'rgba(120,180,240,0.4)', o.glow * 0.7);
    /* sole outline */
    ctx.fillStyle = '#0e1a2e';
    ctx.beginPath();
    ctx.moveTo(-118, -8);
    ctx.quadraticCurveTo(-70, 26, 0, 30);
    ctx.quadraticCurveTo(80, 30, 118, -2);
    ctx.quadraticCurveTo(122, -12, 112, -16);
    ctx.quadraticCurveTo(60, 12, 0, 12);
    ctx.quadraticCurveTo(-70, 10, -108, -18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.55)'; ctx.lineWidth = 1.3;
    ctx.stroke();
    /* tread arcs */
    ctx.strokeStyle = 'rgba(143,211,255,0.3)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const ax = -80 + i * 34;
      ctx.beginPath();
      ctx.moveTo(ax, 6);
      ctx.quadraticCurveTo(ax + 16, 20, ax + 34, 6);
      ctx.stroke();
    }
    /* heel pod (circle) */
    ctx.strokeStyle = 'rgba(255,158,203,0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-78, 4, 17, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(-78, 4, 11, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,158,203,0.65)';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      ctx.beginPath(); ctx.arc(-78 + Math.cos(a) * 14, 4 + Math.sin(a) * 14, 1.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(210,230,250,0.55)';
    ctx.font = '9px Jost, sans-serif';
    ctx.fillText('REPLACEABLE POD', -116, 44);
    ctx.restore();
  },

  drawCapsuleView(ctx, cx, cy, s, spec, t, rot = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 0.8) * 0.05 + rot);
    ctx.scale(s, s);
    const w = 30, h = 84;
    /* glass body */
    const gg = ctx.createLinearGradient(-w, 0, w, 0);
    gg.addColorStop(0, 'rgba(140,190,240,0.10)');
    gg.addColorStop(0.5, 'rgba(190,225,255,0.22)');
    gg.addColorStop(1, 'rgba(140,190,240,0.10)');
    ctx.fillStyle = gg;
    roundRect(ctx, -w, -h, w * 2, h * 2, w); ctx.fill();
    ctx.strokeStyle = 'rgba(160,215,255,0.8)'; ctx.lineWidth = 1.4;
    roundRect(ctx, -w, -h, w * 2, h * 2, w); ctx.stroke();
    /* nutrient gel */
    const hue = spec ? spec.hue : 160;
    const gel = `hsla(${hue},60%,45%,0.5)`;
    ctx.save();
    roundRect(ctx, -w + 2, -h + 30, w * 2 - 4, h * 1.4, w - 2);
    ctx.clip();
    ctx.fillStyle = gel;
    ctx.fillRect(-w, 8, w * 2, h);
    ctx.fillStyle = `hsla(${hue},65%,60%,0.5)`;
    for (let i = 0; i < 7; i++) {
      const bx = -18 + hash1(i * 3 + hue) * 36;
      const by = 24 + hash1(i * 7 + hue) * 40 + Math.sin(t + i) * 2;
      ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    /* seed */
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath(); ctx.ellipse(0, -14, 6, 8, 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9de8b0'; ctx.lineWidth = 1.4;
    const spr = 5 + Math.sin(t * 2) * 1.5;
    ctx.beginPath(); ctx.moveTo(1, -21); ctx.quadraticCurveTo(3, -21 - spr, 6, -22 - spr); ctx.stroke();
    /* metal cap */
    ctx.fillStyle = '#31445e';
    roundRect(ctx, -w - 2, -h - 8, w * 2 + 4, 14, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(143,211,255,0.5)'; ctx.lineWidth = 1;
    roundRect(ctx, -w - 2, -h - 8, w * 2 + 4, 14, 7); ctx.stroke();
    /* shine */
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w * 0.55, -h * 0.72); ctx.lineTo(-w * 0.55, -h * 0.3); ctx.stroke();
    drawGlow(ctx, 0, 0, 80, 'rgba(160,215,255,0.5)', 0.35);
    ctx.restore();
  },

  drawShoeSil(ctx, x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    this.drawShoeProfile(ctx, x, y, s, { t: performance.now() / 1000, glow: 0.5 });
    ctx.restore();
  }
};

/* ============================================================
   WORLD DEFINITIONS (data + draw dispatch)
   ============================================================ */
const WORLD_DEFS = {
  forest: {
    key: 'forest', name: 'DARK FOREST', icon: '🌲',
    tag: 'Where the last lights still wander.',
    desc: 'Dead pines and cold fog. Somewhere between the shadows, small lights refuse to go out.',
    colors: ['#0a1c34', '#123055', '#1c4258'], amb: 'dark', width: 3000,
    preview: 'linear-gradient(160deg,#050b18,#0e2440 55%,#123055)',
    floatIcons: ['✦', '🌲', '﹅'],
    back: (c, cam, t, env) => Scenes.drawForest(c, cam, t, env),
    front: (c, cam, t, env) => Scenes.drawForestFront(c, cam, t, env),
    hotspots: [
      { x: 640, type: 'firefly', title: 'A Firefly', text: 'Somewhere between darkness and light, something is still alive.' },
      { x: 1220, type: 'vista', title: 'The Deep Woods', text: 'The trees lean in close, as if they remember being needed.' },
      { x: 1620, type: 'dying', title: 'A Dying Plant', text: 'Maybe it only needs a second chance.' },
      { x: 2380, type: 'plant', title: 'Bare Soil', text: 'Soft, dark ground. It is waiting for something to believe in.' },
      { x: 2820, type: 'gate', title: 'Trail\u2019s End', text: 'The forest opens. The journey continues beyond.' }
    ]
  },
  valley: {
    key: 'valley', name: 'MYSTERIOUS VALLEY', icon: '🏔️',
    tag: 'A moon that never sets.',
    desc: 'Layered ridges sleep under mist. A pale pond keeps the moon long after it has gone.',
    colors: ['#0e2438', '#16303c', '#1e4a4e'], amb: 'dark', width: 3000,
    preview: 'linear-gradient(160deg,#081628,#16303c 55%,#1e4a4e)',
    floatIcons: ['☾', '🏔️', '≈'],
    back: (c, cam, t, env) => Scenes.drawValley(c, cam, t, env),
    front: () => {},
    hotspots: [
      { x: 700, type: 'stone', title: 'A Mysterious Stone', text: 'Older than the trail. Older than the dark. It hums quietly to itself.' },
      { x: 1400, type: 'pool', title: 'Moonlit Water', text: 'The pond holds a second moon, in case the first one falls.' },
      { x: 1800, type: 'vista', title: 'Valley Overlook', text: 'Ridge behind ridge behind ridge. The world is deeper than it looks.' },
      { x: 2340, type: 'plant', title: 'Valley Soil', text: 'Moist earth, rich and patient.' },
      { x: 2820, type: 'gate', title: 'Trail\u2019s End', text: 'The valley exhales you onward.' }
    ]
  },
  abstract: {
    key: 'abstract', name: 'ABSTRACT NIGHT', icon: '◈',
    tag: 'The world forgets its own shape.',
    desc: 'Geometry drifts where a forest used to be. Circles rotate around questions nobody asked.',
    colors: ['#120e26', '#2c2450', '#3c2c5c'], amb: 'abstract', width: 2800,
    preview: 'linear-gradient(160deg,#0e0a20,#2c2450 55%,#3c2c5c)',
    floatIcons: ['◈', '◇', '○'],
    back: (c, cam, t, env) => Scenes.drawAbstract(c, cam, t, env),
    front: () => {},
    hotspots: [
      { x: 660, type: 'shape', title: 'A Floating Shape', text: 'It is not a tree. It is what a tree dreams of being.' },
      { x: 1300, type: 'vista', title: 'The Grid Horizon', text: 'Lines that go nowhere, beautifully.' },
      { x: 1960, type: 'stone', title: 'A Solid Thing', text: 'Solid. Real. Strangely comforting here.' },
      { x: 2280, type: 'plant', title: 'Impossible Soil', text: 'Even here, the ground is willing to try.' },
      { x: 2620, type: 'gate', title: 'Trail\u2019s End', text: 'The shapes bow as you pass.' }
    ]
  },
  dream: {
    key: 'dream', name: 'DREAM PATH', icon: '✿',
    tag: 'Walk softly here.',
    desc: 'A violet road lit by lantern-trees. Leaves fall upward, then change their mind.',
    colors: ['#241540', '#33204c', '#3c2c5c'], amb: 'dream', width: 3000,
    preview: 'linear-gradient(160deg,#1c1235,#33204c 55%,#4c3a64)',
    floatIcons: ['✿', '❀', '✦'],
    back: (c, cam, t, env) => Scenes.drawDream(c, cam, t, env),
    front: () => {},
    hotspots: [
      { x: 720, type: 'lantern', title: 'A Lantern Tree', text: 'Someone lit it for travelers they would never meet.' },
      { x: 1360, type: 'pool', title: 'A Pool of Quiet', text: 'You can almost hear what the world sounded like before.' },
      { x: 1880, type: 'vista', title: 'The Violet Horizon', text: 'The path curves toward something kinder.' },
      { x: 2400, type: 'plant', title: 'Dream Soil', text: 'Things planted here grow in more than one direction.' },
      { x: 2820, type: 'gate', title: 'Trail\u2019s End', text: 'The dream hands you gently onward.' }
    ]
  },
  bloom: {
    key: 'bloom', name: 'BLOOMING MOUNTAIN', icon: '⛰️',
    tag: 'The top of the long trail.',
    desc: 'Sunlight, at last. A wide green summit where the last seed is meant to rest.',
    colors: ['#4c8a54', '#ffd9a0', '#5aa668'], amb: 'bright', width: 3400,
    preview: 'linear-gradient(160deg,#274a66,#8fb0c4 50%,#5f9460)',
    floatIcons: ['☀', '⛰️', '❀'],
    back: (c, cam, t, env) => Scenes.drawBloom(c, cam, t, env),
    front: () => {},
    hotspots: [
      { x: 760, type: 'vista', title: 'The Mountain', text: 'The trail continues.' },
      { x: 1420, type: 'lantern', title: 'A Waymarker', text: 'Someone climbed this far before you. They left the light burning.' },
      { x: 2000, type: 'stone', title: 'Summit Stone', text: 'Wind-worn and warm. It has been waiting a long time.' },
      { x: 2600, type: 'plant', title: 'The Final Soil', text: 'One last capsule. One last gift. The whole mountain is listening.', final: true },
      { x: 3180, type: 'gate', title: 'Beyond', text: 'There is nothing left to climb. Only something to leave behind.' }
    ]
  }
};
