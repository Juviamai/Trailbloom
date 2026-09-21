'use strict';
/* ============================================================
   TRAILBLOOM — utils.js
   Math, easing, DOM helpers, tween engine, canvas helpers.
   ============================================================ */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const dist  = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const hash1 = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const ease = {
  linear: t => t,
  in:     t => t * t,
  out:    t => 1 - Math.pow(1 - t, 3),
  inOut:  t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outBack:t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const delay = ms => new Promise(r => setTimeout(r, ms));
const el = (tag, cls, html) => {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
};

/* ---------- tiny promise tween engine ---------- */
const _tweens = [];
function tween(obj, props, dur, easeName = 'inOut') {
  return new Promise(res => {
    const start = {};
    for (const k in props) start[k] = obj[k];
    _tweens.push({ obj, props, start, dur: Math.max(dur, 0.001), e: 0, fn: ease[easeName] || ease.inOut, res });
  });
}
function updateTweens(dt) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    const tw = _tweens[i];
    tw.e += dt;
    const t = clamp(tw.e / tw.dur, 0, 1);
    const v = tw.fn(t);
    for (const k in tw.props) tw.obj[k] = lerp(tw.start[k], tw.props[k], v);
    if (t >= 1) { _tweens.splice(i, 1); tw.res(); }
  }
}
function killTweensOf(obj) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    if (_tweens[i].obj === obj) { const tw = _tweens.splice(i, 1)[0]; tw.res(); }
  }
}

/* ---------- canvas helpers ---------- */
let DPR = 1;
function fitCanvas(cv) {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* cached radial-glow sprite per color (cheap glow dots) */
const _glowCache = {};
function glowSprite(color) {
  if (_glowCache[color]) return _glowCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _glowCache[color] = c;
  return c;
}
function drawGlow(ctx, x, y, r, color, alpha = 1) {
  const s = glowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
