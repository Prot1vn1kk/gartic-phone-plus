/* ───────────────────────────── Таймлапс ─────────────────────────────
   Рисунок в альбоме приходит списком штрихов, поэтому процесс рисования можно воспроизвести.
   Открыть: кнопка «Таймлапс», двойной клик или средняя кнопка по рисунку в альбоме.
   Время каждого штриха игра не передаёт: для чужих рисунков график строится по ходу рисования,
   для своих скрипт записывает реальное время штрихов во время хода.                        */

const PLAYER_CSS = `
.gpp-tl{position:relative;overflow:hidden;background:#fff;user-select:none;outline:none;color:#fff;font:12px var(--gpp-f-bold)}
.gpp-tl canvas.gpp-tl-cv{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:pointer}
.gpp-tl.inline{position:absolute;inset:0;z-index:4;border-radius:inherit}
.gpp-tl.window{width:100%;height:100%;border-radius:0 0 12px 12px}
.gpp-tl.expanded,.gpp-tl:fullscreen{background:#0b0620}
.gpp-tl-expand-host{position:absolute;inset:0;z-index:250;background:rgba(10,4,30,.92);padding:14px;border-radius:inherit}
.gpp-tl-expand-host .gpp-tl{width:100%;height:100%;border-radius:12px}
.gpp-tl-close{position:absolute;right:8px;top:8px;z-index:6;width:30px;height:30px;border-radius:8px;border:0;background:rgba(23,5,87,.55);color:#fff;cursor:pointer;display:grid;place-items:center;opacity:0;transition:opacity .15s}
.gpp-tl-close svg{width:16px;height:16px}
.gpp-tl:hover .gpp-tl-close,.gpp-tl.paused .gpp-tl-close{opacity:1}
.gpp-tl-bottom{position:absolute;left:0;right:0;bottom:0;z-index:5;padding:26px 10px 6px;background:linear-gradient(transparent,rgba(12,4,40,.82));opacity:0;transition:opacity .2s}
.gpp-tl:hover .gpp-tl-bottom,.gpp-tl.paused .gpp-tl-bottom{opacity:1}
.gpp-tl-chart{display:block;width:100%;height:24px;cursor:pointer}
.gpp-tl-bar{position:relative;height:5px;margin:3px 0 6px;border-radius:3px;background:rgba(255,255,255,.25);cursor:pointer}
.gpp-tl-bar:hover{height:7px;margin:2px 0 5px}
.gpp-tl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--gpp-accent)}
.gpp-tl-knob{position:absolute;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--gpp-accent)}
.gpp-tl-ctrl{display:flex;align-items:center;gap:2px}
.gpp-tl-ctrl .gpp-icon-btn{width:30px;height:28px}
.gpp-tl-ctrl .gpp-icon-btn svg{width:17px;height:17px}
.gpp-tl-speed{position:relative;min-width:44px;height:24px;padding:0 7px;border-radius:7px;background:rgba(255,255,255,.14);display:grid;place-items:center;cursor:ew-resize;font:12px var(--gpp-f-black)}
.gpp-tl-speed:hover{background:rgba(255,255,255,.24)}
.gpp-tl-speedpop{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);width:180px;padding:8px 10px;border-radius:9px;background:var(--gpp-head);box-shadow:inset 0 0 0 2px var(--gpp-head-hi);display:none}
.gpp-tl-speed.active .gpp-tl-speedpop{display:block}
.gpp-tl-speedpop .track{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.25)}
.gpp-tl-speedpop .fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--gpp-accent)}
.gpp-tl-count{margin-left:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.gpp-tl-count small{color:var(--gpp-dim);font:11px var(--gpp-f-reg);margin-left:6px}
.gpp-tl-sp{flex:1}
.gpp-tl-tip{position:absolute;bottom:100%;transform:translateX(-50%);margin-bottom:4px;padding:5px 8px;border-radius:7px;background:var(--gpp-edge);white-space:nowrap;font:11px var(--gpp-f-bold);pointer-events:none;display:none}
.gpp-tl-pop{position:absolute;inset:0;z-index:7;display:none;align-items:center;justify-content:center;background:rgba(12,4,40,.55);backdrop-filter:blur(6px)}
.gpp-tl-pop.open{display:flex}
.gpp-tl-menu{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px}
.gpp-tl-menu button{width:104px;padding:12px 6px;border:0;border-radius:12px;background:var(--gpp-head);box-shadow:inset 0 0 0 2px var(--gpp-head-hi),0 3px 0 rgba(0,0,0,.3);color:#fff;cursor:pointer;
display:flex;flex-direction:column;align-items:center;gap:7px;font:11.5px/1.2 var(--gpp-f-bold)}
.gpp-tl-menu button:hover{box-shadow:inset 0 0 0 2px var(--gpp-accent),0 3px 0 rgba(0,0,0,.3)}
.gpp-tl-menu svg{width:26px;height:26px}
.gpp-tl-stats{max-width:min(420px,92%);max-height:88%;overflow:auto;padding:12px 16px;border-radius:12px;background:var(--gpp-book);box-shadow:inset 0 0 0 2px var(--gpp-head)}
.gpp-tl-stats h4{margin:0 0 8px;font:14px var(--gpp-f-black);text-transform:uppercase;color:var(--gpp-accent)}
.gpp-tl-stats table{width:100%;border-collapse:collapse;font:12px var(--gpp-f-bold)}
.gpp-tl-stats td{padding:3px 0}.gpp-tl-stats td:last-child{text-align:right;font-variant-numeric:tabular-nums;padding-left:12px}
.gpp-tl-stats .sw{display:inline-block;width:16px;height:16px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.5)}
.gpp-tl-rec{color:#ff5a7a !important}
.gpp-tl.inline:not(.expanded) .gpp-tl-opt{display:none}
.gpp-tl.inline:not(.expanded) .gpp-tl-ctrl .gpp-icon-btn{width:27px}
.gpp-player .gpp-win-body{padding:0;overflow:hidden}
.gpp-play-badge{position:absolute;right:8px;bottom:8px;z-index:3;height:34px;padding:0 12px 0 9px;border-radius:9px;border:0;cursor:pointer;display:flex;align-items:center;gap:5px;
background:linear-gradient(#8dffd0,#3ee6a0);color:rgb(23,5,87);font:13px/1 var(--gpp-f-black);text-transform:uppercase;box-shadow:inset 0 0 0 2px #c8ffe8,0 3px 0 #1f9e6c;opacity:.92}
.gpp-play-badge:hover{opacity:1;filter:brightness(1.05)}
.gpp-play-badge svg{width:14px;height:14px}
`;

