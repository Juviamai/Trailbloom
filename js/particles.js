'use strict';
/* ============================================================
   TRAILBLOOM — particles.js
   Particle pool, fireflies, ripples, butterflies.
   ============================================================ */

const Particles = {
  list: [], density: 1, MAX: 650,

  add(p) {
    const cap = this.MAX * Math.max(this.density, 0.4) + 160;
    if (this.list.length < cap) this.list.push(p);
  },

  spark(x, y, color = 'rgba(143,211,255,0.9)', n = 12, sp = 2.3) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(0.35, 1) * sp;
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.35,
        life: rand(0.45, 1.15), t: 0, size: rand(1, 3), color });
    }
  },
  trail(x, y, color = 'rgba(180,230,255,0.8)') {
    this.add({ type: 'spark', x, y, vx: rand(-0.25, 0.25), vy: rand(-0.1, 0.2),
      life: rand(0.5, 1), t: 0, size: rand(1, 2.4), color });
  },
  leafBurst(x, y, n = 8, colors = ['#7fae6f', '#a8c98a', '#5d8f63']) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(0.5, 1.6);
      this.add({ type: 'leaf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5,
        life: rand(1.6, 3), t: 0, size: rand(3, 6), color: colors[randi(0, colors.length - 1)],
        phase: rand(TAU), rot: rand(TAU), spin: rand(-2, 2) });
    }
  },
  petalRain(x, y, n = 10, color = '#ff9ecb') {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'petal', x: x + rand(-90, 90), y: y + rand(-40, 10),
        vx: rand(-0.4, 0.4), vy: rand(0.2, 0.7), life: rand(2.5, 4.5), t: 0,
        size: rand(2.5, 5), color, phase: rand(TAU), rot: rand(TAU), spin: rand(-1.5, 1.5) });
    }
  },
  pollen(x, y, n = 5, color = 'rgba(255,225,160,0.85)') {
    for (let i = 0; i < n; i++) {
      this.add({ type: 'pollen', x: x + rand(-60, 60), y: y + rand(-20, 20),
        vx: rand(-0.12, 0.12), vy: rand(-0.22, -0.05), life: rand(2.5, 5), t: 0,
        size: rand(1, 2.2), color, phase: rand(TAU) });
    }
  },

  update(dt) {
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.type === 'spark') { p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy = p.vy * 0.95 + 0.015; }
      else if (p.type === 'leaf' || p.type === 'petal') {
        p.phase += dt * 2.2;
        p.x += p.vx + Math.sin(p.phase) * 0.55;
        p.y += p.vy;
        p.vy = Math.min(p.vy + 0.006, 0.85);
        p.rot += (p.spin || 1) * dt;
        if (p.burst) { p.vx *= 0.96; p.vy *= 0.97; }
      }
      else if (p.type === 'pollen') {
        p.phase += dt * 1.6;
        p.x += p.vx + Math.sin(p.phase) * 0.18;
        p.y += p.vy;
      }
      if (p.t >= p.life || p.y > H + 30 || p.x < -40 || p.x > W + 40) this.list.splice(i, 1);
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      if (p.type === 'spark') {
        drawGlow(ctx, p.x, p.y, p.size * 3.2, p.color, k * 0.9);
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 0.7, p.y - 0.7, 1.4, 1.4);
        ctx.globalAlpha = 1;
      } else if (p.type === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, k * 2) * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.type === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0.4, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.type === 'pollen') {
        const a = (0.4 + 0.6 * Math.abs(Math.sin(p.phase))) * Math.min(1, k * 2);
        drawGlow(ctx, p.x, p.y, p.size * 3, p.color, a);
      }
    }
  }
};

/* ============================================================ */
const Ripples = {
  list: [],
  add(x, y, maxR = 56, color = 'rgba(160,220,255,') { this.list.push({ x, y, r: 2, maxR, t: 0, life: 1.4, color }); },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.t += dt;
      r.r = (r.t / r.life) * r.maxR;
      if (r.t >= r.life) this.list.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const r of this.list) {
      const k = 1 - r.t / r.life;
      ctx.strokeStyle = r.color + (k * 0.7) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, TAU);
      ctx.stroke();
    }
  }
};

