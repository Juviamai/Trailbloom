'use strict';
/* ============================================================
   TRAILBLOOM — game.js
   Engine: world state, movement, proximity & contextual actions,
   interaction focus mode, planting cinematic, final sequence,
   photo mode, progress / achievements / memories, save-load.
   ============================================================ */

const PHOTO_FILTERS = {
  DREAM:    'saturate(1.35) hue-rotate(-12deg) brightness(1.06) contrast(0.96)',
  NIGHT:    'brightness(0.6) saturate(1.15) hue-rotate(200deg) contrast(1.1)',
  WARM:     'sepia(0.35) saturate(1.25) brightness(1.08)',
  BLOOM:    'saturate(1.55) hue-rotate(-28deg) brightness(1.12) contrast(1.02)',
  ABSTRACT: 'hue-rotate(80deg) saturate(1.6) contrast(1.15)'
};

const ACH = {
  first:  { icon: '🌱', name: 'FIRST SEED',       text: 'Something has begun.' },
  light:  { icon: '✨', name: 'LIGHT IN THE DARK', text: 'You found the first light.' },
  growth: { icon: '🌿', name: 'GROWTH',            text: 'You helped the world recover.' },
  trail:  { icon: '🏔️', name: 'THE LONG TRAIL',   text: 'You kept moving forward.' },
  bloom:  { icon: '🌸', name: 'BLOOM',             text: 'You left something alive behind.' }
};
const MEMORIES = {
  meet:     { title: 'First Meeting',        sub: 'Two travelers, one quiet road.' },
  forest:   { title: 'Dark Forest',          sub: 'The lights that refused to go out.' },
  seed:     { title: 'The First Seed',       sub: 'Something has begun.' },
  abstract: { title: 'The Abstract World',   sub: 'Where the world forgot its shape.' },
  mountain: { title: 'The Blooming Mountain', sub: 'Sunlight, at last.' }
};
const DIALOGUES = {
  juvia: [
    { w: 'JUVIA', t: 'Do you think one seed can really change anything?' },
    { w: 'GRAY',  t: "I don't know." },
    { w: 'GRAY',  t: "But it's better than leaving nothing behind." }
  ],
  gray: [
    { w: 'GRAY',  t: 'We keep walking forward.' },
    { w: 'JUVIA', t: 'And leave something behind?' },
    { w: 'GRAY',  t: 'Something worth growing.' }
  ]
};
const IDLE_LINES = {
  juvia: [
    "Juvia likes it here. It is quiet — but it isn't empty.",
    'The fireflies follow us, you know.',
    'When the wind stops, Juvia can almost hear the old forest.'
  ],
  gray: [
    'Keep moving. Standing still makes it colder.',
    'Two sets of footprints. That is already something.',
    'The dark is honest, at least.'
  ]
};