const TL_ICON = {
  start: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5h2v11H3zM13 2.5v11L5.5 8z"/></svg>',
  end: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 2.5h2v11h-2zM3 2.5v11L10.5 8z"/></svg>',
  slower: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3v10L1.5 8zM15 3v10L8.5 8z"/></svg>',
  faster: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3v10l6.5-5zM8 3v10l6.5-5z"/></svg>',
  expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10"/></svg>',
  collapse: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5"/></svg>',
  full: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 6h2M5 6v2M11 10H9M11 10V8" stroke-linecap="round"/></svg>',
  stats: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="8" width="2.6" height="6" rx=".6"/><rect x="6.7" y="4" width="2.6" height="10" rx=".6"/><rect x="11.4" y="6" width="2.6" height="8" rx=".6"/></svg>',
  json: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 4H6a2 2 0 0 0-2 2v4l-1.5 2L4 14v4a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v4l1.5 2-1.5 2v4a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>',
};

const SPEEDS = [1, 2, 3, 5, 10, 15, 25, 50, 75, 100, 150, 200, 300, 400, 600, 800];
const TOOL_STAT_NAMES = { 1: 'Кисть', 2: 'Ластик', 3: 'Линии', 4: 'Прямоугольники', 5: 'Эллипсы', 6: 'Прямоугольники залитые', 7: 'Эллипсы залитые', 8: 'Заливки' };

function strokePoints(v) { return v[0] === TOOL.PEN || v[0] === TOOL.ERASER ? Math.max(1, (v.length - 3) / 2) : 1; }
function strokeColor(v) { return v[0] === TOOL.ERASER ? '#ffffff' : Array.isArray(v[2]) ? v[2][0] : '#000000'; }
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}

/* Ось графика и перемотки: реальное время (свои рисунки) или «ход рисования» (объём штрихов) */
class TimelapseData {
  constructor(strokes, times) {
    this.strokes = strokes;
    this.N = strokes.length;
    this.pts = strokes.map(strokePoints);
    this.start = new Float64Array(this.N);
    this.end = new Float64Array(this.N);
    this.real = !!(times && times.length === this.N && times.every(Boolean));
    if (this.real) {
      const t0 = Math.min(...times.map(t => t[0]));
      times.forEach(([a, b], i) => { this.start[i] = (a - t0) / 1000; this.end[i] = Math.max(this.start[i] + 0.05, (b - t0) / 1000); });
    } else {
      let acc = 0;
      this.pts.forEach((n, i) => { this.start[i] = acc; acc += n + 4; this.end[i] = acc; });
    }
    this.total = this.N ? Math.max(...this.end) : 1;
  }

