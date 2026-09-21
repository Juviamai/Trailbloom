'use strict';
/* ============================================================
   TRAILBLOOM — audio.js
   Fully synthesized sound design via WebAudio (no assets).
   UI blips, world ambience beds, cinematic stingers.
   ============================================================ */

const AudioSys = {
  ctx: null, master: null, vol: 0.75, muted: false,
  _ambOut: null, _ambSrcs: [], _ambName: null, _chirpT: null, _chirpT2: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    this.master.connect(this.ctx.destination);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVol(v) { this.vol = v; if (this.master && !this.muted) this.master.gain.value = v; },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.vol;
  },
  t() { return this.ctx ? this.ctx.currentTime : 0; },

  /* ---------- primitives ---------- */
  blip(f = 600, d = 0.12, type = 'sine', v = 0.18, at = 0, slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, f), t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + d + 0.06);
  },
  _noiseBuf: null,
  noiseBuf() {
    if (!this._noiseBuf) {
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = b;
    }
    return this._noiseBuf;
  },
  noise(d = 0.3, f = 800, v = 0.15, type = 'lowpass', at = 0, slideTo = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type;
    fl.frequency.setValueAtTime(Math.max(40, f), t0);
    if (slideTo) fl.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t0); s.stop(t0 + d + 0.1);
  },

  /* ---------- one-shots ---------- */
  click()     { this.blip(720, 0.07, 'sine', 0.13); this.blip(1080, 0.09, 'sine', 0.07, 0.035); },
  softClick() { this.blip(560, 0.06, 'sine', 0.08); },
  hover()     { this.blip(1500, 0.045, 'sine', 0.022); },
  whoosh()    { this.noise(0.5, 380, 0.11, 'bandpass', 0, 1700); },
  chime()     { this.blip(880, 0.5, 'sine', 0.09); this.blip(1318, 0.7, 'sine', 0.045, 0.03); this.blip(1760, 0.9, 'sine', 0.028, 0.07); },
  firefly()   { this.blip(rand(1500, 2100), 0.28, 'sine', 0.02); },
  step(run)   { this.noise(run ? 0.08 : 0.13, run ? 520 : 300, run ? 0.045 : 0.03, 'lowpass'); },
  pod()       { this.blip(300, 0.06, 'square', 0.045); this.blip(180, 0.09, 'square', 0.035, 0.1); this.noise(0.4, 950, 0.05, 'bandpass', 0.18, 220); },
  plant()     { this.blip(150, 0.32, 'sine', 0.2, 0, -70); this.noise(0.22, 620, 0.07, 'lowpass', 0.02); this.blip(1046, 0.6, 'sine', 0.05, 0.28); this.blip(1568, 0.8, 'sine', 0.028, 0.36); },
  bloom()     { [523, 659, 784, 1046, 1318].forEach((f, i) => this.blip(f, 0.85, 'sine', 0.06, i * 0.09)); },
  achievement(){ this.blip(784, 0.32, 'sine', 0.08); this.blip(1174, 0.55, 'sine', 0.06, 0.13); },
  shutter()   { this.noise(0.05, 2600, 0.14, 'highpass'); this.blip(1250, 0.035, 'square', 0.05, 0.025); },
  transition(){ this.noise(1.25, 300, 0.09, 'lowpass', 0, 2400); this.blip(196, 1.5, 'sine', 0.05, 0.1); this.blip(294, 1.7, 'sine', 0.035, 0.3); },
  heartbeat() { this.blip(70, 0.2, 'sine', 0.16); this.blip(66, 0.24, 'sine', 0.13, 0.28); },

  /* ---------- ambient world beds ---------- */
  ambient(name) {
    this.init();
    if (!this.ctx || this._ambName === name) return;
    this._ambName = name;
    this.stopAmbient();
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);
    this._ambOut = out; this._ambSrcs = [];
    out.gain.setTargetAtTime(1, c.currentTime, 1.6);

    const reg = n => { this._ambSrcs.push(n); return n; };
    const wind = (freq, vol, type = 'lowpass') => {
      const s = reg(c.createBufferSource()); s.buffer = this.noiseBuf(); s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const lfo = reg(c.createOscillator()); lfo.frequency.value = 0.05 + Math.random() * 0.06;
      const lg = c.createGain(); lg.gain.value = freq * 0.45;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      const g = c.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(out); s.start();
    };
    const drone = (f, vol, type = 'sine') => {
      const o = reg(c.createOscillator()); o.type = type; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(out); o.start();
    };

    if (name === 'dark') {
      wind(300, 0.045); drone(52, 0.026);
      this._chirpT = setInterval(() => { if (Math.random() < 0.65) this.firefly(); }, 5200);
    } else if (name === 'dream') {
      wind(520, 0.04); drone(65, 0.02); drone(130, 0.011, 'triangle');
      this._chirpT = setInterval(() => { this.blip(rand(880, 1400), 0.7, 'sine', 0.016); }, 7400);
    } else if (name === 'abstract') {
      wind(820, 0.017, 'bandpass'); drone(110, 0.014, 'triangle'); drone(164.8, 0.007);
      this._chirpT = setInterval(() => {
        const f = rand(500, 900);
        this.blip(f, 0.5, 'sine', 0.026);
        this.blip(f, 0.4, 'sine', 0.013, 0.34);
        this.blip(f, 0.3, 'sine', 0.006, 0.68);
      }, 4600);
    } else if (name === 'bright') {
      wind(700, 0.028); drone(196, 0.006);
      this._chirpT = setInterval(() => {
        const n = randi(2, 4), f0 = rand(1800, 3200);
        for (let i = 0; i < n; i++) this.blip(f0 * rand(0.92, 1.22), 0.09, 'sine', 0.024, i * 0.13, f0 * 0.4);
      }, 3800);
      this._chirpT2 = setInterval(() => { if (Math.random() < 0.5) this.blip(rand(300, 520), 0.22, 'sine', 0.015); }, 6200);
    }
  },
  stopAmbient() {
    if (this._chirpT)  { clearInterval(this._chirpT);  this._chirpT = null; }
    if (this._chirpT2) { clearInterval(this._chirpT2); this._chirpT2 = null; }
    if (this._ambSrcs) this._ambSrcs.forEach(s => { try { s.stop(0); } catch (e) {} });
    if (this._ambOut) {
      const g = this._ambOut.gain, t = this.t();
      try { g.cancelScheduledValues(t); g.setTargetAtTime(0.0001, t, 0.35); } catch (e) {}
      const o = this._ambOut;
      setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 1400);
    }
    this._ambSrcs = null; this._ambOut = null; this._ambName = null;
  },
  duck(level, tc = 0.8) {
    if (this._ambOut) {
      const t = this.t();
      try { this._ambOut.gain.cancelScheduledValues(t); this._ambOut.gain.setTargetAtTime(level, t, tc); } catch (e) {}
    }
  }
};