const Game = {
  state: 'boot',            // boot | intro | menu | world | ending
  world: null,              // active WORLD_DEFS entry
  worldKey: null,
  paused: false,
  inputLock: false,
  time: 0,
  W: window.innerWidth, H: window.innerHeight,

  cam: { fx: 0, z: 1, follow: true, offset: 0 },
  walker: { x: 200, target: null, run: false, walkPh: 0 },
  gray:  { x: 240, tx: 240, walkPh: 0, moving: false, dir: 1, glowT: 0 },
  juvia: { x: 160, tx: 160, wanderT: 0, walkPh: 0, moving: false, dir: 1, glowT: 0 },
  leaderState: null,        // {key, targetX}
  keys: {},

  hotspots: [], near: null, nearChar: null,
  focusObj: null,
  cine: null,
  planting: false,
  stepT: 0,
  fireflies: new Fireflies(0),
  _ffBase: 0,
  ambT: 0, gateCool: 0, rippleT: 0,

  photo: { on: false, filter: null },
  mouse: { x: 0, y: 0 },

  /* ---------- persistence ---------- */
  visited: {}, plantedWorlds: {}, flora: {},
  plantedTotal: 0, light: 0, ended: false,
  achievements: {}, memoriesUnlocked: {},

  save() {
    try {
      localStorage.setItem('trailbloom_save', JSON.stringify({
        v: 1, visited: this.visited, plantedWorlds: this.plantedWorlds,
        plantedTotal: this.plantedTotal, light: this.light, ended: this.ended,
        achievements: this.achievements, memories: this.memoriesUnlocked,
        settings: { vol: AudioSys.vol, muted: AudioSys.muted, particles: Particles.density }
      }));
    } catch (e) {}
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem('trailbloom_save'));
      if (!d || d.v !== 1) return;
      this.visited = d.visited || {};
      this.plantedWorlds = d.plantedWorlds || {};
      this.plantedTotal = d.plantedTotal || 0;
      this.light = d.light || 0;
      this.ended = !!d.ended;
      this.achievements = d.achievements || {};
      this.memoriesUnlocked = d.memories || {};
      if (d.settings) {
        AudioSys.vol = d.settings.vol != null ? d.settings.vol : 0.75;
        AudioSys.muted = !!d.settings.muted;
        Particles.density = d.settings.particles || 1;
      }
    } catch (e) {}
  },
  resetSave() {
    try { localStorage.removeItem('trailbloom_save'); } catch (e) {}
  },

  boot() {
    this.load();
    this.W = window.innerWidth; this.H = window.innerHeight;
  },

  /* ---------- helpers ---------- */
  groundY() { return this.H * 0.74; },
  project(wx, wy) {
    const cx = this.W / 2, cyF = this.H * 0.62, z = this.cam.z;
    const sx = (wx - (this.cam.fx + this.cam.offset)) + cx;
    return { x: (sx - cx) * z + cx, y: (wy - cyF) * z + cyF };
  },

  progress() {
    let p = 0;
    p += Math.min(Object.keys(this.visited).length, 5) * 8;
    p += Math.min(this.plantedTotal, 5) * 8;
    if (this.ended) p += 20;
    return Math.min(100, Math.round(p));
  },
  milestones() {
    return [
      { key: 'discovery', label: 'DISCOVERY', done: Object.keys(this.visited).length >= 1 },
      { key: 'firstseed', label: 'FIRST SEED', done: this.plantedTotal >= 1 },
      { key: 'newlife',   label: 'NEW LIFE',   done: this.plantedTotal >= 2 },
      { key: 'finaltrail',label: 'THE FINAL TRAIL', done: Object.keys(this.visited).length >= 5 },
      { key: 'bloom',     label: 'BLOOM',      done: this.ended }
    ];
  },
  achieve(key) {
    if (this.achievements[key]) return;
    this.achievements[key] = true;
    AudioSys.achievement();
    UI.toast(ACH[key]);
    this.save();
  },
  unlockMemory(key) {
    if (this.memoriesUnlocked[key]) return;
    this.memoriesUnlocked[key] = true;
    this.save();
  },

  /* ================= WORLD FLOW ================= */
  transModeFor(nextKey) {
    const prev = this.worldKey;
    if (nextKey === 'abstract') return 'portal';
    if (prev === 'abstract') return 'dissolve';
    if (nextKey === 'bloom') return 'bloom';
    return 'dark';
  },
  async enterWorld(key) {
    const def = WORLD_DEFS[key];
    if (!def) return;
    UI.closeAllOverlays();
    await UI.transition(this.transModeFor(key), () => this._setupWorld(key));
  },
  _setupWorld(key) {
    const def = WORLD_DEFS[key];
    this.worldKey = key;
    this.world = def;
    this.hotspots = def.hotspots.map(h => Object.assign({}, h));
    /* restore planted flags from the save */
    if (this.plantedWorlds[key]) {
      for (const h of this.hotspots) if (h.type === 'plant') h.planted = true;
    }
    this.state = 'world';
    this.walker.x = 200; this.walker.target = null;
    this.gray.x = 250; this.gray.tx = 250;
    this.juvia.x = 140; this.juvia.tx = 140;
    this.cam.fx = 260; this.cam.z = 1; this.cam.follow = true; this.cam.offset = 0;
    this.focusObj = null; this.cine = null; this.planting = false; this.inputLock = false;
    this.gateCool = 0;
    $('#scene').classList.remove('blurred');

    if (!this.visited[key]) {
      this.visited[key] = true;
      this.unlockMemory(key === 'forest' ? 'forest' : key === 'abstract' ? 'abstract' : key === 'bloom' ? 'mountain' : null);
      if (Object.keys(this.visited).length === 1) this.unlockMemory('meet');
      if (Object.keys(this.visited).length >= 5) this.achieve('trail');
      this.save();
    }
    AudioSys.ambient(def.amb);
    UI.show(null);
    UI.hud(true);
    this._ffBase = { forest: 22, valley: 16, abstract: 12, dream: 14, bloom: 7 }[key] || 14;
    this._lastActions = null;
    this.refreshActions(true);
    UI.progressRefresh();
  },

  toMap() {
    if (this.state !== 'world') return;
    this.state = 'map';
    UI.hud(false);
    UI.hidePrompt();
    UI.setActions([]);
    AudioSys.whoosh();
    UI.show('scr-map', () => { this.state = 'world'; UI.hud(true); this.refreshActions(true); });
    UI.mapRefresh();
  },

  /* ================= UPDATE ================= */
  update(dt) {
    this.time += dt;
    this.W = window.innerWidth; this.H = window.innerHeight;
    updateTweens(dt);

    if (this.gray.glowT > 0) this.gray.glowT -= dt;
    if (this.juvia.glowT > 0) this.juvia.glowT -= dt;

    if (this.state === 'world' && !this.paused) this.updateWorld(dt);
    if (this.state === 'menu' || this.state === 'intro') this.updateMenuAmbient(dt);
    if (this.state === 'ending') {
      /* keep the world softly alive behind the final text */
      const camDx = -(this.cam.fx - (this._lastFx || this.cam.fx));
      this._lastFx = this.cam.fx;
      this.fireflies.update(dt, -9999, -9999, camDx);
      if (this.cine && this.cine.converge) this.fireflies.attract(this.cine.converge.x, this.cine.converge.y);
      Butterflies.update(dt);
    }

    /* photo mode gentle camera pan */
    if (this.photo.on && this.state === 'world') {
      const px = (this.mouse.x / this.W - 0.5) * 2;
      this.cam.offset = lerp(this.cam.offset, px * 60, 0.04);
    }
  },

  updateMenuAmbient(dt) {
    const want = this.state === 'menu' ? 16 + this.light * 12 : this.fireflies.a.length;
    this.fireflies.setCount(Math.max(want, this.fireflies.a.length));
  },

  updateWorld(dt) {
    const w = this.walker, gy = this.groundY();
    const speed = w.run ? 300 : 165;
    let moving = false;

    if (!this.inputLock) {
      let dir = 0;
      if (this.keys['a'] || this.keys['arrowleft']) dir -= 1;
      if (this.keys['d'] || this.keys['arrowright']) dir += 1;
      if (dir !== 0) { this.cancelFollow(); w.target = null; }
      if (dir !== 0) {
        w.x += dir * speed * dt;
        moving = true;
      } else if (w.target != null) {
        const dx = w.target - w.x;
        if (Math.abs(dx) < 12) { w.target = null; }
        else { w.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt); moving = true; }
      }
      /* follow-mode: walker trails the leader */
      if (this.leaderState) {
        const lead = this.leaderState.key === 'juvia' ? this.juvia : this.gray;
        const tx = lead.x - (this.leaderState.key === 'juvia' ? 90 : -90);
        const dx = tx - w.x;
        if (Math.abs(dx) > 14) { w.x += Math.sign(dx) * Math.min(Math.abs(dx), 150 * dt); moving = true; }
      }
    }
    w.x = clamp(w.x, 90, this.world.width - 120);
    if (moving) {
      w.walkPh += dt * (w.run ? 13 : 8.5);
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = w.run ? 0.24 : 0.38;
        AudioSys.step(w.run);
        const p = this.project(w.x, gy + 6);
        Particles.spark(p.x, p.y, 'rgba(140,160,190,0.35)', 3, 0.7);
      }
    }

    /* camera */
    if (this.cam.follow) {
      this.cam.fx = lerp(this.cam.fx, w.x, 1 - Math.pow(0.001, dt));
      this.cam.fx = clamp(this.cam.fx, 320, this.world.width - 320);
      if (!this.photo.on) this.cam.offset = lerp(this.cam.offset, 0, 0.05);
    }

    /* companions */
    this.updateChar(this.gray, dt, () => {
      if (this.leaderState && this.leaderState.key === 'gray') return this.leaderState.targetX;
      return w.x + 46;
    }, 150);
    this.updateChar(this.juvia, dt, () => {
      if (this.leaderState && this.leaderState.key === 'juvia') return this.leaderState.targetX;
      this.juvia.wanderT -= dt;
      if (this.juvia.wanderT <= 0 && (!this.leaderState)) {
        this.juvia.wanderT = rand(5, 10);
        this.juvia._wander = rand(-1, 1) > 0 ? rand(70, 210) : -rand(70, 210);
      }
      return w.x - 44 + (this.juvia._wander || 0);
    }, 120);

    /* leader arrival */
    if (this.leaderState) {
      const lead = this.leaderState.key === 'juvia' ? this.juvia : this.gray;
      if (Math.abs(lead.x - this.leaderState.targetX) < 16) {
        const key = this.leaderState.key;
        this.leaderState = null;
        AudioSys.chime();
        const p = this.project(lead.x, gy - 60);
        Particles.spark(p.x, p.y, 'rgba(180,220,255,0.8)', 12, 1.4);
        UI.dialogue([{ w: key.toUpperCase(), t: key === 'juvia' ? 'Here. This place has been waiting.' : 'This is the place. I can feel it.' }]);
      }
    }

    /* proximity */
    if (!this.inputLock && !this.focusObj) this.updateProximity();

    /* gate auto-map */
    this.gateCool -= dt;
    const gate = this.hotspots.find(h => h.type === 'gate');
    if (gate && !this.inputLock && this.gateCool <= 0 && Math.abs(w.x - gate.x) < 90) {
      this.gateCool = 6;
      UI.toastText('THE TRAIL CONTINUES', 'New worlds wait beyond the gate.');
    }

    /* fireflies count & update */
    const ffWant = Math.min(46, this._ffBase + (this.plantedWorlds[this.worldKey] ? 7 : 0) + Math.round(this.light * 12) + (this.ended ? 8 : 0));
    this.fireflies.setCount(Math.round(ffWant * Particles.density));
    const wp = this.project(w.x, gy - 40);
    const camDx = -(this.cam.fx - (this._lastFx || this.cam.fx));
    this._lastFx = this.cam.fx;
    this.fireflies.update(dt, wp.x, wp.y, camDx * 0.85);
    if (this.cine && this.cine.converge) {
      this.fireflies.attract(this.cine.converge.x, this.cine.converge.y);
    }

    /* ambient particles per world */
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = rand(0.6, 1.6);
      const k = this.worldKey;
      if (k === 'forest' && Math.random() < 0.4) Particles.leafBurst(rand(this.W), -10, 1, ['#26343c', '#33424a']);
      if (k === 'dream' && Math.random() < 0.6) Particles.petalRain(rand(this.W), -10, 2, Math.random() < 0.5 ? '#c79ede' : '#ff9ecb');
      if (k === 'bloom') {
        if (Math.random() < 0.7) Particles.pollen(rand(this.W), gy + rand(-30, 60), 3);
        Butterflies.ensure(Math.round((4 + this.light * 8) * Particles.density));
      } else Butterflies.ensure(0);
      if (k === 'abstract' && Math.random() < 0.5) Particles.spark(rand(this.W), rand(this.H * 0.6), 'rgba(170,140,255,0.5)', 3, 0.8);
    }
    Butterflies.update(dt);

    /* water ripples when near pond (valley) */
    if (this.worldKey === 'valley') {
      this.rippleT -= dt;
      if (Math.abs(w.x - 1800) < 260 && this.rippleT <= 0) {
        this.rippleT = 0.9;
        const p = this.project(w.x + rand(-60, 60), gy + 8);
        Ripples.add(p.x, p.y, 40, 'rgba(160,210,255,');
      }
    }

    /* prompt position */
    if (this.near && !this.focusObj && !this.cine) {
      const p = this.project(this.near.x, gy - 78);
      UI.prompt(p.x, p.y, this.promptLabel(this.near));
    } else UI.hidePrompt();

    /* compass */
    UI.setCompass(this.compassAngle());
  },

  updateChar(ch, dt, targetFn, speed) {
    const tx = clamp(targetFn(), 70, this.world.width - 110);
    const dx = tx - ch.x;
    if (Math.abs(dx) > 12) {
      ch.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      ch.moving = true;
      ch.walkPh += dt * 7.5;
      ch.dir = Math.sign(dx);
    } else { ch.moving = false; }
    if (!ch.moving) ch.dir = Math.sign(this.walker.x - ch.x) || 1;
  },

  updateProximity() {
    const w = this.walker;
    /* characters first */
    this.nearChar = null;
    if (Math.abs(w.x - this.juvia.x) < 130) this.nearChar = 'juvia';
    else if (Math.abs(w.x - this.gray.x) < 130) this.nearChar = 'gray';

    let best = null, bd = 1e9;
    for (const h of this.hotspots) {
      const d = Math.abs(w.x - h.x);
      const rng = h.type === 'gate' ? 110 : 155;
      if (d < rng && d < bd) { bd = d; best = h; }
    }
    this.near = best;
    this.refreshActions();
  },

  promptLabel(h) {
    if (h.type === 'plant') {
      if (h.planted) return 'OBSERVE';
      return h.final ? 'PLANT THE LAST SEED' : 'PLANT SEED';
    }
    return 'INTERACT';
  },

  refreshActions(force) {
    if (this.state !== 'world' || this.inputLock || this.cine) return;
    let list = [];
    if (this.nearChar === 'juvia') {
      list = [
        { label: 'TALK TO JUVIA', cb: () => this.talk('juvia'), primary: true },
        { label: 'FOLLOW JUVIA', cb: () => this.followChar('juvia') }
      ];
    } else if (this.nearChar === 'gray') {
      list = [
        { label: 'TALK TO GRAY', cb: () => this.talk('gray'), primary: true },
        { label: 'FOLLOW GRAY', cb: () => this.followChar('gray') }
      ];
    } else if (this.near) {
      const h = this.near;
      if (h.type === 'plant' && !h.planted) {
        if (h.final && this.plantedTotal < 4) {
          list = [
            { label: 'OBSERVE', cb: () => UI.toastText('NOT YET', 'Some seeds are still with you. The trail is not finished.') }
          ];
        } else {
          list = [
            { label: h.final ? 'PLANT THE LAST SEED' : 'PLANT SEED', cb: () => this.tryPlant(h), primary: true },
            { label: 'OBSERVE', cb: () => this.interact(h) }
          ];
        }
      } else if (h.type === 'gate') {
        list = [{ label: 'OPEN MAP', cb: () => this.toMap(), primary: true }];
      } else {
        list = [
          { label: 'INTERACT', cb: () => this.interact(h), primary: true },
          { label: 'OBSERVE', cb: () => this.interact(h) }
        ];
      }
    } else {
      list = [
        { label: 'EXPLORE', cb: () => this.explore() },
        { label: this.walker.run ? 'WALK' : 'RUN', cb: () => { this.walker.run = !this.walker.run; this.refreshActions(true); } },
        { label: 'LOOK AROUND', cb: () => this.lookAround() }
      ];
    }
    const sig = list.map(a => a.label).join('|');
    if (force || sig !== this._lastActions) {
      this._lastActions = sig;
      UI.setActions(list);
    }
  },

  compassAngle() {
    const w = this.walker;
    let target = null;
    for (const h of this.hotspots) {
      if (h.type === 'plant' && !h.planted) { target = h; break; }
    }
    if (!target) target = this.hotspots.find(h => h.type === 'gate');
    if (!target) return 0;
    return clamp((target.x - w.x) / 700, -1, 1) * 65;
  },

  /* ================= ACTIONS ================= */
  explore() {
    AudioSys.chime();
    const p = this.project(this.walker.x + rand(-60, 60), this.groundY() - rand(20, 90));
    Particles.spark(p.x, p.y, 'rgba(160,220,255,0.7)', 14, 1.6);
    if (Math.random() < 0.3) AudioSys.firefly();
    tween(this.cam, { offset: rand(-70, 70) }, 0.7, 'inOut').then(() => tween(this.cam, { offset: 0 }, 1.1, 'inOut'));
  },
  lookAround() {
    AudioSys.whoosh();
    const dir = Math.random() < 0.5 ? -1 : 1;
    tween(this.cam, { offset: dir * 170 }, 1.4, 'inOut').then(() => tween(this.cam, { offset: 0 }, 1.6, 'inOut'));
  },
  cancelFollow() {
    if (this.leaderState) {
      this.leaderState = null;
      UI.toastText('FOLLOW ENDED', 'You walk at your own pace again.');
    }
  },
  followChar(key) {
    AudioSys.softClick();
    let target = null;
    for (const h of this.hotspots) {
      if (h.type === 'plant' && !h.planted && h.x > this.walker.x + 60) { target = h.x; break; }
    }
    if (target == null) {
      const gate = this.hotspots.find(h => h.type === 'gate');
      target = gate ? gate.x - 140 : this.walker.x + 420;
    }
    this.leaderState = { key, targetX: clamp(target, 120, this.world.width - 160) };
    UI.dialogue([{ w: key.toUpperCase(), t: key === 'juvia' ? 'Follow Juvia. She knows the way.' : 'Stay close. I know the way.' }]);
  },
  talk(key) {
    this[key === 'juvia' ? 'juvia' : 'gray'].glowT = 2.4;
    UI.dialogue(DIALOGUES[key]);
  },
  charClick(key) {
    const ch = this[key];
    ch.glowT = 2.8;
    ch.dir = Math.sign(this.walker.x - ch.x) || 1;
    AudioSys.chime();
    const p = this.project(ch.x, this.groundY() - 70);
    Particles.spark(p.x, p.y, 'rgba(170,215,255,0.8)', 12, 1.5);
    UI.dialogue([{ w: key.toUpperCase(), t: IDLE_LINES[key][randi(0, IDLE_LINES[key].length - 1)] }]);
  },

  /* ================= INTERACTION FOCUS ================= */
  interact(h) {
    if (this.focusObj) return;
    if (h.type === 'firefly') this.achieve('light');
    if (h.type === 'gate') { this.toMap(); return; }
    AudioSys.chime();
    this.focusObj = { h, t: 0 };
    this.cam.follow = false;
    const p0 = { fx: this.cam.fx };
    tween(this.cam, { fx: clamp(h.x, 320, this.world.width - 320) }, 0.9, 'inOut');
    tween(this.cam, { z: 1.32 }, 0.9, 'inOut');
    $('#scene').classList.add('blurred');
    const p = this.project(h.x, this.groundY() - 30);
    Particles.spark(p.x, p.y, 'rgba(255,225,180,0.85)', 18, 1.8);
    UI.info({
      kicker: h.type === 'plant' ? 'PLANTING GROUND' : h.type === 'vista' ? 'VISTA' : 'DISCOVERY',
      title: h.title,
      text: h.text,
      onClose: () => this.closeFocus()
    });
    UI.setActions([]);
    UI.hidePrompt();
  },
  closeFocus() {
    if (!this.focusObj) return;
    this.focusObj = null;
    $('#scene').classList.remove('blurred');
    tween(this.cam, { z: 1 }, 0.9, 'inOut').then(() => { this.cam.follow = true; });
    this.refreshActions(true);
  },

  /* ================= PLANTING ================= */
  tryPlant(zone) {
    if (zone.final) this.finalSequence(zone);
    else this.plantSequence(zone);
  },
  spawnZoneFlora(zone) {
    const k = this.worldKey;
    if (!this.flora[k]) this.flora[k] = [];
    this.flora[k].push({ x: zone.x, type: 'flower', stage: 3, kind: randi(0, 2) });
    for (let i = 0; i < 4; i++) {
      this.flora[k].push({ x: zone.x + rand(-130, 130), type: 'flower', stage: 2 + Math.random(), kind: randi(0, 2) });
    }
    if (this.plantedTotal >= 4) {
      for (let i = 0; i < 3; i++) {
        this.flora[k].push({ x: zone.x + rand(-220, 220), type: 'tree', stage: 1.4 + Math.random() });
      }
    }
  },
  async plantSequence(zone) {
    if (this.planting || zone.planted) return;
    this.planting = true;
    this.inputLock = true;
    UI.hidePrompt(); UI.setActions([]);
    AudioSys.duck(0.22);
    const gy = this.groundY();

    this.cam.follow = false;
    tween(this.cam, { fx: clamp(zone.x, 320, this.world.width - 320), z: 1.75 }, 1.7, 'inOut');
    this.cine = { type: 'plant', zone, pod: 0, capY: gy - 200, falling: false, growth: 0, soil: 0, converge: null };
    await delay(1750);

    AudioSys.pod();
    await tween(this.cine, { pod: 1 }, 0.9, 'inOut');
    await delay(280);
    this.cine.falling = true;
    AudioSys.whoosh();
    await tween(this.cine, { capY: gy - 8 }, 1.1, 'in');
    this.cine.falling = false;

    const sp = this.project(zone.x, gy);
    AudioSys.plant();
    Ripples.add(sp.x, gy, 80, 'rgba(180,240,190,');
    Particles.spark(sp.x, gy, 'rgba(200,245,190,0.9)', 22, 1.9);
    this.cine.soil = 1;
    await delay(700);

    AudioSys.bloom();
    await tween(this.cine, { growth: 3 }, 3.6, 'inOut');

    this.cine.converge = this.project(zone.x, gy - 40);
    for (let i = 0; i < 10; i++) Particles.spark(sp.x + rand(-40, 40), gy - rand(10, 60), 'rgba(220,255,200,0.8)', 6, 1.2);
    await delay(1400);
    this.cine.converge = null;

    zone.planted = true;
    this.plantedWorlds[this.worldKey] = true;
    this.plantedTotal++;
    this.light = clamp(this.plantedTotal * 0.2, 0, 1);
    this.spawnZoneFlora(zone);
    if (this.plantedTotal === 1) { this.achieve('first'); this.unlockMemory('seed'); }
    if (this.plantedTotal === 2) this.achieve('growth');
    UI.progressRefresh();
    this.save();

    await UI.centerCard({ text: 'SEED PLANTED', dur: 1600 });
    await UI.centerCard({ text: 'Something has begun.', dur: 1700, sub: true });
    await UI.centerCard({ buttons: ['CONTINUE JOURNEY'] });

    this.cine = null;
    tween(this.cam, { z: 1 }, 1.4, 'inOut').then(() => { this.cam.follow = true; });
    this.inputLock = false;
    this.planting = false;
    AudioSys.duck(1);
    this.refreshActions(true);
  },

  /* ================= FINAL SEQUENCE ================= */
  async finalSequence(zone) {
    if (this.planting) return;
    this.planting = true;
    this.inputLock = true;
    this.state = 'ending';
    UI.hidePrompt(); UI.setActions([]); UI.hud(false);
    AudioSys.duck(0.14);
    AudioSys.heartbeat();
    const gy = this.groundY();

    this.cam.follow = false;
    tween(this.cam, { fx: clamp(zone.x, 320, this.world.width - 320), z: 1.8 }, 2.2, 'inOut');
    this.cine = { type: 'final', zone, pod: 0, growth: 0, spread: 0, flashback: null, capY: gy - 160, falling: false };
    await delay(2300);

    AudioSys.pod();
    await tween(this.cine, { pod: 1 }, 0.85, 'inOut');
    await delay(420);
    this.cine.falling = true;
    AudioSys.whoosh();
    await tween(this.cine, { capY: gy - 8 }, 1.3, 'in');
    this.cine.falling = false;
    AudioSys.plant();
    const sp = this.project(zone.x, gy);
    Ripples.add(sp.x, gy, 120, 'rgba(255,220,170,');
    Particles.spark(sp.x, gy, 'rgba(255,230,180,0.9)', 30, 2.4);
    await delay(900);

    AudioSys.bloom();
    await tween(this.cine, { growth: 3 }, 3.2, 'inOut');
    await tween(this.cine, { spread: 1 }, 2.6, 'inOut');

    for (const k of ['forest', 'valley', 'abstract', 'dream']) {
      this.cine.flashback = k;
      AudioSys.whoosh();
      await delay(950);
    }
    this.cine.flashback = null;
    AudioSys.chime();
    this.fireflies.setCount(40);
    this.cine.converge = this.project(zone.x, gy - 50);
    await delay(1500);

    /* commit */
    zone.planted = true;
    this.plantedWorlds.bloom = true;
    this.plantedTotal++;
    this.light = 1;
    this.flora.bloom = [{ x: zone.x, type: 'flower', stage: 3, kind: 1 }];
    for (let i = 0; i < 26; i++) this.flora.bloom.push({ x: zone.x + rand(-700, 700), type: 'flower', stage: 3, kind: randi(0, 2) });
    for (let i = 0; i < 6; i++) this.flora.bloom.push({ x: zone.x + rand(-600, 600), type: 'tree', stage: 2 + Math.random() });
    this.ended = true;
    this.achieve('bloom');
    this.unlockMemory('mountain');
    UI.progressRefresh();
    this.save();

    await UI.endingTexts([
      { text: 'Every journey leaves a trace.', dur: 2600 },
      { text: 'Choose what you leave behind.', dur: 2600 },
      { text: "DON'T JUST LEAVE FOOTPRINTS.", dur: 3000, big: true },
      { text: 'LEAVE LIFE BEHIND.', dur: 3200, big: true }
    ]);
    UI.showEndingButtons();
    AudioSys.duck(1);
    AudioSys.ambient('bright');
  },

  /* ================= PHOTO MODE ================= */
  enterPhoto() {
    if (this.state !== 'world' || this.photo.on) return;
    this.photo.on = true;
    document.body.classList.add('photo');
    UI.hud(false); UI.hidePrompt(); UI.setActions([]);
    AudioSys.softClick();
  },
  exitPhoto() {
    this.photo.on = false;
    this.photo.filter = null;
    $('#scene').style.filter = '';
    document.body.classList.remove('photo');
    UI.hud(true);
    this.refreshActions(true);
    AudioSys.softClick();
  },
  setPhotoFilter(name) {
    this.photo.filter = name;
    $('#scene').style.filter = name ? PHOTO_FILTERS[name] : '';
    AudioSys.softClick();
  },
  capture() {
    AudioSys.shutter();
    UI.flash();
    try {
      const src = $('#scene');
      const tmp = document.createElement('canvas');
      tmp.width = this.W; tmp.height = this.H;
      const tc = tmp.getContext('2d');
      tc.fillStyle = '#02040a'; tc.fillRect(0, 0, this.W, this.H);
      if (this.photo.filter) { try { tc.filter = PHOTO_FILTERS[this.photo.filter]; } catch (e) {} }
      tc.drawImage(src, 0, 0, this.W, this.H);
      tc.filter = 'none';
      const bar = Math.round(this.H * 0.11);
      tc.fillStyle = '#010208';
      tc.fillRect(0, 0, this.W, bar); tc.fillRect(0, this.H - bar, this.W, bar);
      tc.fillStyle = 'rgba(230,240,250,0.8)';
      tc.font = '300 14px Jost, sans-serif';
      tc.textAlign = 'center';
      tc.fillText('T R A I L B L O O M', this.W / 2, this.H - bar / 2 + 5);
      const a = document.createElement('a');
      a.download = 'trailbloom-' + Date.now() + '.png';
      a.href = tmp.toDataURL('image/png');
      a.click();
      UI.toastText('CAPTURED', 'A moment saved.');
    } catch (e) {
      UI.toastText('CAPTURED', 'Frame saved to your memory.');
    }
  },

  /* ================= RENDERING ================= */
  renderScene(ctx) {
    const t = this.time;
    ctx.clearRect(0, 0, this.W, this.H);
    const env = { light: this.light, playerX: this.walker.x };

    if (this.state === 'intro' || this.state === 'menu' || this.state === 'boot') {
      Scenes.drawMenuAmbient(ctx, t, Main.intro ? Main.intro.p : { light: 1, mtn: 1, chars: 1, shoe: 1 }, env, (this.mouse.x / this.W - 0.5) * 2);
      return;
    }
    const world = this.world || WORLD_DEFS.forest;
    const cam = { fx: this.cam.fx + this.cam.offset };

    ctx.save();
    if (this.cam.z !== 1) {
      ctx.translate(this.W / 2, this.H * 0.62);
      ctx.scale(this.cam.z, this.cam.z);
      ctx.translate(-this.W / 2, -this.H * 0.62);
    }
    world.back(ctx, cam, t, env);

    const gy = this.groundY();
    /* planted flora */
    const fl = this.flora[this.worldKey] || [];
    for (const f of fl) {
      const p = { x: Scenes.parallaxX(f.x, cam.fx, 1) };
      if (p.x < -80 || p.x > this.W + 80) continue;
      if (f.type === 'flower') Scenes.drawGrowth(ctx, p.x, gy + 8, f.stage, t, 1.05, f.kind);
      else {
        Scenes.treeRound(ctx, p.x, gy + 8, 0.5 + f.stage * 0.4, hexLerp('#3f7a4c', '#5f9a60', this.light), Math.sin(t + f.x) * 2);
        drawGlow(ctx, p.x, gy - 20, 30, 'rgba(255,230,180,0.35)', 0.3);
      }
    }
    /* hotspot objects */
    for (const h of this.hotspots) {
      if (h.type === 'gate' && this.state === 'ending') continue;
      const sx = Scenes.parallaxX(h.x, cam.fx, 1);
      if (sx < -90 || sx > this.W + 90) continue;
      Scenes.drawHotspotObject(ctx, h.type, sx, gy + 10, t, env, 1, 0);
      if (h.type === 'plant' && !h.planted) {
        const a = 0.3 + 0.25 * Math.sin(t * 1.8 + h.x);
        drawGlow(ctx, sx, gy, 34, 'rgba(180,240,190,0.6)', a);
      }
    }
    /* characters */
    if (this.state !== 'ending' || true) {
      const jp = Scenes.parallaxX(this.juvia.x, cam.fx, 1);
      const gp = Scenes.parallaxX(this.gray.x, cam.fx, 1);
      Scenes.drawJuvia(ctx, jp, gy + 12, 1.12, { t, dir: this.juvia.dir, moving: this.juvia.moving, walkPh: this.juvia.walkPh, glow: Math.max(0, this.juvia.glowT) });
      Scenes.drawGray(ctx, gp, gy + 12, 1.16, { t, dir: this.gray.dir, moving: this.gray.moving, walkPh: this.gray.walkPh, glow: Math.max(0, this.gray.glowT) });
    }
    world.front(ctx, cam, t, env);
    ctx.restore();
  },

  renderFX(ctx, dt) {
    const t = this.time;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.state === 'boot') return;

    UI.drawTransFX(ctx, dt);

    /* focus-mode redraw of the highlighted object (scene is CSS-blurred) */
    if (this.focusObj) {
      this.focusObj.t += dt;
      const h = this.focusObj.h;
      const p = this.project(h.x, this.groundY() + 10);
      const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
      ctx.strokeStyle = `rgba(255,225,180,${0.5 * pulse})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 95, 120, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      Scenes.drawHotspotObject(ctx, h.type, p.x, p.y, t, { light: this.light }, 1.9, this.focusObj.t);
    }

    /* cinematic overlays */
    if (this.cine) this.renderCine(ctx, dt);

    Ripples.draw(ctx);
    this.fireflies.draw(ctx, t);
    Butterflies.draw(ctx, t);
    Particles.draw(ctx);
  },

  renderCine(ctx, dt) {
    const c = this.cine, t = this.time, gy = this.groundY();
    const sp = this.project(c.zone.x, gy);

    /* soft dark frame while planting */
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.25, this.W / 2, this.H / 2, this.H * 0.85);
    g.addColorStop(0, 'rgba(2,4,10,0)');
    g.addColorStop(1, 'rgba(2,4,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    if (c.flashback) {
      ctx.globalAlpha = 0.5;
      const cols = { forest: '#0a1c34', valley: '#0e2438', abstract: '#2c2450', dream: '#33204c' };
      ctx.fillStyle = cols[c.flashback];
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(210,230,250,0.85)';
      ctx.font = '300 34px Jost, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.8;
      ctx.fillText(WORLD_DEFS[c.flashback].name, this.W / 2, this.H * 0.2);
      ctx.globalAlpha = 1;
    }

    /* heel pod mini-mechanism near the walker */
    const px = this.project(this.walker.x + 40, gy - 60);
    ctx.save();
    ctx.globalAlpha = 0.95;
    Scenes.drawShoeHeel(ctx, px.x, px.y, 0.5, { t, pod: c.pod });
    ctx.restore();

    /* falling capsule + trail */
    if (c.pod > 0.2) {
      const capAlpha = c.falling ? 1 : (c.soil ? Math.max(0, 1 - (t % 1)) : 1);
      if (c.falling) {
        Particles.trail(sp.x - 10, c.capY, 'rgba(190,240,200,0.8)');
        Particles.trail(sp.x + 8, c.capY - 6, 'rgba(190,240,200,0.6)');
      }
      if (!c.soil) {
        ctx.save();
        ctx.globalAlpha = capAlpha;
        Scenes.drawCapsuleView(ctx, sp.x, c.capY, 0.55, { hue: 140 }, t);
        ctx.restore();
      }
    }

    /* growing sprout at the zone */
    if (c.growth > 0) {
      Scenes.drawGrowth(ctx, sp.x, gy - 2, c.growth, t, 1.7, 1);
      if (c.type === 'final' && c.spread > 0) {
        const n = Math.round(c.spread * 22);
        for (let i = 0; i < n; i++) {
          const fx = sp.x + Math.sin(i * 2.4) * (80 + i * 34) * c.spread;
          const fk = i % 3;
          Scenes.drawGrowth(ctx, fx, gy + Math.cos(i * 1.7) * 26 * c.spread, 3, t + i, 1 + (i % 3) * 0.25, fk);
        }
        drawGlow(ctx, sp.x, gy - 40, 260 * c.spread, 'rgba(255,225,170,0.5)', 0.5 * c.spread);
      }
    }
  }
};