  axisAt(p) {
    if (p >= this.N) return this.total;
    const i = Math.floor(p), f = p - i;
    return this.start[i] + f * (this.end[i] - this.start[i]);
  }

  /* Позиция в штрихах по значению оси (штрихи упорядочены по началу) */
  pAt(a) {
    if (a <= 0 || !this.N) return 0;
    if (a >= this.total) return this.N;
    let lo = 0, hi = this.N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.start[mid] <= a) lo = mid; else hi = mid - 1; }
    if (a >= this.end[lo]) return lo + 1;
    return lo + (a - this.start[lo]) / (this.end[lo] - this.start[lo]);
  }

  bins(n) {
    const out = Array.from({ length: n }, () => ({ count: 0, colors: new Map(), from: Infinity, to: -1 }));
    this.strokes.forEach((v, i) => {
      const bin = out[Math.min(n - 1, Math.floor((this.start[i] / this.total) * n))];
      bin.count++; bin.from = Math.min(bin.from, i); bin.to = Math.max(bin.to, i);
      const c = strokeColor(v);
      bin.colors.set(c, (bin.colors.get(c) || 0) + this.pts[i]);
    });
    for (const b of out) b.color = [...b.colors].sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    return out;
  }

  stats() {
    const byTool = new Map(), colors = new Map();
    this.strokes.forEach((v, i) => {
      byTool.set(v[0], (byTool.get(v[0]) || 0) + 1);
      if (v[0] !== TOOL.ERASER) colors.set(strokeColor(v), (colors.get(strokeColor(v)) || 0) + this.pts[i]);
    });
    return { byTool, colors: [...colors].sort((a, b) => b[1] - a[1]) };
  }
}

class Player {
  constructor(strokes, { title, W = 1516, H = 848, host = null, times = null, author = '' }) {
    this.strokes = strokes.filter(Array.isArray);
    this.data = new TimelapseData(this.strokes, times);
    this.times = this.data.real ? times : null;
    this.W = W; this.H = H; this.title = title || 'Таймлапс'; this.author = author;
    this.p = 0; this.done = 0; this.playing = false;
    const saved = SPEEDS.indexOf(+Settings.get('player', 'speed'));
    this.speedIdx = saved >= 0 ? saved : 4;
    this.build();
    if (host) this.mountInline(host); else this.mountWindow();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    this.onFs = () => { this.resize(true); };
    document.addEventListener('fullscreenchange', this.onFs);
    if (Settings.get('player', 'autoplay')) this.play(); else this.seek(this.data.N);
  }

  /* ───── Интерфейс ───── */

  build() {
    const btn = (icon, title, fn) => h('button', { class: 'gpp-icon-btn', title, html: icon, onclick: e => { e.stopPropagation(); fn(); } });
    this.canvas = h('canvas', { class: 'gpp-tl-cv' });
    this.ctx = this.canvas.getContext('2d');
    this.layer = h('canvas');
    this.lctx = this.layer.getContext('2d');
    this.chart = h('canvas', { class: 'gpp-tl-chart' });
    this.tip = h('div', { class: 'gpp-tl-tip' });
    this.fill = h('div', { class: 'gpp-tl-fill' });
    this.knob = h('div', { class: 'gpp-tl-knob' });
    this.bar = h('div', { class: 'gpp-tl-bar', title: 'Перемотка' }, this.fill, this.knob);
    this.playBtn = btn(ICON.play, 'Пуск / пауза (пробел, клик по рисунку)', () => this.toggle());
    this.speedFill = h('div', { class: 'fill' });
    this.speedLabel = h('span');
    this.speedEl = h('div', { class: 'gpp-tl-speed', title: 'Скорость: зажмите и ведите вбок или крутите колесо. До x100 штрихи рисуются плавно, выше — мгновенно' }, this.speedLabel,
      h('div', { class: 'gpp-tl-speedpop' }, h('div', { class: 'track' }, this.speedFill)));
    this.count = h('div', { class: 'gpp-tl-count' });
    this.expandBtn = btn(TL_ICON.expand, 'Развернуть на весь интерфейс игры (средняя кнопка мыши)', () => this.toggleExpand());
    this.recBtn = btn(ICON.video, 'Записать видео WebM', () => this.record());
    this.recBtn.classList.add('gpp-tl-opt');
    this.ctrl = h('div', { class: 'gpp-tl-ctrl' },
      this.playBtn,
      btn(TL_ICON.start, 'К первому штриху (Home)', () => this.seek(0)),
      btn(TL_ICON.slower, 'Медленнее', () => this.setSpeed(this.speedIdx - 1)),
      btn(TL_ICON.faster, 'Быстрее', () => this.setSpeed(this.speedIdx + 1)),
      btn(TL_ICON.end, 'К последнему штриху (End)', () => { this.pause(); this.seek(this.data.N); }),
      this.speedEl, this.count, h('div', { class: 'gpp-tl-sp' }),
      btn(TL_ICON.stats, 'Статистика штрихов', () => this.showStats()),
      this.recBtn,
      Object.assign(btn(ICON.download, 'Сохранить (меню по правой кнопке)', () => this.showMenu()), { className: 'gpp-icon-btn gpp-tl-opt' }),
      this.expandBtn,
      btn(TL_ICON.full, 'Полноэкранный режим без рамок (двойной клик, F)', () => this.toggleFullscreen()));
    this.bottom = h('div', { class: 'gpp-tl-bottom' }, h('div', { style: { position: 'relative' } }, this.chart, this.tip), this.bar, this.ctrl);
    this.pop = h('div', { class: 'gpp-tl-pop', onclick: e => { if (e.target === this.pop) this.closePop(); } });
    this.closeBtn = h('button', { class: 'gpp-tl-close', title: 'Закрыть плеер', html: ICON.close, onclick: e => { e.stopPropagation(); this.close(); } });
    this.root = h('div', { class: 'gpp gpp-tl paused', tabindex: 0 }, this.canvas, this.closeBtn, this.bottom, this.pop);
    this.bindInput();
    this.setSpeed(this.speedIdx, false);
  }