/* ============================================================ */
class Fireflies {
  constructor(n = 0) { this.a = []; this.n = 0; this.setCount(n); }
  setCount(n) {
    n = Math.round(n);
    if (n === this.n) return;
    while (this.a.length < n) {
      this.a.push({ x: rand(window.innerWidth), y: rand(window.innerHeight * 0.18, window.innerHeight * 0.74),
        vx: 0, vy: 0, ph: rand(TAU), sp: rand(0.12, 0.4), hue: rand() < 0.85 ? 'rgba(190,235,150,' : 'rgba(160,215,255,' });
    }
    if (this.a.length > n) this.a.length = n;
    this.n = n;
  }
  update(dt, px, py, camDx) {
    const t = performance.now() / 1000;
    for (const f of this.a) {
      f.ph += dt * rand(0.6, 1.4);
      f.vx += Math.cos(f.ph * 0.8 + f.y * 0.01) * f.sp * dt * 2.2;
      f.vy += Math.sin(f.ph * 0.6 + f.x * 0.01) * f.sp * dt * 1.8;
      /* flee from the player */
      const d = dist(f.x, f.y, px, py);
      if (d < 120 && d > 0.01) {
        const k = (1 - d / 120) * 3.4;
        f.vx += ((f.x - px) / d) * k * dt * 26;
        f.vy += ((f.y - py) / d) * k * dt * 26;
      }
      f.vx = clamp(f.vx, -1.4, 1.4) * 0.985;
      f.vy = clamp(f.vy, -1, 1) * 0.985;
      f.x += f.vx + camDx * 0.85;
      f.y += f.vy;
      if (f.x < -30) f.x = window.innerWidth + 20;
      if (f.x > window.innerWidth + 30) f.x = -20;
      f.y = clamp(f.y, window.innerHeight * 0.12, window.innerHeight * 0.8);
    }
  }
  attract(x, y, k = 0.06) {
    for (const f of this.a) {
      f.vx += (x - f.x) * k * 0.02;
      f.vy += (y - f.y) * k * 0.02;
    }
  }
  draw(ctx, t) {
    for (const f of this.a) {
      const pulse = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(t * 1.1 + f.ph * 3)), 2.2);
      drawGlow(ctx, f.x, f.y, 9 + pulse * 7, f.hue + '0.85)', pulse * 0.85);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = f.hue + '1)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/* ============================================================ */
const Butterflies = {
  list: [], n: 0,
  ensure(n) {
    n = Math.round(n);
    if (n === this.n) return;
    while (this.list.length < n) {
      this.list.push({ x: rand(window.innerWidth), y: rand(window.innerHeight * 0.3, window.innerHeight * 0.66),
        tx: rand(window.innerWidth), ty: rand(window.innerHeight * 0.3, window.innerHeight * 0.66),
        ph: rand(TAU), sp: rand(0.5, 1), col: ['#ffd9a0', '#ff9ecb', '#a8d8ff'][randi(0, 2)] });
    }
    if (this.list.length > n) this.list.length = n;
    this.n = n;
  },
  update(dt) {
    for (const b of this.list) {
      b.ph += dt * 9;
      const d = dist(b.x, b.y, b.tx, b.ty);
      if (d < 14) { b.tx = rand(window.innerWidth); b.ty = rand(window.innerHeight * 0.25, window.innerHeight * 0.68); }
      b.x += ((b.tx - b.x) / Math.max(d, 30)) * b.sp;
      b.y += ((b.ty - b.y) / Math.max(d, 30)) * b.sp + Math.sin(b.ph * 0.32) * 0.35;
    }
  },
  draw(ctx) {
    for (const b of this.list) {
      const flap = Math.abs(Math.sin(b.ph));
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = b.col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(-3.4 * flap - 1, -1, 3.6 * (0.4 + flap * 0.6), 2.4, -0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(3.4 * flap + 1, -1, 3.6 * (0.4 + flap * 0.6), 2.4, 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,30,40,0.9)';
      ctx.fillRect(-0.7, -2.6, 1.4, 5);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
};
