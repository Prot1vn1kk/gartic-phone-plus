/* ───────────────────────────── Таймлапс ─────────────────────────────
   Рисунок в альбоме приходит списком штрихов, поэтому процесс рисования можно воспроизвести.
   Открыть: двойной клик / средняя кнопка по рисунку в альбоме или кнопка ▶ на рисунке.        */

const PLAYER_CSS = `
.gpp-player .gpp-win-body{padding:10px;display:flex;flex-direction:column;gap:8px}
.gpp-player canvas{width:100%;flex:1;min-height:0;object-fit:contain;background:transparent;display:block}
.gpp-player-ctrl{display:flex;align-items:center;gap:6px}
.gpp-player-ctrl input[type=range]{flex:1;accent-color:var(--gpp-accent);min-width:0}
.gpp-player-ctrl .gpp-select{padding:3px 4px;font-size:12px}
.gpp-player-time{color:var(--gpp-dim);font:12px var(--gpp-f-bold);font-variant-numeric:tabular-nums;width:74px;text-align:right}
.gpp-inline{position:absolute;inset:0;z-index:4;background:#fff;border-radius:inherit;overflow:hidden}
.gpp-inline canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.gpp-inline .gpp-player-ctrl{position:absolute;left:8px;right:8px;bottom:8px;padding:5px 6px;border-radius:10px;background:var(--gpp-head);
box-shadow:inset 0 0 0 2px var(--gpp-head-hi),0 3px 0 rgba(23,5,87,.5);opacity:0;transform:translateY(6px);transition:opacity .15s,transform .15s}
.gpp-inline:hover .gpp-player-ctrl,.gpp-inline.paused .gpp-player-ctrl{opacity:1;transform:none}
.gpp-play-badge{position:absolute;right:8px;bottom:8px;z-index:3;height:34px;padding:0 12px 0 9px;border-radius:9px;border:0;cursor:pointer;display:flex;align-items:center;gap:5px;
background:linear-gradient(#8dffd0,#3ee6a0);color:rgb(23,5,87);font:13px/1 var(--gpp-f-black);text-transform:uppercase;box-shadow:inset 0 0 0 2px #c8ffe8,0 3px 0 #1f9e6c;opacity:.92}
.gpp-play-badge:hover{opacity:1;filter:brightness(1.05)}
.gpp-play-badge svg{width:14px;height:14px}
.gpp-rec{color:#ff5a7a !important}
`;

/* «Стоимость» штриха во времени: 60 единиц = 1 секунда на скорости ×1.
   Пауза между штрихами (STROKE_GAP) делает короткие рисунки различимыми. */
const STROKE_GAP = 12;
function strokeCost(v) {
  if (v[0] === TOOL.PEN || v[0] === TOOL.ERASER) return STROKE_GAP + Math.max(1, (v.length - 3) / 2);
  return STROKE_GAP + (v[0] === TOOL.FILL ? 18 : 14);
}

function partialStroke(v, k) {
  if (v[0] !== TOOL.PEN && v[0] !== TOOL.ERASER) return v;
  return v.slice(0, 3 + 2 * Math.max(1, Math.floor(k - STROKE_GAP)));
}