  bindInput() {
    const r = this.root;
    for (const t of ['pointerdown', 'mousedown', 'click', 'dblclick', 'auxclick', 'wheel', 'keydown', 'contextmenu']) r.addEventListener(t, e => e.stopPropagation());
    this.canvas.addEventListener('click', () => { clearTimeout(this.clickTimer); this.clickTimer = setTimeout(() => this.toggle(), 220); });
    this.canvas.addEventListener('dblclick', () => { clearTimeout(this.clickTimer); this.toggleFullscreen(); });
    r.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
    r.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : this.toggleExpand(); } });
    r.addEventListener('contextmenu', e => { e.preventDefault(); this.showMenu(); });
    r.addEventListener('mouseenter', () => r.focus({ preventScroll: true }));
    r.addEventListener('keydown', e => {
      const k = e.code;
      if (k === 'Space') { e.preventDefault(); this.toggle(); }
      else if (k === 'ArrowRight') { this.pause(); this.seek(Math.floor(this.p) + 1); }
      else if (k === 'ArrowLeft') { this.pause(); this.seek(Math.ceil(this.p) - 1); }
      else if (k === 'Home') this.seek(0);
      else if (k === 'End') { this.pause(); this.seek(this.data.N); }
      else if (k === 'KeyF') this.toggleFullscreen();
      else if (k === 'Escape' && this.expandHost && !document.fullscreenElement) this.toggleExpand();
    });
    const seekAt = (el, e) => { const b = el.getBoundingClientRect(); this.seek(this.data.pAt(clamp((e.clientX - b.left) / b.width, 0, 1) * this.data.total)); };
    for (const el of [this.bar, this.chart]) {
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        const wasPlaying = this.playing;
        this.pause();
        el.setPointerCapture(e.pointerId);
        seekAt(el, e);
        const mv = ev => seekAt(el, ev);
        const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); if (wasPlaying && this.p < this.data.N) this.play(); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
      });
    }
    this.chart.addEventListener('pointermove', e => this.chartTip(e));
    this.chart.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; });
    this.speedEl.addEventListener('wheel', e => { e.preventDefault(); this.setSpeed(this.speedIdx + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    this.speedEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.speedEl.setPointerCapture(e.pointerId);
      this.speedEl.classList.add('active');
      const sx = e.clientX, si = this.speedIdx;
      const mv = ev => this.setSpeed(si + Math.round((ev.clientX - sx) / 12));
      const up = () => { this.speedEl.classList.remove('active'); this.speedEl.removeEventListener('pointermove', mv); this.speedEl.removeEventListener('pointerup', up); };
      this.speedEl.addEventListener('pointermove', mv); this.speedEl.addEventListener('pointerup', up);
    });
  }

  mountInline(host) {
    this.host = host;
    this.root.classList.add('inline');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.append(this.root);
  }

  mountWindow() {
    this.win = new Win({ id: 'player', title: '<b>GP+</b> ' + this.title, width: 720, height: 460, x: 120, y: 80, resizable: true, className: 'gpp-player gpp' });
    this.root.classList.add('window');
    this.win.body.append(this.root);
    this.win.on('hide', () => this.close());
    this.win.show();
  }

  toggleExpand() {
    if (this.expandHost) {
      this.expandHost.remove(); this.expandHost = null;
      (this.host || this.win.body).append(this.root);
      this.root.classList.remove('expanded');
      this.expandBtn.innerHTML = TL_ICON.expand;
    } else {
      const screen = document.querySelector('.screen');
      this.expandHost = h('div', { class: 'gpp-tl-expand-host gpp' });
      this.expandHost.addEventListener('pointerdown', e => { if (e.target === this.expandHost) this.toggleExpand(); });
      (screen || document.body).append(this.expandHost);
      if (!screen) Object.assign(this.expandHost.style, { position: 'fixed', zIndex: 2147483200 });
      this.expandHost.append(this.root);
      this.root.classList.add('expanded');
      this.expandBtn.innerHTML = TL_ICON.collapse;
    }
    this.root.focus({ preventScroll: true });
    this.resize(true);
  }

  toggleFullscreen() {
    if (document.fullscreenElement) return document.exitFullscreen();
    this.root.requestFullscreen?.().catch(() => toast('Браузер не разрешил полноэкранный режим'));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pause();
    if (this.recorder?.state === 'recording') this.recorder.stop();
    if (document.fullscreenElement === this.root) document.exitFullscreen();
    document.removeEventListener('fullscreenchange', this.onFs);
    this.ro.disconnect();
    this.expandHost?.remove();
    this.root.remove();
    if (this.win) this.win.el.remove();
    if (Timelapse.current === this) Timelapse.current = null;
  }

  /* ───── Отрисовка: холст в размер экрана, штрихи векторные — чётко в любом режиме ───── */

  resize(force) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, round(this.root.clientWidth * dpr)), hh = Math.max(10, round(this.root.clientHeight * dpr));
    if (!force && w === this.canvas.width && hh === this.canvas.height) return;
    this.canvas.width = this.layer.width = w;
    this.canvas.height = this.layer.height = hh;
    const k = Math.min(w / this.W, hh / this.H);
    this.view = { k, ox: (w - this.W * k) / 2, oy: (hh - this.H * k) / 2 };
    this.rebuildLayer(Math.floor(this.p));
    const cw = this.chart.clientWidth || this.root.clientWidth - 20;
    this.chart.width = Math.max(10, round(cw * dpr)); this.chart.height = round(24 * dpr);
    const maxBins = clamp(round(cw / 5), 20, 160);
    // реальное время: «круглый» шаг столбиков (1, 2, 5, 10… секунд), чтобы отрезки читались
    const step = this.data.real ? [1, 2, 5, 10, 15, 30, 60, 120, 300].find(st => this.data.total / st <= maxBins) || 600 : 0;
    this.bins = this.data.bins(step ? Math.max(1, Math.ceil(this.data.total / step)) : maxBins);
    this.paint();
  }

  withView(ctx, fn) {
    const { k, ox, oy } = this.view;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    fn(ctx);
    ctx.restore();
  }

  rebuildLayer(n) {
    if (!this.view) return;
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(0, 0, this.layer.width, this.layer.height);
    this.withView(this.lctx, c => { for (let i = 0; i < n; i++) renderStroke(c, this.strokes[i]); });
    this.done = n;
  }

  seek(p) {
    p = clamp(p, 0, this.data.N);
    const n = Math.floor(p);
    if (n < this.done) this.rebuildLayer(n);
    else if (n > this.done) { this.withView(this.lctx, c => { for (let i = this.done; i < n; i++) renderStroke(c, this.strokes[i]); }); this.done = n; }
    this.p = p;
    this.paint();
  }

  paint() {
    if (!this.view) return;
    const c = this.ctx, { k, ox, oy } = this.view;
    const dark = this.root.classList.contains('expanded') || document.fullscreenElement === this.root;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = dark ? '#0b0620' : '#fff';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.fillStyle = '#fff';
    c.fillRect(ox, oy, this.W * k, this.H * k);
    const f = this.p - this.done, v = this.strokes[this.done];
    if (f > 0 && v && (v[0] === TOOL.PEN || v[0] === TOOL.ERASER)) {
      const part = v.slice(0, 3 + 2 * Math.max(1, Math.ceil(f * strokePoints(v))));
      if (v[0] === TOOL.ERASER) {
        const tmp = Player.tmp ||= h('canvas');
        tmp.width = this.layer.width; tmp.height = this.layer.height;
        const tc = tmp.getContext('2d');
        tc.drawImage(this.layer, 0, 0);
        this.withView(tc, x => renderStroke(x, part));
        c.drawImage(tmp, 0, 0);
      } else {
        c.drawImage(this.layer, 0, 0);
        this.withView(c, x => renderStroke(x, part));
      }
    } else c.drawImage(this.layer, 0, 0);
    this.updateUi();
  }

  updateUi() {
    const d = this.data, frac = d.axisAt(this.p) / d.total;
    this.fill.style.width = frac * 100 + '%';
    this.knob.style.left = frac * 100 + '%';
    const cur = Math.min(d.N, Math.ceil(this.p - 1e-9));
    this.count.innerHTML = `${cur} / ${d.N} <small>${d.real ? fmtTime(d.axisAt(this.p)) + ' / ' + fmtTime(d.total) : plural(d.N, 'штрих', 'штриха', 'штрихов')}</small>`;
    this.drawChart(frac);
  }

  drawChart(frac) {
    const c = this.chart.getContext('2d'), w = this.chart.width, hh = this.chart.height, bins = this.bins || [];
    c.clearRect(0, 0, w, hh);
    if (!bins.length) return;
    const max = Math.max(1, ...bins.map(b => b.count)), bw = w / bins.length;
    bins.forEach((b, i) => {
      if (!b.count) return;
      const bh = Math.max(2, (b.count / max) * (hh - 2));
      c.globalAlpha = (i + 0.5) / bins.length <= frac ? 1 : 0.4;
      c.fillStyle = b.color && b.color.toLowerCase() !== '#ffffff' ? b.color : '#cfc6ff';
      c.fillRect(i * bw + 0.5, hh - bh, Math.max(1, bw - 1), bh);
    });
    c.globalAlpha = 1;
    c.fillStyle = '#fff';
    c.fillRect(Math.round(frac * w) - 1, 0, 2, hh);
  }

  chartTip(e) {
    const r = this.chart.getBoundingClientRect(), x = e.clientX - r.left, bins = this.bins || [];
    const i = clamp(Math.floor((x / r.width) * bins.length), 0, bins.length - 1), b = bins[i];
    if (!b) return;
    const a0 = (i / bins.length) * this.data.total, a1 = ((i + 1) / bins.length) * this.data.total;
    const span = this.data.real ? `${fmtTime(a0)}–${fmtTime(a1)}` : b.count ? `штрихи ${b.from + 1}–${b.to + 1}` : 'участок';
    this.tip.textContent = `${span}: ${b.count} ${plural(b.count, 'штрих', 'штриха', 'штрихов')}`;
    this.tip.style.left = clamp(x, 60, r.width - 60) + 'px';
    this.tip.style.display = 'block';
  }

  /* ───── Воспроизведение ───── */

  setSpeed(i, save = true) {
    this.speedIdx = clamp(i, 0, SPEEDS.length - 1);
    const s = SPEEDS[this.speedIdx];
    this.speedLabel.textContent = 'x' + s;
    this.speedFill.style.width = (this.speedIdx / (SPEEDS.length - 1)) * 100 + '%';
    if (save) Settings.set('player', 'speed', s);
  }

  /* До x100 — плавная анимация по точкам штриха, выше — целые штрихи мгновенно */
  advance(dt) {
    const s = SPEEDS[this.speedIdx], d = this.data;
    if (s > 100) {
      this.acc = (this.acc || 0) + (dt * s) / 2;
      const whole = Math.floor(this.acc);
      if (whole) { this.acc -= whole; this.seek(Math.min(d.N, Math.floor(this.p) + whole)); }
      return;
    }
    let budget = dt * s * 25, p = this.p;
    while (budget > 0 && p < d.N) {
      const i = Math.floor(p), n = d.pts[i] + 2, left = (i + 1 - p) * n;
      if (budget >= left) { p = i + 1; budget -= left; } else { p += budget / n; budget = 0; }
    }
    this.seek(p);
  }

  play() {
    if (this.p >= this.data.N) this.seek(0);
    this.playing = true;
    this.root.classList.remove('paused');
    this.playBtn.innerHTML = ICON.pause;
    let last = performance.now();
    const step = now => {
      if (!this.playing) return;
      this.advance(Math.min(0.1, (now - last) / 1000)); last = now;
      if (this.p >= this.data.N) { this.pause(); this.emitEnd?.(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  pause() { this.playing = false; cancelAnimationFrame(this.raf); this.playBtn.innerHTML = ICON.play; this.root.classList.add('paused'); }
  toggle() { this.playing ? this.pause() : this.play(); }

  /* ───── Меню и статистика ───── */

  openPop(content) { this.pause(); this.pop.replaceChildren(content); this.pop.classList.add('open'); }
  closePop() { this.pop.classList.remove('open'); }

  showMenu() {
    const item = (icon, label, fn) => h('button', { onclick: e => { e.stopPropagation(); this.closePop(); fn(); }, html: icon + `<span>${label}</span>` });
    this.openPop(h('div', { class: 'gpp-tl-menu' },
      item(TL_ICON.json, 'Сохранить процесс (.json)', () => this.saveProcess()),
      item(ICON.image, 'Сохранить рисунок (PNG)', () => this.savePng()),
      item(ICON.video, 'Записать видео (WebM)', () => this.record()),
      item(TL_ICON.stats, 'Статистика', () => this.showStats())));
  }

  showStats() {
    const d = this.data, { byTool, colors } = d.stats(), bins = this.bins || [];
    const busiest = bins.reduce((m, b, i) => (b.count > m.c ? { c: b.count, i } : m), { c: 0, i: 0 });
    const span = i => d.real ? `${fmtTime((i / bins.length) * d.total)}–${fmtTime(((i + 1) / bins.length) * d.total)}` : `${Math.round((i / bins.length) * 100)}–${Math.round(((i + 1) / bins.length) * 100)}% рисунка`;
    const row = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
    this.openPop(h('div', { class: 'gpp-tl-stats gpp-scroll', onclick: e => e.stopPropagation() },
      h('h4', {}, 'Статистика рисунка'),
      h('table', {},
        row('Всего штрихов', d.N),
        d.real ? row('Время рисования', fmtTime(d.total)) : null,
        d.real ? row('Штрихов в минуту', Math.round(d.N / Math.max(1 / 60, d.total / 60))) : null,
        busiest.c ? row('Самый активный отрезок', `${span(busiest.i)}: ${busiest.c}`) : null,
        ...[...byTool].sort((a, b) => b[1] - a[1]).map(([t, n]) => row(TOOL_STAT_NAMES[t] || 'Другое', n))),
      h('div', { class: 'gpp-sec', style: { marginTop: '12px' } }, `Цветов: ${colors.length}`),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } }, colors.slice(0, 24).map(([c]) => h('span', { class: 'sw', title: c, style: { background: c } }))),
      h('div', { class: 'gpp-note', style: { marginTop: '10px' } }, d.real
        ? 'График над перемоткой — по реальному времени: высота столбика — сколько штрихов сделано за отрезок, цвет — основной цвет этих штрихов.'
        : 'Игра не передаёт время штрихов, поэтому график — по ходу рисования: высота столбика — сколько штрихов на участке (много коротких — детализация), цвет — основной цвет. Для своих рисунков скрипт записывает реальное время.')));
  }

  renderFull(scale = 1) {
    const c = h('canvas', { width: round(this.W * scale), height: round(this.H * scale) });
    const lay = h('canvas', { width: c.width, height: c.height });
    const lx = lay.getContext('2d');
    lx.scale(scale, scale);
    for (const v of this.strokes) renderStroke(lx, v);
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(lay, 0, 0);
    return c;
  }

  fileBase() { return (this.author || 'drawing').replace(/[^\wа-яё-]+/gi, '_'); }
  savePng() { this.renderFull(2).toBlob(b => downloadBlob(b, `gartic-${this.fileBase()}.png`)); }

  saveProcess() {
    const data = { app: 'gartic-phone-plus', type: 'timelapse', version: 1, title: this.title, author: this.author, W: this.W, H: this.H, strokes: this.strokes, times: this.times };
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `gartic-process-${this.fileBase()}.json`);
  }

  record() {
    if (this.recorder) return this.recorder.stop();
    if (!window.MediaRecorder || !this.canvas.captureStream) return toast('Браузер не поддерживает запись видео');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(this.canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8e6 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      this.recorder = null; this.recBtn.classList.remove('gpp-tl-rec'); this.emitEnd = null;
      if (chunks.length) downloadBlob(new Blob(chunks, { type: 'video/webm' }), `gartic-timelapse-${this.fileBase()}.webm`);
    };
    this.recorder = rec;
    this.recBtn.classList.add('gpp-tl-rec');
    toast('Запись идёт до конца рисунка. Нажмите кнопку записи ещё раз, чтобы остановить.');
    this.seek(0);
    rec.start();
    this.emitEnd = () => setTimeout(() => rec.state === 'recording' && rec.stop(), 700);
    this.play();
  }
}

