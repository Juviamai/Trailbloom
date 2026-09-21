'use strict';
/* ============================================================
   TRAILBLOOM — main.js
   Boot, opening cinematic, main loop, input.
   ============================================================ */

const Main = {
  intro: null,
  sctx: null, fctx: null,
  last: 0,

  init() {
    Game.boot();
    UI.init();
    this.sctx = fitCanvas($('#scene'));
    this.fctx = fitCanvas($('#fx'));
    Scenes.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', () => {
      this.sctx = fitCanvas($('#scene'));
      this.fctx = fitCanvas($('#fx'));
      Scenes.setSize(window.innerWidth, window.innerHeight);
    });
    this.bindInput();
    requestAnimationFrame(ts => this.loop(ts));
    this.runIntro();
  },

  /* ================= INPUT ================= */
  bindInput() {
    /* audio unlock on first gesture */
    const unlock = () => { AudioSys.init(); AudioSys.resume(); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      Game.keys[k] = true;
      if (k === 'shift') Game.walker.run = true;
      if (k === 'e' && Game.state === 'world' && !Game.inputLock && !UI._dlg && !UI._infoOpen) {
        const h = Game.near;
        if (h) {
          if (h.type === 'plant' && !h.planted) Game.tryPlant(h);
          else Game.interact(h);
        }
      }
      if (k === 'm' && Game.state === 'world' && !Game.inputLock) Game.toMap();
      if (k === 'p') {
        if (Game.photo.on) Game.exitPhoto();
        else Game.enterPhoto();
      }
    });
    document.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      delete Game.keys[k];
      if (k === 'shift') Game.walker.run = false;
    });

    document.addEventListener('pointermove', e => {
      Game.mouse.x = e.clientX;
      Game.mouse.y = e.clientY;
    });

    /* click-to-move + character clicks */
    $('#scene').addEventListener('pointerdown', e => {
      if (Game.state !== 'world' || Game.inputLock || UI._dlg || UI._infoOpen || Game.photo.on) return;
      const W = window.innerWidth;
      /* character hit test */
      for (const key of ['juvia', 'gray']) {
        const ch = Game[key];
        const p = Game.project(ch.x, Game.groundY() - 50);
        if (dist(e.clientX, e.clientY, p.x, p.y) < 55) {
          Game.charClick(key);
          return;
        }
      }
      const z = Game.cam.z, cx = W / 2;
      const pre = (e.clientX - cx) / z + cx;
      const wx = pre - cx + Game.cam.fx + Game.cam.offset;
      Game.walker.target = clamp(wx, 90, Game.world.width - 120);
    });
  },

  /* ================= OPENING CINEMATIC ================= */
  async runIntro() {
    Game.state = 'intro';
    const p = { ff: 0, light: 0, mtn: 0, chars: 0, shoe: 0 };
    const I = this.intro = { p, skip: false };
    const gone = () => I.skip;
    const st = async (ms) => { await delay(gone() ? 60 : ms); };
    $('#btnSkip').addEventListener('click', () => { I.skip = true; AudioSys.click(); });

    Game.fireflies.setCount(0);

    /* 1–2. darkness, then tiny particles */
    await st(900);
    const sparkT = setInterval(() => {
      if (I.skip || Game.state !== 'intro') { clearInterval(sparkT); return; }
      Particles.pollen(rand(window.innerWidth), rand(window.innerHeight * 0.4, window.innerHeight * 0.85), 2, 'rgba(160,200,240,0.7)');
    }, 260);
    await st(1700);

    /* 3. one firefly crosses the screen */
    Game.fireflies.setCount(1);
    await st(3600);

    /* 4. more fireflies gather */
    for (let i = 0; i < 9 && !gone(); i++) {
      Game.fireflies.setCount(1 + i);
      AudioSys.firefly();
      await st(420);
    }

    /* 5. soft blue light */
    tween(p, { light: 1 }, gone() ? 0.1 : 2.4, 'inOut');
    await st(2500);

    /* 6. the mountain appears */
    AudioSys.whoosh();
    tween(p, { mtn: 1 }, gone() ? 0.1 : 2.1, 'out');
    await st(2200);

    /* 7. Gray and Juvia appear */
    tween(p, { chars: 1 }, gone() ? 0.1 : 1.6, 'inOut');
    await st(1800);

    /* 8. the Trailbloom shoe becomes visible */
    tween(p, { shoe: 1 }, gone() ? 0.1 : 1.6, 'inOut');
    await st(1800);

    /* 9. title */
    $('#introUI').classList.add('titleIn');
    AudioSys.chime();
    await st(2100);

    /* 10. subtitle */
    $('#introUI').classList.add('subIn');
    await st(1600);

    clearInterval(sparkT);
    /* hand over to the main menu */
    $('#btnSkip').style.opacity = '0';
    const iu = $('#introUI');
    iu.style.transition = 'opacity 1.2s ease';
    iu.style.opacity = '0';
    await delay(1200);
    iu.style.display = 'none';
    Game.state = 'menu';
    AudioSys.ambient('dark');
    UI.showMenu();
  },

  /* ================= MAIN LOOP ================= */
  loop(ts) {
    const dt = clamp((ts - this.last) / 1000, 0, 0.05);
    this.last = ts;
    try {
      Game.update(dt);
      Particles.update(dt);
      Ripples.update(dt);
      Game.renderScene(this.sctx);
      Game.renderFX(this.fctx, dt);
      if ($('#scr-shoe').classList.contains('on')) UI.drawShoe(Game.time);
      if ($('#scr-seeds').classList.contains('on')) UI.drawSeeds(Game.time);
      if ($('#replay').classList.contains('on')) UI.drawReplay(dt, Game.time);
      Cursor.update();
    } catch (err) {
      if (!this._errOnce) { this._errOnce = true; console.error(err); }
    }
    requestAnimationFrame(t => this.loop(t));
  }
};

window.addEventListener('load', () => Main.init());
