'use strict';
/* ============================================================
   TRAILBLOOM — ui.js
   Screens, HUD, contextual actions, dialogue, info panels,
   world map, shoe showcase, seed collection, journey, memories,
   modals, toasts, transitions, custom cursor.
   ============================================================ */

const UI = {
  _screenCb: null, _hovBtn: null, _hovT: 0,
  _trans: null, _busy: false,
  _dlg: null, _infoOpen: false,
  shoeSt: { view: 0, pod: 0, podOpen: false, zoom: 1, labels: false, flip: 0, rotating: false },
  _seedSel: 0,
  _mapSel: 'forest',
  _shoeCtx: null, _seedsCtx: null, _replayCtx: null, _replayKind: null, _replayT: 0,

  /* ================= INIT ================= */
  init() {
    this.buildMenu();
    this.buildMap();
    this.buildHUD();
    this.buildShoe();
    this.buildSeeds();
    this.buildJourney();
    this.buildMemories();
    this.buildPhotoUI();
    this.bindGlobal();
    Cursor.init();
  },

  /* ================= SCREEN MANAGEMENT ================= */
  show(id, onClose) {
    this._screenCb = onClose || null;
    $$('.screen').forEach(s => { if (s.id !== id) s.classList.remove('on'); });
    if (id) {
      const s = $('#' + id);
      s.classList.remove('on');
      void s.offsetWidth;
      s.classList.add('on');
    }
  },
  closeScreen() {
    const cb = this._screenCb;
    this._screenCb = null;
    if (cb) cb(); else this.show(null);
  },
  closeAllOverlays() {
    this.closeModal();
    this.hideDialogue();
    this.hideInfo();
    const cc = $('#cardCenter');
    cc.classList.remove('on'); cc.innerHTML = '';
    $('#replay').classList.remove('on');
    this._replayKind = null;
    if (Game.photo.on) Game.exitPhoto();
  },

  /* ================= MENU ================= */
  buildMenu() {
    const scr = $('#scr-menu');
    scr.innerHTML = `
      <div class="menu-wrap">
        <div class="brand fadein">
          <div class="brand-kicker">AN INTERACTIVE JOURNEY</div>
          <h1 class="brand-title">TRAILBLOOM</h1>
          <div class="brand-sub">Leave Life Behind.</div>
        </div>
        <nav id="menuButtons" class="menu-buttons"></nav>
        <div class="menu-foot fadein">a concept prototype · headphones recommended</div>
      </div>`;
  },
  showMenu(paused) {
    Game.state = 'menu';
    UI.hud(false);
    UI.hidePrompt();
    UI.setActions([]);
    AudioSys.ambient('dark');
    const nav = $('#menuButtons');
    nav.innerHTML = '';
    const items = [];
    if (paused) {
      items.push({ label: 'RESUME JOURNEY', primary: true, cb: () => UI.closeScreen() });
      items.push({ label: 'START JOURNEY', cb: () => Game.enterWorld('forest') });
    } else {
      items.push({ label: 'START JOURNEY', primary: true, cb: () => Game.enterWorld('forest') });
    }
    items.push(
      { label: 'EXPLORE THE WORLD', cb: () => { UI.show('scr-map'); UI.mapRefresh(); } },
      { label: 'HOW IT WORKS', cb: () => UI.modal('how') },
      { label: 'TRAILBLOOM SHOE', cb: () => UI.show('scr-shoe', UI._backFromScreen) },
      { label: 'SEED COLLECTION', cb: () => UI.show('scr-seeds', UI._backFromScreen) },
      { label: 'OUR JOURNEY', cb: () => { UI.journeyRefresh(); UI.show('scr-journey', UI._backFromScreen); } },
      { label: 'SETTINGS', cb: () => UI.modal('settings') },
      { label: 'ABOUT', cb: () => UI.modal('about') },
      { label: 'CREDITS', cb: () => UI.modal('credits') }
    );
    items.forEach((it, i) => {
      const b = el('button', 'hb rise' + (it.primary ? ' primary' : ''), `<span class="orn" aria-hidden="true">✦</span><span>${it.label}</span>`);
      b.style.animationDelay = (0.1 + i * 0.075) + 's';
      b.addEventListener('click', it.cb);
      nav.appendChild(b);
    });
    this.show('scr-menu', paused ? () => { Game.paused = false; Game.state = 'world'; UI.hud(true); Game.refreshActions(true); } : null);
  },
  _backFromScreen() {
    Game.paused = false;
    if (Game.state === 'world' || Game.state === 'ending') {
      UI.show(null);
      if (Game.state === 'world') { UI.hud(true); Game.refreshActions(true); }
    } else {
      UI.showMenu();
    }
  },
  pauseToMenu() {
    if (Game.state !== 'world') return;
    Game.paused = true;
    this.showMenu(true);
  },

  /* ================= WORLD MAP ================= */
  buildMap() {
    const scr = $('#scr-map');
    const pos = { forest: [16, 62], valley: [34, 38], abstract: [52, 60], dream: [68, 34], bloom: [85, 55] };
    let nodes = '', path = '';
    const keys = Object.keys(pos);
    keys.forEach((k, i) => {
      const [x, y] = pos[k];
      nodes += `<div class="map-node" data-world="${k}" style="left:${x}%;top:${y}%;">
        <div class="node-orb">${WORLD_DEFS[k].icon}<span class="node-check">✓</span></div>
        <div class="node-name">${WORLD_DEFS[k].name}</div>
      </div>`;
      if (i > 0) {
        const [px, py] = pos[keys[i - 1]];
        path += `M ${px} ${py} C ${(px + x) / 2} ${py}, ${(px + x) / 2} ${y}, ${x} ${y} `;
      }
    });
    scr.innerHTML = `
      <div class="map-head">
        <h2>THE WORLD</h2>
        <p id="mapProg">JOURNEY · 0%</p>
      </div>
      <div class="map-body">
        <svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="${path}"/>
        </svg>
        ${nodes}
        <div class="map-card" id="mapCard"></div>
      </div>
      <div class="map-foot" id="mapMiles"></div>
      <button class="hb ghost-btn" id="mapBack" style="position:absolute;left:26px;top:26px;">← BACK</button>`;
    scr.querySelectorAll('.map-node').forEach(n => {
      n.addEventListener('click', () => {
        AudioSys.softClick();
        this._mapSel = n.dataset.world;
        this.mapRefresh();
      });
    });
    $('#mapBack').addEventListener('click', () => {
      AudioSys.softClick();
      if (Game.state === 'world') { UI.show(null); UI.hud(true); Game.refreshActions(true); }
      else UI.showMenu();
    });
  },
  mapRefresh() {
    $$('.map-node').forEach(n => {
      n.classList.toggle('visited', !!Game.visited[n.dataset.world]);
      n.classList.toggle('sel', n.dataset.world === this._mapSel);
    });
    $('#mapProg').textContent = 'JOURNEY · ' + Game.progress() + '%';
    const def = WORLD_DEFS[this._mapSel];
    const node = $(`.map-node[data-world="${this._mapSel}"]`);
    const card = $('#mapCard');
    card.innerHTML = `
      <h3>${def.icon} ${def.name}</h3>
      <div class="map-preview">
        <div class="mp-bg" style="background:${def.preview}"></div>
        ${def.floatIcons.map((ic, i) => `<div class="mp-float" style="left:${15 + i * 30}%;top:${25 + (i % 2) * 30}%;animation-delay:${i * 0.7}s">${ic}</div>`).join('')}
      </div>
      <div class="mc-desc">${def.desc}<br><i>${def.tag}</i></div>
      <div class="mc-stats"><span>${Game.visited[this._mapSel] ? '✓ VISITED' : '○ UNVISITED'}</span><span>● AMBIANCE ${def.amb.toUpperCase()}</span></div>
      <button class="hb primary" id="mcEnter" style="width:100%;">ENTER WORLD</button>`;
    const np = node.getBoundingClientRect(), bp = $('.map-body').getBoundingClientRect();
    card.classList.add('on');
    let cx = np.left - bp.left + 80, cy = np.top - bp.top + 40;
    card.style.left = clamp(cx, 8, bp.width - 306) + 'px';
    card.style.top = clamp(cy, 8, Math.max(8, bp.height - 260)) + 'px';
    $('#mcEnter').addEventListener('click', () => {
      Game.enterWorld(this._mapSel);
    });
    $('#mapMiles').innerHTML = Game.milestones().map(m =>
      `<div class="milestone-row ${m.done ? 'done' : ''}"><span class="ms-dot"></span>${m.label} ${m.done ? '✓' : '○'}</div>`).join('');
  },

  /* ================= HUD ================= */
  buildHUD() {
    const hud = $('#hud');
    hud.innerHTML = `
      <div class="hud-tl">
        <div class="char-chip gray"><div class="cc-dot">G</div><div class="cc-name">GRAY</div></div>
        <div class="char-chip juvia"><div class="cc-dot">J</div><div class="cc-name">JUVIA</div></div>
      </div>
      <div class="hud-tr">
        <div class="hud-tools">
          <button class="tool-btn" data-tip="WORLD MAP" id="tMap">🗺️</button>
          <button class="tool-btn" data-tip="TRAILBLOOM SHOE" id="tShoe">👟</button>
          <button class="tool-btn" data-tip="SEEDS" id="tSeeds">🌱</button>
          <button class="tool-btn" data-tip="PHOTO MODE" id="tPhoto">📷</button>
          <button class="tool-btn" data-tip="MEMORIES" id="tMem">✦</button>
          <button class="tool-btn" data-tip="MENU" id="tMenu">☰</button>
        </div>
        <div class="hud-prog">
          <div class="hp-label">TRAIL PROGRESS</div>
          <div class="hp-val" id="hpVal">Journey: 0%</div>
          <div class="hp-dots" id="hpDots">○○○○○</div>
        </div>
      </div>
      <div class="hud-bl">
        <div class="compass" id="compass" title="">
          <div class="cp-ring"></div>
          <div class="cp-tick" style="transform:rotate(0deg)"></div>
          <div class="cp-tick" style="transform:rotate(90deg)"></div>
          <div class="cp-tick" style="transform:rotate(180deg)"></div>
          <div class="cp-tick" style="transform:rotate(270deg)"></div>
          <div class="cp-n">N</div>
          <div class="cp-needle" id="cpNeedle"></div>
          <div class="cp-hub"></div>
        </div>
      </div>`;
    $('#tMap').addEventListener('click', () => Game.toMap());
    $('#tShoe').addEventListener('click', () => { Game.paused = true; UI.show('scr-shoe', UI._backFromScreen); });
    $('#tSeeds').addEventListener('click', () => { Game.paused = true; UI.show('scr-seeds', UI._backFromScreen); });
    $('#tPhoto').addEventListener('click', () => Game.enterPhoto());
    $('#tMem').addEventListener('click', () => { Game.paused = true; UI.show('scr-memories', UI._backFromScreen); });
    $('#tMenu').addEventListener('click', () => UI.pauseToMenu());
    $('#compass').addEventListener('click', () => Game.toMap());
  },
  hud(on) { $('#hud').classList.toggle('on', on); },
  setCompass(deg) {
    const n = $('#cpNeedle');
    if (n) n.style.transform = `rotate(${deg}deg)`;
  },
  progressRefresh() {
    const p = Game.progress();
    const v = $('#hpVal');
    if (v) v.textContent = 'Journey: ' + p + '%';
    const d = $('#hpDots');
    if (d) {
      const ms = Game.milestones();
      d.textContent = ms.map(m => m.done ? '●' : '○').join('');
    }
    const mp = $('#mapProg');
    if (mp) mp.textContent = 'JOURNEY · ' + p + '%';
    this.journeyRefresh();
  },

  /* ================= CONTEXTUAL ACTIONS & PROMPT ================= */
  setActions(list) {
    const bar = $('#actions');
    if (!list || !list.length) { bar.classList.remove('on'); bar.innerHTML = ''; return; }
    bar.innerHTML = '';
    list.forEach((a, i) => {
      const b = el('button', 'hb act' + (a.primary ? ' primary' : ''), `<span class="orn" aria-hidden="true">✦</span><span>${a.label}</span>`);
      b.style.animationDelay = (i * 0.07) + 's';
      b.addEventListener('click', a.cb);
      bar.appendChild(b);
    });
    bar.classList.add('on');
  },
  prompt(x, y, label) {
    const p = $('#prompt');
    if (!p._bound) {
      p._bound = true;
      p.addEventListener('click', () => this._promptClick());
    }
    if (!p.classList.contains('on')) p.classList.add('on');
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    if (p.textContent !== label) p.textContent = label;
  },
  _promptClick() {
    const h = Game.near;
    if (!h) return;
    if (h.type === 'plant' && !h.planted) Game.tryPlant(h);
    else Game.interact(h);
  },
  hidePrompt() { const p = $('#prompt'); p.classList.remove('on'); },

  /* ================= DIALOGUE ================= */
  dialogue(lines) {
    AudioSys.softClick();
    this._dlg = { lines, i: 0, timer: null };
    const d = $('#dialogue');
    d.innerHTML = `
      <div class="dg-name" id="dgName"></div>
      <div class="dg-text" id="dgText"></div>
      <button class="hb ghost-btn" id="dgNext" style="margin-top:12px;">CONTINUE ▸</button>`;
    d.classList.add('on');
    requestAnimationFrame(() => d.classList.add('vis'));
    $('#dgNext').addEventListener('click', () => this.advanceDialogue());
    d.addEventListener('click', e => { if (e.target.id !== 'dgNext') this.advanceDialogue(); });
    this._typeLine();
  },
  _typeLine() {
    const dg = this._dlg;
    if (!dg) return;
    const nameEl = $('#dgName'), textEl = $('#dgText');
    const line = dg.lines[dg.i];
    nameEl.textContent = line.w;
    nameEl.className = 'dg-name ' + line.w.toLowerCase();
    textEl.textContent = '';
    let k = 0;
    clearInterval(dg.timer);
    dg.timer = setInterval(() => {
      k++;
      textEl.textContent = line.t.slice(0, k);
      if (k % 3 === 0) AudioSys.blip(rand(1200, 1600), 0.02, 'sine', 0.012);
      if (k >= line.t.length) {
        clearInterval(dg.timer);
        const btn = $('#dgNext');
        if (dg.i >= dg.lines.length - 1) btn.textContent = 'CLOSE ✕';
      }
    }, 26);
  },
  advanceDialogue() {
    const dg = this._dlg;
    if (!dg) return;
    const line = dg.lines[dg.i];
    const textEl = $('#dgText');
    if (textEl.textContent.length < line.t.length) {
      clearInterval(dg.timer);
      textEl.textContent = line.t;
      return;
    }
    AudioSys.softClick();
    dg.i++;
    if (dg.i >= dg.lines.length) { this.hideDialogue(); return; }
    this._typeLine();
  },
  hideDialogue() {
    const d = $('#dialogue');
    if (this._dlg) clearInterval(this._dlg.timer);
    this._dlg = null;
    d.classList.remove('vis');
    setTimeout(() => { if (!this._dlg) d.classList.remove('on'); }, 400);
  },

  /* ================= INFO PANEL ================= */
  info(data) {
    this._infoOpen = true;
    const p = $('#infoPanel');
    p.innerHTML = `
      <div class="ip-kicker">${data.kicker || 'DISCOVERY'}</div>
      <div class="ip-title">${data.title}</div>
      <div class="ip-text">“${data.text}”</div>
      <div class="ip-btns">
        <button class="hb ghost-btn" id="ipClose">CLOSE</button>
        <button class="hb" id="ipCont">CONTINUE</button>
      </div>`;
    p.classList.add('on');
    requestAnimationFrame(() => p.classList.add('vis'));
    const done = () => { this.hideInfo(); if (data.onClose) data.onClose(); };
    $('#ipClose').addEventListener('click', done);
    $('#ipCont').addEventListener('click', done);
  },
  hideInfo() {
    this._infoOpen = false;
    const p = $('#infoPanel');
    p.classList.remove('vis');
    setTimeout(() => { if (!this._infoOpen) p.classList.remove('on'); }, 450);
  },

  /* ================= CENTER CARDS (planting / finale text) ================= */
  async centerCard(o = {}) {
    const wrap = $('#cardCenter');
    wrap.classList.add('on');
    if (o.text != null) {
      const cls = o.sub ? 'cc-sub' : 'cc-text' + (o.big ? ' cc-big' : '');
      const t = el('div', cls, o.text);
      wrap.appendChild(t);
      requestAnimationFrame(() => t.classList.add('vis'));
      AudioSys.chime();
      if (o.dur) {
        await delay(o.dur);
        t.classList.remove('vis');
        await delay(550);
        t.remove();
      }
    }
    if (o.buttons) {
      const btns = el('div', 'cc-btns');
      wrap.appendChild(btns);
      requestAnimationFrame(() => btns.classList.add('vis'));
      const idx = await new Promise(r => {
        o.buttons.forEach((lab, i) => {
          const b = el('button', 'hb' + (i === 0 ? ' primary' : ''), lab);
          b.addEventListener('click', () => { AudioSys.click(); r(i); });
          btns.appendChild(b);
        });
      });
      btns.classList.remove('vis');
      await delay(650);
      btns.remove();
      wrap.classList.remove('on');
      return idx;
    }
  },
  async endingTexts(list) {
    this.show('scr-ending');
    const scr = $('#scr-ending');
    scr.innerHTML = '';
    for (const item of list) {
      const t = el('div', 'end-text' + (item.big ? ' big' : ''), item.text);
      scr.appendChild(t);
      await delay(60);
      t.classList.add('vis');
      AudioSys.chime();
      await delay(item.dur);
      t.classList.remove('vis');
      await delay(900);
      t.remove();
    }
  },
  showEndingButtons() {
    Game.cine = null;
    Game.inputLock = false;
    Game.planting = false;
    Game.state = 'world';
    tween(Game.cam, { z: 1 }, 1.6, 'inOut').then(() => { Game.cam.follow = true; });
    const scr = $('#scr-ending');
    scr.classList.add('on');
    const quote = el('div', 'end-quote', 'Every journey leaves a trace.');
    scr.appendChild(quote);
    requestAnimationFrame(() => quote.classList.add('vis'));
    const btns = el('div', 'end-btns');
    const items = [
      ['REPLAY JOURNEY', () => { Game.resetSave(); location.reload(); }],
      ['EXPLORE AGAIN', () => { this.show(null); this.hud(true); Game.refreshActions(true); AudioSys.ambient(Game.world ? Game.world.amb : 'bright'); }],
      ['VIEW TRAILBLOOM', () => this.show('scr-shoe', () => { this.show('scr-ending'); this.showEndingButtons(); })],
      ['MEMORIES', () => this.show('scr-memories', () => { this.show('scr-ending'); this.showEndingButtons(); })],
      ['HOME', () => { this.showMenu(); }]
    ];
    items.forEach(([lab, cb]) => {
      const b = el('button', 'hb', lab);
      b.addEventListener('click', cb);
      btns.appendChild(b);
    });
    scr.appendChild(btns);
    requestAnimationFrame(() => btns.classList.add('vis'));
  },

  /* ================= TOASTS ================= */
  toast(ach) {
    if (!ach) return;
    this._toast(ach.icon, ach.name, ach.text, true);
  },
  toastText(title, text) {
    this._toast('✦', title, text, false);
  },
  _toast(icon, name, text, isAch) {
    const t = el('div', 'toast', `
      <div class="t-ico">${icon}</div>
      <div><div class="t-ach">${isAch ? 'ACHIEVEMENT UNLOCKED' : 'TRAILBLOOM'}</div>
      <div class="t-name">${name}</div>
      <div class="t-text">“${text}”</div></div>`);
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => {
      t.classList.remove('on');
      setTimeout(() => t.remove(), 800);
    }, 4600);
  },

  /* ================= MODALS ================= */
  modal(name) {
    const wrap = $('#modalWrap');
    let body = '', title = '';
    if (name === 'how') {
      title = 'HOW IT WORKS';
      body = `
        <p><b>TRAILBLOOM</b> is a quiet journey through five worlds with <span class="hl">Gray</span> and <span class="hl">Juvia</span>. The land is fading — you carry the seeds that could bring it back.</p>
        <p><span class="kbd">A</span><span class="kbd">D</span> or <span class="kbd">←</span><span class="kbd">→</span> walk (hold <span class="kbd">SHIFT</span> to run), or simply <b>click the ground</b>.</p>
        <p>Approach glowing things and press <span class="kbd">E</span> — or tap the golden <b>[ INTERACT ]</b> prompt — to look closer.</p>
        <p>Find the glowing soil in every world and press <b>[ PLANT SEED ]</b>. Every seed you plant <span class="hl">permanently changes the world</span>: flowers return, grass turns green, fireflies multiply, small trees grow.</p>
        <p>Open the <b>compass</b> or <span class="kbd">M</span> for the world map. <span class="kbd">P</span> enters <b>photo mode</b>. <span class="kbd">ESC</span> pauses.</p>
        <p><i>Leave life behind.</i></p>`;
    } else if (name === 'about') {
      title = 'ABOUT';
      body = `
        <p><b>TRAILBLOOM</b> is a concept — part interactive art installation, part indie adventure, part product dream.</p>
        <p>It imagines a trail shoe whose heel carries <span class="hl">replaceable seed pods</span>. Every step becomes a choice: what do we leave on the trails we walk?</p>
        <p>DON'T JUST LEAVE FOOTPRINTS. <b>LEAVE LIFE BEHIND.</b></p>`;
    } else if (name === 'credits') {
      title = 'CREDITS';
      body = `
        <div class="credits-row"><span>CONCEPT & DESIGN</span><span>Trailbloom Studio</span></div>
        <div class="credits-row"><span>WORLDS & ANIMATION</span><span>Procedural canvas art</span></div>
        <div class="credits-row"><span>SOUND</span><span>Synthesized in WebAudio</span></div>
        <div class="credits-row"><span>CHARACTERS</span><span>Gray & Juvia</span></div>
        <div class="credits-row"><span>TYPE</span><span>Cormorant Garamond · Jost</span></div>
        <div class="credits-row"><span>BUILT WITH</span><span>Vanilla HTML · CSS · JS</span></div>`;
    } else if (name === 'settings') {
      title = 'SETTINGS';
      body = `
        <div class="set-row"><label>MASTER VOLUME</label><input type="range" id="setVol" min="0" max="100" value="${Math.round(AudioSys.vol * 100)}"></div>
        <div class="set-row"><label>SOUND</label>
          <div class="seg" id="setMute"><button data-v="0" class="${!AudioSys.muted ? 'on' : ''}">ON</button><button data-v="1" class="${AudioSys.muted ? 'on' : ''}">OFF</button></div>
        </div>
        <div class="set-row"><label>PARTICLES</label>
          <div class="seg" id="setPart"><button data-v="0.5" class="${Particles.density === 0.5 ? 'on' : ''}">LOW</button><button data-v="1" class="${Particles.density === 1 ? 'on' : ''}">NORMAL</button><button data-v="1.6" class="${Particles.density === 1.6 ? 'on' : ''}">HIGH</button></div>
        </div>
        <div class="set-row" style="border-bottom:none;"><label>PROGRESS</label><button class="hb ghost-btn" id="setReset">RESET JOURNEY</button></div>`;
    }
    wrap.innerHTML = `<div class="modal-card">
      <h2>${title}</h2>
      <div class="m-body">${body}</div>
      <div class="m-foot"><button class="hb" id="mClose">CLOSE</button></div>
    </div>`;
    wrap.classList.add('on');
    requestAnimationFrame(() => wrap.classList.add('vis'));
    $('#mClose').addEventListener('click', () => this.closeModal());
    wrap.addEventListener('click', e => { if (e.target === wrap) this.closeModal(); });
    if (name === 'settings') this.bindSettings();
  },
  bindSettings() {
    $('#setVol').addEventListener('input', e => {
      AudioSys.setVol(e.target.value / 100);
      Game.save();
    });
    $('#setVol').addEventListener('change', () => AudioSys.blip(880, 0.1, 'sine', 0.1));
    $$('#setMute button').forEach(b => b.addEventListener('click', () => {
      AudioSys.setMuted(b.dataset.v === '1');
      $$('#setMute button').forEach(x => x.classList.toggle('on', x === b));
      Game.save();
    }));
    $$('#setPart button').forEach(b => b.addEventListener('click', () => {
      Particles.density = parseFloat(b.dataset.v);
      $$('#setPart button').forEach(x => x.classList.toggle('on', x === b));
      Game.save();
    }));
    $('#setReset').addEventListener('click', () => {
      Game.resetSave();
      location.reload();
    });
  },
  closeModal() {
    const wrap = $('#modalWrap');
    wrap.classList.remove('vis');
    setTimeout(() => wrap.classList.remove('on'), 380);
  },

  /* ================= TRANSITIONS ================= */
  async veilTo(op, dur = 700, color = '#02040a') {
    const v = $('#veil');
    v.style.transition = `opacity ${dur}ms ease`;
    v.style.background = color;
    v.style.opacity = op;
    await delay(dur + 40);
  },
  async transition(mode, mid) {
    if (this._busy) { if (mid) mid(); return; }
    this._busy = true;
    AudioSys.transition();
    const scene = $('#scene');
    scene.classList.add('zooming');
    if (mode === 'portal') {
      this._trans = { mode, phase: 'in', t: 0 };
      await delay(1000);
    } else {
      await this.veilTo(mode === 'bloom' ? 0.9 : 0.97, 720, mode === 'bloom' ? '#241708' : '#02040a');
    }
    if (mid) mid();
    scene.classList.remove('zooming');
    if (mode === 'dark') {
      for (let i = 0; i < 16; i++) Particles.spark(rand(window.innerWidth), window.innerHeight * rand(0.3, 1), 'rgba(150,200,255,0.6)', 2, 0.8);
    } else if (mode === 'dissolve') {
      Particles.leafBurst(window.innerWidth * 0.5, window.innerHeight * 0.4, 22, ['#7fae6f', '#a8c98a', '#c79ede', '#5d8f63']);
    } else if (mode === 'bloom') {
      Particles.petalRain(window.innerWidth * 0.5, window.innerHeight * 0.3, 24, '#ff9ecb');
      AudioSys.bloom();
    } else if (mode === 'portal') {
      this._trans = { mode, phase: 'out', t: 0 };
      for (let i = 0; i < 14; i++) Particles.spark(window.innerWidth / 2 + rand(-40, 40), window.innerHeight * 0.55 + rand(-40, 40), 'rgba(180,200,255,0.8)', 3, 2.4);
    }
    if (mode === 'portal') await delay(1000);
    else await this.veilTo(0, 780);
    this._trans = null;
    this._busy = false;
  },
  drawTransFX(ctx, dt) {
    const tr = this._trans;
    if (!tr) return;
    tr.t += dt;
    const W = window.innerWidth, H = window.innerHeight;
    if (tr.mode === 'portal') {
      const k = tr.phase === 'in'
        ? 1 - ease.inOut(clamp(tr.t / 1, 0, 1))
        : ease.out(clamp(tr.t / 1, 0, 1));
      const maxR = Math.hypot(W, H) * 0.62;
      const R = Math.max(maxR * k, 0.5);
      ctx.save();
      ctx.fillStyle = '#02040a';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H * 0.55, R, 0, TAU, true);
      ctx.fill('evenodd');
      ctx.strokeStyle = `rgba(150,200,255,${0.55 * (1 - Math.abs(2 * clamp(tr.t, 0, 1) - 1)) + 0.15})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.55, R, 0, TAU);
      ctx.stroke();
      drawGlow(ctx, W / 2, H * 0.55, R * 1.25, 'rgba(110,160,230,0.4)', 0.4);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + tr.t * 2;
        const d = tr.phase === 'in' ? (1 - k) * maxR * 1.1 + 30 : k * maxR * 1.1 + 30;
        drawGlow(ctx, W / 2 + Math.cos(a) * d, H * 0.55 + Math.sin(a) * d * 0.8, 8, 'rgba(190,235,150,0.9)', 0.7);
      }
      ctx.restore();
    }
  },

  /* ================= SHOE SHOWCASE ================= */
  buildShoe() {
    const scr = $('#scr-shoe');
    scr.innerHTML = `
      <div class="shoe-head">
        <button class="hb ghost-btn" id="shoeBack">← BACK</button>
        <div class="panel-title">TRAILBLOOM · ONE</div>
        <div style="width:110px"></div>
      </div>
      <div class="shoe-stage">
        <canvas id="shoeCv" width="860" height="420"></canvas>
        <div class="shoe-status">
          <div class="ss-chip" id="ssView">SIDE VIEW</div>
          <div class="ss-lock" id="ssLock">LOCKED</div>
        </div>
        <div class="shoe-details" id="shoeDetails">
          <h4>SEED POD SYSTEM</h4>
          <p>The heel houses a <b>replaceable seed pod</b> — a watertight capsule bay with growing medium,
          released by a single locking hatch. Walk a trail. Open the pod. Leave something alive behind.</p>
          <p style="margin-top:10px;">· Release hatch — one-hand mechanical lock<br>· 2 seed capsules + growing medium<br>· Swappable in seconds</p>
        </div>
      </div>
      <div class="shoe-btns">
        <button class="hb" id="sbRotate">ROTATE</button>
        <button class="hb" id="sbZoomIn">ZOOM IN</button>
        <button class="hb" id="sbZoomOut">ZOOM OUT</button>
        <button class="hb" id="sbOpen">OPEN SEED POD</button>
        <button class="hb" id="sbClose">CLOSE POD</button>
        <button class="hb" id="sbCapsule">VIEW CAPSULE</button>
        <button class="hb" id="sbDetails">SHOE DETAILS</button>
      </div>`;
    $('#shoeBack').addEventListener('click', () => { AudioSys.softClick(); UI.closeScreen(); });
    $('#sbRotate').addEventListener('click', () => this.rotateShoe());
    $('#sbZoomIn').addEventListener('click', () => this.zoomShoe(0.3));
    $('#sbZoomOut').addEventListener('click', () => this.zoomShoe(-0.3));
    $('#sbOpen').addEventListener('click', () => this.openPod(true));
    $('#sbClose').addEventListener('click', () => this.openPod(false));
    $('#sbCapsule').addEventListener('click', () => {
      AudioSys.softClick();
      this.shoeSt.view = 3;
      this._shoeStatus();
    });
    $('#sbDetails').addEventListener('click', () => {
      AudioSys.softClick();
      this.shoeSt.labels = !this.shoeSt.labels;
      $('#shoeDetails').classList.toggle('on', this.shoeSt.labels);
    });
    this._shoeCtx = $('#shoeCv').getContext('2d');
  },
  _shoeStatus() {
    const st = this.shoeSt;
    $('#ssView').textContent = ['SIDE VIEW', 'HEEL VIEW', 'SOLE VIEW', 'SEED CAPSULE'][st.view];
    const lock = $('#ssLock');
    lock.textContent = st.pod > 0.5 ? 'OPEN' : 'LOCKED';
    lock.classList.toggle('open', st.pod > 0.5);
  },
  async rotateShoe() {
    const st = this.shoeSt;
    if (st.rotating) return;
    st.rotating = true;
    AudioSys.whoosh();
    if (st.view === 3) st.view = 0;
    await tween(st, { flip: 1 }, 0.45, 'inOut');
    st.view = (st.view + 1) % 3;
    this._shoeStatus();
    await tween(st, { flip: 0 }, 0.45, 'inOut');
    st.rotating = false;
  },
  zoomShoe(d) {
    const st = this.shoeSt;
    tween(st, { zoom: clamp(st.zoom + d, 0.8, 2.2) }, 0.5, 'out');
    AudioSys.softClick();
  },
  async openPod(open) {
    const st = this.shoeSt;
    AudioSys.pod();
    if (open) {
      if (st.view !== 1) { st.view = 1; this._shoeStatus(); }
      await tween(st, { pod: 1 }, 1, 'inOut');
      AudioSys.chime();
    } else {
      await tween(st, { pod: 0 }, 0.7, 'inOut');
    }
    this._shoeStatus();
  },
  drawShoe(t) {
    const ctx = this._shoeCtx;
    if (!ctx) return;
    const W = 860, H = 420;
    const st = this.shoeSt;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 420);
    g.addColorStop(0, 'rgba(24,44,74,0.5)');
    g.addColorStop(1, 'rgba(3,6,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(150,190,230,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.78, 240, 34, 0, 0, TAU);
    ctx.stroke();
    drawGlow(ctx, W / 2, H * 0.78, 250, 'rgba(120,170,240,0.16)', 0.5);

    ctx.save();
    ctx.translate(W / 2, H * 0.52 + Math.sin(t * 1.1) * 4);
    const flipX = Math.cos(Math.PI * st.flip);
    const sx = st.zoom * (Math.abs(flipX) < 0.06 ? 0.06 * (flipX < 0 ? -1 : 1) : flipX);
    ctx.scale(sx, st.zoom);
    if (st.view === 0) Scenes.drawShoeProfile(ctx, 0, 20, 1.5, { t, pod: st.pod, glow: 0.7 });
    else if (st.view === 1) Scenes.drawShoeHeel(ctx, 0, 10, 1.6, { t, pod: st.pod, glow: 0.7 });
    else if (st.view === 2) Scenes.drawShoeSole(ctx, 0, 0, 1.5, { t, glow: 0.7 });
    else Scenes.drawCapsuleView(ctx, 0, 0, 1.5, { hue: 150 }, t);
    ctx.restore();

    if (st.labels && st.flip < 0.2) this.drawShoeLabels(ctx, st.view, st.zoom);
    this._shoeStatus();
  },
  drawShoeLabels(ctx, view, zoom) {
    const W = 860, H = 420;
    const cx = W / 2, cy = H * 0.52 + 4;
    const labs = [];
    if (view === 0) {
      labs.push(['RELEASE HATCH', -170, -60, -95, -85]);
      labs.push(['REPLACEABLE POD', -190, 30, -95, -5]);
    } else if (view === 1) {
      labs.push(['RELEASE HATCH', 150, -60, 60, -20]);
      labs.push(['SEED CAPSULE', -170, -40, -30, -30]);
      labs.push(['GROWING MEDIUM', -180, 60, 0, 30]);
    } else if (view === 2) {
      labs.push(['REPLACEABLE POD', -230, -60, -120, 10]);
      labs.push(['GROWING MEDIUM', 180, 40, 60, 30]);
    } else {
      labs.push(['SEED CAPSULE', -180, -70, -30, -40]);
      labs.push(['GROWING MEDIUM', -190, 60, 0, 45]);
    }
    ctx.save();
    ctx.font = '10px Jost, sans-serif';
    ctx.textAlign = 'right';
    for (const [txt, tx, ty, ax, ay] of labs) {
      const x = cx + tx * zoom, y = cy + ty * zoom;
      const px = cx + ax * zoom, py = cy + ay * zoom;
      ctx.strokeStyle = 'rgba(255,217,160,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,225,175,0.95)';
      ctx.fillText(txt, x, y + 3);
      ctx.fillStyle = 'rgba(255,217,160,0.9)';
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  /* ================= SEED COLLECTION ================= */
  buildSeeds() {
    const scr = '#scr-seeds';
    const sc = $('#scr-seeds');
    sc.innerHTML = `
      <div class="shoe-head">
        <button class="hb ghost-btn" id="seedsBack">← BACK</button>
        <div class="panel-title">SEED COLLECTION</div>
        <div style="width:110px"></div>
      </div>
      <div class="seeds-body">
        <div class="seeds-grid" id="seedsGrid"></div>
        <div class="seeds-detail" id="seedsDetail"></div>
      </div>`;
    $('#seedsBack').addEventListener('click', () => { AudioSys.softClick(); UI.closeScreen(); });
    const grid = $('#seedsGrid');
    SEED_SPECS.forEach((s, i) => {
      const c = el('button', 'seed-card' + (i === this._seedSel ? ' sel' : ''), `
        <div class="sc-ico">${s.emoji}</div>
        <div><div class="sc-name">${s.name}</div><div class="sc-hint">${s.hint}</div></div>`);
      c.addEventListener('click', () => {
        AudioSys.chime();
        this._seedSel = i;
        $$('.seed-card').forEach((x, j) => x.classList.toggle('sel', j === i));
        this.refreshSeedsDetail();
        const d = $('#seedsDetail');
        d.style.boxShadow = `0 0 34px hsla(${s.hue},60%,50%,0.25)`;
      });
      grid.appendChild(c);
    });
    this._seedsCtx = null;
    this.refreshSeedsDetail();
  },
  refreshSeedsDetail() {
    const s = SEED_SPECS[this._seedSel];
    const d = $('#seedsDetail');
    d.innerHTML = `
      <canvas id="seedsCv" width="440" height="200"></canvas>
      <div class="sd-info">
        <h3>${s.emoji} ${s.name}</h3>
        <div class="sd-row"><span>SPECIES</span><span>${s.species}</span></div>
        <div class="sd-row"><span>HABITAT</span><span>${s.habitat}</span></div>
        <div class="sd-row"><span>GROWTH</span><span>${s.growth}</span></div>
        <div class="sd-row"><span>STATUS</span><span>${s.status}</span></div>
        <div class="sd-desc">“${s.desc}”</div>
      </div>`;
    this._seedsCtx = $('#seedsCv').getContext('2d');
  },
  drawSeeds(t) {
    const ctx = this._seedsCtx;
    if (!ctx) return;
    const s = SEED_SPECS[this._seedSel];
    const W = 440, H = 200;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsla(${s.hue},45%,16%,1)`);
    g.addColorStop(1, `hsla(${s.hue + 20},40%,8%,1)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      const x = (hash1(i * 3 + s.hue) * W + t * (8 + i)) % W;
      const y = hash1(i * 7 + s.hue) * H;
      drawGlow(ctx, x, y, 6 + Math.sin(t + i) * 3, `hsla(${s.hue},70%,70%,0.7)`, 0.4);
    }
    Scenes.drawCapsuleView(ctx, W * 0.3, H * 0.52, 0.9, s, t, Math.sin(t * 0.5) * 0.2);
    const stage = (Math.sin(t * 0.5) * 0.5 + 0.5) * 3;
    Scenes.drawGrowth(ctx, W * 0.68, H * 0.86, stage, t, 1.5, this._seedSel);
    ctx.fillStyle = 'rgba(230,240,250,0.55)';
    ctx.font = '10px Jost, sans-serif';
    ctx.fillText('LIVE SPECIMEN VIEW', 14, 20);
  },

  /* ================= OUR JOURNEY ================= */
  buildJourney() {
    const scr = $('#scr-journey');
    scr.innerHTML = `
      <div class="shoe-head" style="width:min(760px,92vw);margin:16px auto 0;">
        <button class="hb ghost-btn" id="jBack">← BACK</button>
        <div class="panel-title">OUR JOURNEY</div>
        <div style="width:110px"></div>
      </div>
      <div class="journey-wrap">
        <div class="j-progress">
          <div class="jp-val" id="jpVal">0%</div>
          <div class="jp-label">JOURNEY PROGRESS</div>
          <div class="j-track" id="jTrack"></div>
          <div class="j-miles" id="jMiles"></div>
        </div>
        <div class="j-sec-title">ACHIEVEMENTS</div>
        <div class="ach-grid" id="achGrid"></div>
      </div>`;
    $('#jBack').addEventListener('click', () => { AudioSys.softClick(); UI.closeScreen(); });
  },
  journeyRefresh() {
    const jv = $('#jpVal');
    if (!jv) return;
    const p = Game.progress();
    jv.textContent = p + '%';
    const ms = Game.milestones();
    const track = $('#jTrack');
    track.innerHTML = ms.map((m, i) =>
      `<div class="jt-node ${m.done ? 'done' : ''}" title="${m.label}"></div>` +
      (i < ms.length - 1 ? `<div class="jt-line ${ms[i + 1].done ? 'done' : ''}"></div>` : '')
    ).join('');
    $('#jMiles').innerHTML = ms.map(m => `<div class="jm ${m.done ? 'done' : ''}">${m.label} ${m.done ? '✓' : '○'}</div>`).join('');
    $('#achGrid').innerHTML = Object.keys(ACH).map(k => {
      const a = ACH[k], got = !!Game.achievements[k];
      return `<div class="ach-card ${got ? 'got' : ''}">
        <div class="a-ico">${a.icon}</div>
        <div class="a-name">${a.name}</div>
        <div class="a-text">“${a.text}”</div>
      </div>`;
    }).join('');
  },

  /* ================= MEMORIES ================= */
  buildMemories() {
    const scr = $('#scr-memories');
    scr.innerHTML = `
      <div class="shoe-head" style="width:min(1150px,95vw);margin:16px auto 0;">
        <button class="hb ghost-btn" id="memBack">← BACK</button>
        <div class="panel-title">MEMORIES</div>
        <div style="width:110px"></div>
      </div>
      <div class="mem-row" id="memRow"></div>`;
    $('#memBack').addEventListener('click', () => { AudioSys.softClick(); UI.closeScreen(); });
    const row = $('#memRow');
    const thumbs = {
      meet: ['linear-gradient(160deg,#0a1c34,#123055)', '☾'],
      forest: ['linear-gradient(160deg,#050b18,#123055)', '✦'],
      seed: ['linear-gradient(160deg,#0e2440,#2c5a42)', '🌱'],
      abstract: ['linear-gradient(160deg,#0e0a20,#3c2c5c)', '◈'],
      mountain: ['linear-gradient(160deg,#274a66,#5f9460)', '⛰️']
    };
    Object.keys(MEMORIES).forEach(k => {
      const m = MEMORIES[k], got = !!Game.memoriesUnlocked[k];
      const c = el('button', 'mem-card' + (got ? '' : ' locked'), `
        <div class="m-thumb" style="background:${thumbs[k][0]}"><div class="mt-emoji">${got ? thumbs[k][1] : '?'}</div></div>
        <div class="m-title">${got ? m.title : '· · ·'}</div>
        <div class="m-sub">${got ? m.sub : 'Not yet remembered.'}</div>`);
      c.addEventListener('click', () => {
        if (!got) { UI.toastText('MEMORY', 'This moment has not happened yet.'); return; }
        this.replayMemory(k);
      });
      row.appendChild(c);
    });
    const rp = $('#replay');
    rp.innerHTML = `
      <canvas id="replayCv"></canvas>
      <div class="rp-cap" id="rpCap"></div>
      <button class="hb ghost-btn rp-close" id="rpClose">CLOSE ✕</button>`;
    $('#rpClose').addEventListener('click', () => {
      AudioSys.softClick();
      rp.classList.remove('on');
      this._replayKind = null;
    });
  },
  replayMemory(kind) {
    AudioSys.transition();
    this._replayKind = kind;
    this._replayT = 0;
    const rp = $('#replay');
    this._replayCtx = fitCanvas($('#replayCv'));
    const cap = $('#rpCap');
    cap.textContent = MEMORIES[kind].sub;
    rp.classList.add('on');
    requestAnimationFrame(() => cap.classList.add('vis'));
    setTimeout(() => cap.classList.remove('vis'), 3200);
  },
  drawReplay(dt, t) {
    if (!this._replayKind) return;
    const ctx = this._replayCtx;
    const W = window.innerWidth, H = window.innerHeight;
    const kind = this._replayKind;
    this._replayT += dt;
    const tt = this._replayT;
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, W, H);
    if (kind === 'meet') {
      Scenes.drawGray(ctx, W * 0.5 - 70, H * 0.62, 1.3, { t: tt, dir: 1, moving: false });
      Scenes.drawJuvia(ctx, W * 0.5 + 70, H * 0.62, 1.26, { t: tt + 1, dir: -1, moving: false });
      for (let i = 0; i < 8; i++) drawGlow(ctx, W * 0.5 + Math.sin(tt * 0.6 + i * 2) * (150 + i * 22), H * 0.42 + Math.cos(tt * 0.5 + i) * 40, 9, 'rgba(190,235,150,0.8)', 0.6);
    } else if (kind === 'forest') {
      for (let i = 0; i < 7; i++) Scenes.treeDead(ctx, W * 0.12 + i * W * 0.13, H * 0.66, 1.6 + hash1(i) * 0.8, '#0c1626', Math.sin(tt + i) * 2);
      for (let i = 0; i < 12; i++) drawGlow(ctx, (hash1(i * 3) * W + tt * 20) % W, H * 0.3 + hash1(i * 7) * H * 0.3, 9, 'rgba(190,235,150,0.85)', 0.5 + 0.4 * Math.sin(tt * 2 + i));
    } else if (kind === 'seed') {
      Scenes.drawGrowth(ctx, W * 0.5, H * 0.66, (tt % 6) / 2, tt, 2.2, 1);
      this._rpRip = (this._rpRip || 0) + dt;
      if (this._rpRip > 0.9) { this._rpRip = 0; Ripples.add(W * 0.5, H * 0.66, 90, 'rgba(180,240,190,'); }
      Ripples.draw(ctx);
    } else if (kind === 'abstract') {
      ctx.save();
      ctx.translate(W / 2, H * 0.5);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(tt * (0.2 + i * 0.12) + i);
        ctx.translate(80 + i * 60, 0);
        ctx.strokeStyle = ['rgba(150,120,255,0.7)', 'rgba(120,200,255,0.7)', 'rgba(255,150,220,0.7)'][i % 3];
        ctx.lineWidth = 1.4;
        if (i % 2) { ctx.strokeRect(-16, -16, 32, 32); }
        else { ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    } else if (kind === 'mountain') {
      Scenes.sun(ctx, W * 0.5, H * 0.3, 30, tt, 1);
      Scenes.ridge(ctx, H * 0.6, 120, '#3c6347', 87, 0);
      for (let i = 0; i < 9; i++) Scenes.drawGrowth(ctx, W * (0.2 + i * 0.08), H * 0.7 + Math.sin(i) * 20, 3, tt + i, 1.1, i % 3);
      Particles.draw(ctx);
    }
    ctx.fillStyle = '#010208';
    ctx.fillRect(0, 0, W, H * 0.1);
    ctx.fillRect(0, H * 0.9, W, H * 0.1);
  },

  /* ================= PHOTO UI ================= */
  buildPhotoUI() {
    const p = $('#photoUI');
    p.innerHTML = `
      <div class="ph-top">
        <div class="hud-prog" style="text-align:center;">
          <div class="hp-label">PHOTO MODE</div>
          <div class="hp-val" style="font-size:13px;letter-spacing:.3em;">MOVE THE CAMERA · CHOOSE A FILTER</div>
        </div>
      </div>
      <div class="ph-filters">
        ${Object.keys(PHOTO_FILTERS).map(f => `<button class="phf" data-f="${f}">${f}</button>`).join('')}
        <button class="phf" data-f="">NO FILTER</button>
      </div>
      <div class="ph-hint">[ MOUSE ] PAN · [ P / ESC ] EXIT</div>`;
    p.querySelectorAll('.phf').forEach(b => {
      b.addEventListener('click', () => {
        AudioSys.softClick();
        p.querySelectorAll('.phf').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        Game.setPhotoFilter(b.dataset.f || null);
      });
    });
    const cap = el('button', 'hb primary', 'CAPTURE');
    cap.style.cssText = 'position:absolute;right:30px;bottom:calc(11vh + 18px);pointer-events:auto;';
    cap.addEventListener('click', () => Game.capture());
    p.appendChild(cap);
    const ex = el('button', 'hb ghost-btn', 'EXIT PHOTO MODE');
    ex.style.cssText = 'position:absolute;left:30px;top:calc(11vh + 52px);pointer-events:auto;';
    ex.addEventListener('click', () => Game.exitPhoto());
    p.appendChild(ex);
  },
  flash() {
    const f = $('#flash');
    f.style.transition = 'none';
    f.style.opacity = '0.85';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity .55s ease';
      f.style.opacity = '0';
    });
  },

  /* ================= GLOBAL BINDINGS ================= */
  bindGlobal() {
    document.addEventListener('pointermove', e => {
      const b = e.target && e.target.closest ? e.target.closest('.hb') : null;
      if (b !== this._hovBtn) {
        if (this._hovBtn) this._hovBtn.style.transform = '';
        this._hovBtn = b;
        if (b) { AudioSys.hover(); this._hovT = 0; }
      }
      if (b) {
        const r = b.getBoundingClientRect();
        const dx = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -0.5, 0.5);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) / r.height, -0.5, 0.5);
        const sc = b.dataset.press ? 0.955 : 1.045;
        b.style.transform = `translate(${dx * 9}px, ${dy * 7}px) scale(${sc})`;
        this._hovT++;
        if (this._hovT % 9 === 0) {
          Particles.spark(
            r.left + rand(0, r.width),
            Math.random() < 0.5 ? r.top : r.bottom,
            'rgba(143,211,255,0.55)', 2, 0.6);
        }
      }
    });
    document.addEventListener('pointerdown', e => {
      const b = e.target && e.target.closest ? e.target.closest('.hb') : null;
      if (b) b.dataset.press = '1';
    });
    document.addEventListener('pointerup', e => {
      const b = e.target && e.target.closest ? e.target.closest('.hb') : null;
      if (b) { delete b.dataset.press; b.style.transform = ''; }
    });
    document.addEventListener('pointerout', e => {
      const b = e.target && e.target.closest ? e.target.closest('.hb') : null;
      if (b && b === this._hovBtn && (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest('.hb') !== b)) {
        b.style.transform = '';
        this._hovBtn = null;
      }
    });
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('.hb, .tool-btn, .map-node, .phf, .seed-card, .char-chip') : null;
      if (b) {
        AudioSys.click();
        const r = b.getBoundingClientRect();
        const rip = el('span', 'btn-rip');
        rip.style.left = (e.clientX - r.left) + 'px';
        rip.style.top = (e.clientY - r.top) + 'px';
        if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
        b.appendChild(rip);
        setTimeout(() => rip.remove(), 520);
        Particles.spark(e.clientX, e.clientY, 'rgba(180,225,255,0.7)', 8, 1.6);
      }
    });
    document.addEventListener('animationend', e => {
      if (e.target.classList && e.target.classList.contains('rise')) {
        e.target.classList.remove('rise');
        e.target.style.animation = 'none';
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('#modalWrap').classList.contains('on')) { this.closeModal(); return; }
        if ($('#replay').classList.contains('on')) { $('#rpClose').click(); return; }
        if (this._dlg) { this.hideDialogue(); return; }
        if (this._infoOpen) { $('#ipClose') && $('#ipClose').click(); return; }
        if (Game.photo.on) { Game.exitPhoto(); return; }
        const open = $$('.screen.on');
        if (open.length) {
          const scr = open[0];
          if (scr.querySelector('#shoeBack')) scr.querySelector('#shoeBack').click();
          else if (scr.querySelector('#seedsBack')) scr.querySelector('#seedsBack').click();
          else if (scr.querySelector('#jBack')) scr.querySelector('#jBack').click();
          else if (scr.querySelector('#memBack')) scr.querySelector('#memBack').click();
          else if (scr.querySelector('#mapBack')) scr.querySelector('#mapBack').click();
          else if (scr.id === 'scr-menu' && this._screenCb) this.closeScreen();
          return;
        }
        if (Game.state === 'world') this.pauseToMenu();
      }
    });
  }
};

/* ============================================================
   SEED SPECIFICATIONS
   ============================================================ */
const SEED_SPECS = [
  { emoji: '🌱', name: 'Wildflower', species: 'Lumen Wildflower “Ashveil”', habitat: 'Dark forest edges', growth: '7 days · low light', status: 'READY', hue: 190, hint: 'stores moonlight in its petals', desc: 'Pale blue petals that keep a little of the night inside them.' },
  { emoji: '🌿', name: 'Native Grass', species: 'Whispergrass “Meadowveil”', habitat: 'Valley meadows', growth: '5 days · moist soil', status: 'READY', hue: 120, hint: 'hums when the wind is right', desc: 'It hums softly when the wind crosses the valley just right.' },
  { emoji: '🌼', name: 'Mountain Flower', species: 'Sunpetal “Highroad”', habitat: 'Alpine slopes', growth: '10 days · full sun', status: 'READY', hue: 42, hint: 'opens only at altitude', desc: 'Small, stubborn, golden. It waited all winter for one clear morning.' },
  { emoji: '🍃', name: 'Forest Plant', species: 'Fernlung “Deepgreen”', habitat: 'Old-growth shade', growth: '8 days · shade', status: 'READY', hue: 160, hint: 'breathes with the fog', desc: 'Its leaves rise and fall slowly, breathing with the fog.' }
];

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
const Cursor = {
  x: window.innerWidth / 2, y: window.innerHeight / 2,
  tx: window.innerWidth / 2, ty: window.innerHeight / 2,
  init() {
    const c = $('#cursor');
    document.addEventListener('pointermove', e => {
      this.tx = e.clientX; this.ty = e.clientY;
      c.classList.remove('hidden');
    });
    document.addEventListener('pointerdown', () => { c.classList.add('down'); Cursor.burst(this.tx, this.ty); });
    document.addEventListener('pointerup', () => c.classList.remove('down'));
    document.addEventListener('mouseleave', () => c.classList.add('hidden'));
    document.addEventListener('pointerenter', () => c.classList.remove('hidden'));
  },
  update() {
    this.x = lerp(this.x, this.tx, 0.35);
    this.y = lerp(this.y, this.ty, 0.35);
    $('#cursor').style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
  },
  hot(on) { $('#cursor').classList.toggle('hot', on); },
  burst(x, y) {
    const r = el('div', 'click-ripple');
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
    Particles.spark(x, y, 'rgba(200,235,255,0.8)', 7, 1.4);
  }
};