const Timelapse = new (class {
  init() {
    injectCss(PLAYER_CSS, 'gpp-player-css');
    this.current = null;
    this.own = Store.get('tl.own', []);
    Net.on('album:item', () => this.decorateSoon());
    Net.on('screen', () => this.decorateSoon());
    new MutationObserver(() => this.decorateSoon()).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('dblclick', e => { if (Settings.get('player', 'openOnDblClick')) this.onClick(e); }, true);
    document.addEventListener('auxclick', e => { if (e.button === 1) this.onClick(e); }, true);
    document.addEventListener('mousedown', e => { if (e.button === 1 && this.findTarget(e.target)) e.preventDefault(); }, true);
  }

  /* Реальное время своих штрихов: Painter передаёт его в конце хода, ключ — содержимое штрихов */
  sig(strokes) {
    const s = strokes.filter(Array.isArray).slice().sort((a, b) => a[1] - b[1]);
    return s.length + '|' + JSON.stringify(s[0]?.slice(0, 9)) + '|' + JSON.stringify(s[s.length - 1]?.slice(0, 9));
  }

  rememberOwn(strokes, timing) {
    if (!strokes.length) return;
    const times = {};
    for (const v of strokes) if (timing.has(v[1])) times[v[1]] = timing.get(v[1]);
    this.own = [{ sig: this.sig(strokes), times }, ...this.own].slice(0, 12);
    Store.set('tl.own', this.own);
  }

  timesFor(strokes) {
    const rec = this.own.find(r => r.sig === this.sig(strokes));
    if (!rec) return null;
    const t = strokes.map(v => rec.times[v[1]]);
    return t.every(Boolean) ? t : null;
  }

  decorateSoon() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.decorate(); });
  }

  /* Возвращает { strokes, title, W, H, host, author } для элемента, по которому кликнули, или null.
     host — область рисунка в карточке альбома, куда встраивается плеер. */
  findTarget(el) {
    if (!el || el.closest?.('.gpp-win, .gpp-stage, .gpp-tl, .gpp-dock')) return null;
    const item = el.closest?.('.timeline .item');
    if (item) {
      const items = [...document.querySelectorAll('.timeline .item')];
      const data = Net.album.items[items.indexOf(item)];
      if (!data || !Array.isArray(data.data)) return null;
      const cv = item.querySelector('canvas');
      const host = item.querySelector('.balloon .content') || cv?.parentElement || null;
      const author = data.user?.nick || '';
      return { strokes: data.data, title: `${author} — ${Net.album.author?.nick ? 'альбом ' + Net.album.author.nick : 'альбом'}`, W: cv?.width || 1516, H: cv?.height || 848, host, author };
    }
    if (Net.state.screen === SCREEN.DESCRIPTION && el.tagName === 'CANVAS' && Array.isArray(Net.state.previous?.data)) {
      return { strokes: Net.state.previous.data, title: 'Предыдущий рисунок', W: el.width || 1516, H: el.height || 848, host: null, author: Net.state.previous.user?.nick || '' };
    }
    return null;
  }

  onClick(e) {
    const t = this.findTarget(e.target);
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    this.open(t);
  }

  open({ strokes, title, W, H, host, author, times }) {
    if (!strokes?.length) return toast('В этом рисунке нет штрихов');
    this.current?.close();
    this.current = new Player(strokes, { title, W, H, host, author, times: times || this.timesFor(strokes) });
  }

  async openFile(file) {
    try {
      const d = JSON.parse(await file.text());
      if (d.app !== 'gartic-phone-plus' || d.type !== 'timelapse' || !Array.isArray(d.strokes)) throw new Error('это не файл процесса GP+');
      this.open({ strokes: d.strokes, title: d.title || file.name, W: d.W || 1516, H: d.H || 848, host: null, author: d.author, times: d.times });
    } catch (e) { toast('Не удалось открыть процесс: ' + e.message, 4000); }
  }

  decorate() {
    const items = document.querySelectorAll('.timeline .item');
    items.forEach((item, idx) => {
      const data = Net.album.items[idx];
      if (!data || !Array.isArray(data.data) || item.querySelector('.gpp-play-badge')) return;
      const host = item.querySelector('.balloon') || item.querySelector('.drawingmode') || item;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.append(h('button', {
        class: 'gpp-play-badge gpp', title: `Таймлапс: ${data.data.length} ${plural(data.data.length, 'штрих', 'штриха', 'штрихов')} (двойной клик или средняя кнопка по рисунку)`,
        html: ICON.play + '<span>Таймлапс</span>',
        onclick: e => { e.stopPropagation(); this.open(this.findTarget(item)); },
      }));
    });
  }
})();