/* Плеер работает в двух видах: прямо в карточке рисунка альбома (host) или в отдельном окне. */
class Player {
  constructor(strokes, { title, W = 1516, H = 848, host = null }) {
    this.strokes = strokes.filter(Array.isArray);
    this.costs = this.strokes.map(strokeCost);
    this.total = this.costs.reduce((a, b) => a + b, 0) || 1;
    this.W = W; this.H = H; this.title = title;
    this.t = 0; this.done = 0; this.playing = false;
    this.layer = h('canvas', { width: W, height: H });
    this.lctx = this.layer.getContext('2d');
    this.canvas = h('canvas', { width: W, height: H });
    this.ctx = this.canvas.getContext('2d');

    this.playBtn = h('button', { class: 'gpp-icon-btn', title: 'Пуск / пауза (пробел)', html: ICON.play, onclick: () => this.toggle() });
    this.seek = h('input', { type: 'range', min: 0, max: this.total, step: 0.5, value: 0 });
    this.seek.addEventListener('input', () => { this.pause(); this.seekTo(+this.seek.value); });
    this.time = h('span', { class: 'gpp-player-time' });
    this.speed = UI.select(String(Settings.get('player', 'speed')), [['0.25', '×0.25'], ['0.5', '×0.5'], ['1', '×1'], ['2', '×2'], ['4', '×4'], ['8', '×8'], ['16', '×16']], v => Settings.set('player', 'speed', +v));
    this.recBtn = h('button', { class: 'gpp-icon-btn', title: 'Записать видео WebM', html: ICON.video, onclick: () => this.record() });
    this.ctrl = h('div', { class: 'gpp-player-ctrl' },
      this.playBtn,
      h('button', { class: 'gpp-icon-btn', title: 'С начала', html: ICON.restart, onclick: () => { this.seekTo(0); this.play(); } }),
      this.seek, this.time, this.speed,
      h('button', { class: 'gpp-icon-btn', title: 'Сохранить PNG', html: ICON.download, onclick: () => this.savePng() }),
      this.recBtn);

    if (host) {
      this.root = h('div', { class: 'gpp gpp-inline paused' }, this.canvas, this.ctrl);
      this.ctrl.append(
        h('button', { class: 'gpp-icon-btn', title: 'Открыть в большом окне', html: ICON.target, onclick: () => this.popOut() }),
        h('button', { class: 'gpp-icon-btn', title: 'Закрыть плеер', html: ICON.close, onclick: () => this.close() }));
      for (const t of ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick']) this.root.addEventListener(t, e => e.stopPropagation());
      this.root.addEventListener('click', e => { if (e.target === this.canvas) this.toggle(); });
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.append(this.root);
    } else {
      this.win = new Win({ id: 'player', title: '<b>GP+</b> ' + (title || 'Таймлапс'), width: 640, height: 450, x: 120, y: 80, resizable: true, className: 'gpp-player gpp' });
      this.win.body.append(this.canvas, this.ctrl);
      this.win.body.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); this.toggle(); } });
      this.win.body.tabIndex = 0;
      this.win.on('hide', () => this.close());
      this.win.show();
    }
    this.seekTo(Settings.get('player', 'autoplay') ? 0 : this.total);
    if (Settings.get('player', 'autoplay')) this.play();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pause();
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.root?.remove();
    if (this.win) { this.win.el.remove(); }
    if (Timelapse.current === this) Timelapse.current = null;
  }

  popOut() {
    const t = this.t;
    this.close();
    Timelapse.current = new Player(this.strokes, { title: this.title, W: this.W, H: this.H });
    Timelapse.current.pause();
    Timelapse.current.seekTo(t);
    Timelapse.current.play();
  }

  seekTo(t) {
    t = clamp(t, 0, this.total);
    if (t < this.t || t === 0) { this.lctx.clearRect(0, 0, this.W, this.H); this.done = 0; this.acc = 0; }
    this.t = t;
    let acc = this.acc || 0;
    while (this.done < this.strokes.length && acc + this.costs[this.done] <= t) {
      renderStroke(this.lctx, this.strokes[this.done]);
      acc += this.costs[this.done];
      this.done++;
    }
    this.acc = acc;
    this.paint(t - acc);
  }

  paint(partial) {
    const c = this.ctx;
    c.fillStyle = '#fff'; c.fillRect(0, 0, this.W, this.H);
    if (partial > STROKE_GAP && this.done < this.strokes.length) {
      const v = this.strokes[this.done];
      if (v[0] === TOOL.ERASER) {
        const tmp = Player.tmp ||= h('canvas');
        tmp.width = this.W; tmp.height = this.H;
        const tc = tmp.getContext('2d');
        tc.drawImage(this.layer, 0, 0); renderStroke(tc, partialStroke(v, partial));
        c.drawImage(tmp, 0, 0);
      } else {
        c.drawImage(this.layer, 0, 0);
        if (v[0] === TOOL.PEN) renderStroke(c, partialStroke(v, partial));
      }
    } else c.drawImage(this.layer, 0, 0);
    this.seek.value = this.t;
    const sec = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
    this.time.textContent = `${sec(this.t / 60)} / ${sec(this.total / 60)}`;
  }

  play() {
    if (this.t >= this.total) this.seekTo(0);
    this.playing = true;
    this.playBtn.innerHTML = ICON.pause;
    this.root?.classList.remove('paused');
    let last = performance.now();
    const step = now => {
      if (!this.playing) return;
      const dt = (now - last) / 1000; last = now;
      this.seekTo(this.t + dt * 60 * Settings.get('player', 'speed'));
      if (this.t >= this.total) { this.pause(); this.emitEnd?.(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  pause() { this.playing = false; cancelAnimationFrame(this.raf); this.playBtn.innerHTML = ICON.play; this.root?.classList.add('paused'); }
  toggle() { this.playing ? this.pause() : this.play(); }

  savePng() {
    const c = h('canvas', { width: this.W, height: this.H });
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, this.W, this.H);
    for (const v of this.strokes) renderStroke(x, v);
    const tmp = h('canvas', { width: this.W, height: this.H });
    const tx = tmp.getContext('2d');
    tx.fillStyle = '#fff'; tx.fillRect(0, 0, this.W, this.H);
    tx.drawImage(c, 0, 0);
    tmp.toBlob(b => downloadBlob(b, 'gartic-drawing.png'));
  }

  record() {
    if (this.recorder) return this.recorder.stop();
    if (!window.MediaRecorder || !this.canvas.captureStream) return toast('Браузер не поддерживает запись видео');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(this.canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6e6 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      this.recorder = null; this.recBtn.classList.remove('gpp-rec'); this.emitEnd = null;
      if (chunks.length) downloadBlob(new Blob(chunks, { type: 'video/webm' }), 'gartic-timelapse.webm');
    };
    this.recorder = rec;
    this.recBtn.classList.add('gpp-rec');
    toast('Запись идёт до конца рисунка. Нажмите кнопку ещё раз, чтобы остановить.');
    this.seekTo(0);
    rec.start();
    this.emitEnd = () => setTimeout(() => rec.state === 'recording' && rec.stop(), 600);
    this.play();
  }
}

const Timelapse = new (class {
  init() {
    injectCss(PLAYER_CSS, 'gpp-player-css');
    this.current = null;
    Net.on('album:item', () => this.decorateSoon());
    Net.on('screen', () => this.decorateSoon());
    new MutationObserver(() => this.decorateSoon()).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('dblclick', e => { if (Settings.get('player', 'openOnDblClick')) this.onClick(e); }, true);
    document.addEventListener('auxclick', e => { if (e.button === 1) this.onClick(e); }, true);
    document.addEventListener('mousedown', e => { if (e.button === 1 && this.findTarget(e.target)) e.preventDefault(); }, true);
  }

  decorateSoon() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.decorate(); });
  }

  /* Возвращает { strokes, title, W, H, host } для элемента, по которому кликнули, или null.
     host — область рисунка в карточке альбома, куда встраивается плеер. */
  findTarget(el) {
    if (!el || el.closest?.('.gpp-win, .gpp-stage, .gpp-inline')) return null;
    const item = el.closest?.('.timeline .item');
    if (item) {
      const items = [...document.querySelectorAll('.timeline .item')];
      const idx = items.indexOf(item);
      const data = Net.album.items[idx];
      if (!data || !Array.isArray(data.data)) return null;
      const cv = item.querySelector('canvas');
      const host = item.querySelector('.balloon .content') || cv?.parentElement || null;
      return { strokes: data.data, title: `${data.user?.nick || ''} — ${Net.album.author?.nick ? 'альбом ' + Net.album.author.nick : 'альбом'}`, W: cv?.width || 1516, H: cv?.height || 848, host };
    }
    if (Net.state.screen === SCREEN.DESCRIPTION && el.tagName === 'CANVAS' && Array.isArray(Net.state.previous?.data)) {
      return { strokes: Net.state.previous.data, title: 'Предыдущий рисунок', W: el.width || 1516, H: el.height || 848, host: null };
    }
    return null;
  }

  onClick(e) {
    const t = this.findTarget(e.target);
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    this.open(t);
  }

  open({ strokes, title, W, H, host }) {
    if (!strokes?.length) return toast('В этом рисунке нет штрихов');
    this.current?.close();
    this.current = new Player(strokes, { title, W, H, host });
  }

  decorate() {
    const items = document.querySelectorAll('.timeline .item');
    items.forEach((item, idx) => {
      const data = Net.album.items[idx];
      if (!data || !Array.isArray(data.data) || item.querySelector('.gpp-play-badge')) return;
      const host = item.querySelector('.balloon') || item.querySelector('.drawingmode') || item;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.append(h('button', {
        class: 'gpp-play-badge gpp', title: 'Таймлапс: как это рисовали (двойной клик по рисунку)', html: ICON.play + '<span>Таймлапс</span>',
        onclick: e => { e.stopPropagation(); this.open(this.findTarget(item)); },
      }));
    });
  }
})();
