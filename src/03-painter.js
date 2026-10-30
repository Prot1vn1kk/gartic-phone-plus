/* ───────────────────────────── Рисование ─────────────────────────────
   Поверх холста игры кладётся собственный слой: своя отрисовка, история, вид (зум/поворот/зеркало)
   и отправка штрихов на сервер в формате игры (событие 7). Холст игры на время хода скрыт.        */

const TOOL = { PEN: 1, ERASER: 2, LINE: 3, RECT: 4, ELLIPSE: 5, RECT_FILL: 6, ELLIPSE_FILL: 7, FILL: 8 };
const TOOL_NAMES = { 1: 'Кисть', 2: 'Ластик', 3: 'Линия', 4: 'Прямоугольник', 5: 'Эллипс', 6: 'Прямоугольник (залитый)', 7: 'Эллипс (залитый)', 8: 'Заливка' };
const GAME_TOOL_CLASS = { pen: 1, ers: 2, lin: 3, reb: 4, ellb: 5, rec: 6, ell: 7, fil: 8 };
const GAME_THICKNESS = [4, 12, 20, 28, 36];
const SYM = { VERTICAL: 'vertical', HORIZONTAL: 'horizontal', QUADRANT: 'quadrant', RADIAL: 'radial', MANDALA: 'mandala' };
const SYM_NAMES = { vertical: 'Вертикальная ось', horizontal: 'Горизонтальная ось', quadrant: 'Четыре четверти', radial: 'Радиальная', mandala: 'Мандала' };
const SHAPE_TOOLS = new Set([TOOL.LINE, TOOL.RECT, TOOL.ELLIPSE, TOOL.RECT_FILL, TOOL.ELLIPSE_FILL]);

/* Отрисовка одного штриха в формате игры. Для ластика на прозрачном слое используется destination-out. */
function renderStroke(ctx, v) {
  const t = v[0];
  ctx.save();
  ctx.lineCap = ctx.lineJoin = 'round';
  if (t === TOOL.PEN || t === TOOL.ERASER) {
    const pts = [];
    let x = v[3], y = v[4];
    if (x == null) return ctx.restore();
    pts.push([x, y]);
    for (let i = 5; i + 1 < v.length; i += 2) { x += v[i]; y += v[i + 1]; pts.push([x, y]); }
    if (t === TOOL.PEN) {
      const [color, size, op] = v[2];
      ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = size; ctx.globalAlpha = op / 10;
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = ctx.fillStyle = '#fff'; ctx.lineWidth = v[2];
    }
    if (pts.length === 1) {
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1], [cx, cy] = pts[i];
        ctx.quadraticCurveTo(px, py, px + (cx - px) / 2, py + (cy - py) / 2);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
  } else if (t === TOOL.FILL) {
    const [color, op] = v[2];
    ctx.fillStyle = color; ctx.globalAlpha = op / 10;
    ctx.beginPath();
    for (let i = 3; i + 3 < v.length; i += 5) ctx.rect(v[i], v[i + 1], v[i + 2], v[i + 3]);
    ctx.fill();
  } else if (t >= 3 && t <= 7) {
    const [color, size, op] = v[2];
    const [x1, y1, x2, y2] = v.slice(3, 7);
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = size; ctx.globalAlpha = op / 10;
    ctx.beginPath();
    if (t === TOOL.LINE) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    else if (t === TOOL.RECT || t === TOOL.RECT_FILL) { ctx.rect(x1, y1, x2 - x1, y2 - y1); t === TOOL.RECT ? ctx.stroke() : ctx.fill(); }
    else {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      t === TOOL.ELLIPSE ? ctx.stroke() : ctx.fill();
    }
  }
  ctx.restore();
}

/* Заливка: поиск области по допуску, расширение на 1px (закрывает сглаженные края),
   упаковка в прямоугольники формата игры [x, y, w, h, k].
   k = 5 × индекс «родительского» прямоугольника, который примыкает к этому (у первого k = 0).
   Сервер проверяет эту связность: заливка с неверными ссылками молча отбрасывается. */
function floodRects(img, W, H, sx, sy, tolerance) {
  sx = clamp(round(sx), 0, W - 1); sy = clamp(round(sy), 0, H - 1);
  const d = img.data, i0 = (sy * W + sx) * 4;
  const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2];
  const tol = tolerance * tolerance * 3;
  const mask = new Uint8Array(W * H);
  const same = p => { const i = p * 4, dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0; return dr * dr + dg * dg + db * db <= tol; };
  const stack = [sy * W + sx];
  while (stack.length) {
    const p = stack.pop();
    if (mask[p]) continue;
    const y = (p / W) | 0;
    let l = p, r = p;
    const rowStart = y * W, rowEnd = rowStart + W - 1;
    while (l > rowStart && !mask[l - 1] && same(l - 1)) l--;
    while (r < rowEnd && !mask[r + 1] && same(r + 1)) r++;
    for (let q = l; q <= r; q++) {
      mask[q] = 1;
      if (y > 0 && !mask[q - W] && same(q - W)) stack.push(q - W);
      if (y < H - 1 && !mask[q + W] && same(q + W)) stack.push(q + W);
    }
  }
  const grown = mask.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (mask[p]) continue;
    if ((x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || (y > 0 && mask[p - W]) || (y < H - 1 && mask[p + W])) grown[p] = 1;
  }
  const rects = [];
  let open = new Map();
  for (let y = 0; y <= H; y++) {
    const spans = new Map();
    if (y < H) {
      let x = 0;
      while (x < W) {
        if (!grown[y * W + x]) { x++; continue; }
        const s = x;
        while (x < W && grown[y * W + x]) x++;
        spans.set(s + ':' + (x - s), [s, x - s]);
      }
    }
    const next = new Map();
    for (const [k, rc] of open) {
      if (spans.has(k)) { rc[3]++; next.set(k, rc); spans.delete(k); }
      else rects.push(rc);
    }
    for (const [k, [s, w]] of spans) next.set(k, [s, y, w, 1]);
    open = next;
  }
  return orderRects(rects, sx, sy);
}

/* Обход в ширину от прямоугольника с точкой заливки: каждому прямоугольнику — уже выведенный сосед-родитель.
   Прямоугольники собраны из максимальных строковых отрезков, поэтому соседи бывают только сверху и снизу. */
function orderRects(rects, sx, sy) {
  if (!rects.length) return [];
  const byTop = new Map(), byBottom = new Map();
  const push = (m, k, i) => (m.get(k) || m.set(k, []).get(k)).push(i);
  rects.forEach(([, y, , hh], i) => { push(byTop, y, i); push(byBottom, y + hh, i); });
  const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2];
  let start = rects.findIndex(([x, y, w, hh]) => sx >= x && sx < x + w && sy >= y && sy < y + hh);
  if (start < 0) start = 0;
  const order = [start], parent = new Map([[start, 0]]), pos = new Map([[start, 0]]);
  for (let q = 0; q < order.length; q++) {
    const i = order[q], r = rects[i];
    for (const j of [...(byTop.get(r[1] + r[3]) || []), ...(byBottom.get(r[1]) || [])]) {
      if (pos.has(j) || !overlap(r, rects[j])) continue;
      pos.set(j, order.length);
      parent.set(j, pos.get(i));
      order.push(j);
    }
  }
  return order.map(i => [...rects[i], parent.get(i) * 5]);
}

function symmetryTransforms(mode, count, cx, cy) {
  const fs = [];
  const rot = a => ([x, y]) => { const dx = x - cx, dy = y - cy, c = Math.cos(a), s = Math.sin(a); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
  const mx = ([x, y]) => [2 * cx - x, y];
  const my = ([x, y]) => [x, 2 * cy - y];
  if (mode === SYM.VERTICAL) fs.push({ f: mx, rigid: true });
  else if (mode === SYM.HORIZONTAL) fs.push({ f: my, rigid: true });
  else if (mode === SYM.QUADRANT) fs.push({ f: mx, rigid: true }, { f: my, rigid: true }, { f: p => mx(my(p)), rigid: true });
  else if (mode === SYM.RADIAL) for (let k = 1; k < count; k++) fs.push({ f: rot((Math.PI * 2 * k) / count) });
  else if (mode === SYM.MANDALA) {
    for (let k = 0; k < count; k++) {
      const a = (Math.PI * 2 * k) / count;
      if (k) fs.push({ f: rot(a) });
      fs.push({ f: p => rot(a)(mx(p)) });
    }
  }
  return fs;
}

/* ───────── Палитры ───────── */

const BUILTIN_PALETTES = {
  'Базовая': ['#000000', '#666666', '#aaaaaa', '#ffffff', '#7f1d1d', '#dc2626', '#f97316', '#fbbf24', '#fde047', '#84cc16', '#16a34a', '#065f46',
    '#14b8a6', '#06b6d4', '#3b82f6', '#1e3a8a', '#6366f1', '#8b5cf6', '#c026d3', '#ec4899', '#f9a8d4', '#92400e', '#d6a77a', '#fde2c6'],
  'Пастель': ['#fbcfe8', '#fecdd3', '#fed7aa', '#fef08a', '#d9f99d', '#bbf7d0', '#a7f3d0', '#99f6e4', '#a5f3fc', '#bae6fd', '#c7d2fe', '#ddd6fe', '#f5d0fe', '#e7e5e4'],
  'Кожа и волосы': ['#ffe0bd', '#ffcd94', '#eac086', '#ffad60', '#d1a277', '#c68642', '#8d5524', '#5c3a1e', '#3b2219', '#1c1008', '#f5d76e', '#b7472a', '#6b4423', '#2c1b10'],
  'Серые': ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#f5f5f5', '#ffffff'],
};

function parseAco(buf) {
  const dv = new DataView(buf);
  let off = 0;
  const colors = [];
  const readBlock = withNames => {
    const n = dv.getUint16(off + 2); off += 4;
    for (let i = 0; i < n; i++) {
      const space = dv.getUint16(off); const w = [1, 2, 3, 4].map(k => dv.getUint16(off + k * 2)); off += 10;
      if (withNames) { const len = dv.getUint32(off + 2); off += 4 + len * 2; }
      let hex = null;
      if (space === 0) hex = Color.rgbToHex(w[0] / 257, w[1] / 257, w[2] / 257);
      else if (space === 1) hex = Color.hsvToHex(w[0] / 65535, w[1] / 65535, w[2] / 65535);
      else if (space === 2) { const [c, m, y, k] = w.map(x => 1 - x / 65535); hex = Color.rgbToHex(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k)); }
      else if (space === 8) hex = Color.rgbToHex(...Array(3).fill(255 - (w[0] / 10000) * 255));
      if (hex) colors.push(hex);
    }
  };
  const v1 = dv.getUint16(0);
  if (v1 === 1) {
    readBlock(false);
    if (off < buf.byteLength && dv.getUint16(off) === 2) { colors.length = 0; readBlock(true); }
  } else if (v1 === 2) readBlock(true);
  return colors;
}

function parsePaletteText(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const hex = line.match(/#?\b([0-9a-f]{6})\b/i);
    if (hex) { out.push('#' + hex[1].toLowerCase()); continue; }
    const rgb = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
    if (rgb) out.push(Color.rgbToHex(+rgb[1], +rgb[2], +rgb[3]));
  }
  return out;
}

/* ───────── Выбор цвета (квадрат насыщенности/яркости + полоса оттенка) ───────── */

class ColorPicker extends Emitter {
  constructor({ width = 220, height = 150, vertical = false } = {}) {
    super();
    this.hsv = [0, 0, 0];
    this.vertical = vertical;
    this.el = h('div', { class: 'gpp-cp' + (vertical ? ' vert' : '') });
    this.sv = h('canvas', { class: 'gpp-cp-sv', width, height });
    this.hue = vertical ? h('canvas', { class: 'gpp-cp-hue', width: 12, height }) : h('canvas', { class: 'gpp-cp-hue', width, height: 14 });
    this.svMark = h('div', { class: 'gpp-cp-mark' });
    this.hueMark = h('div', { class: 'gpp-cp-hmark' });
    this.el.append(h('div', { class: 'gpp-cp-svwrap' }, this.sv, this.svMark), h('div', { class: 'gpp-cp-huewrap' }, this.hue, this.hueMark));
    const hc = this.hue.getContext('2d');
    const g = vertical ? hc.createLinearGradient(0, 0, 0, height) : hc.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    hc.fillStyle = g; hc.fillRect(0, 0, this.hue.width, this.hue.height);
    this.drag(this.sv, (x, y) => { this.hsv[1] = x; this.hsv[2] = 1 - y; this.update(true); });
    this.drag(this.hue, (x, y) => { this.hsv[0] = Math.min(vertical ? y : x, 0.9999); this.update(true); });
  }
  drag(el, fn) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      this.dragging = true;
      const go = ev => { const r = el.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); };
      go(e);
      const up = () => { this.dragging = false; el.removeEventListener('pointermove', go); el.removeEventListener('pointerup', up); this.emit('commit', this.hex); };
      el.addEventListener('pointermove', go); el.addEventListener('pointerup', up);
    });
  }
  get hex() { return Color.hsvToHex(...this.hsv); }
  set(hex) {
    const [hh, s, v] = Color.hexToHsv(hex);
    this.hsv = [s && v ? hh : this.hsv[0], s, v];
    this.update(false);
  }
  update(fire) {
    const c = this.sv.getContext('2d'), w = this.sv.width, hh = this.sv.height;
    c.fillStyle = Color.hsvToHex(this.hsv[0], 1, 1); c.fillRect(0, 0, w, hh);
    const gw = c.createLinearGradient(0, 0, w, 0); gw.addColorStop(0, '#fff'); gw.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gw; c.fillRect(0, 0, w, hh);
    const gb = c.createLinearGradient(0, 0, 0, hh); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, '#000');
    c.fillStyle = gb; c.fillRect(0, 0, w, hh);
    this.svMark.style.left = this.hsv[1] * 100 + '%';
    this.svMark.style.top = (1 - this.hsv[2]) * 100 + '%';
    this.svMark.style.background = this.hex;
    if (this.vertical) this.hueMark.style.top = this.hsv[0] * 100 + '%';
    else this.hueMark.style.left = this.hsv[0] * 100 + '%';
    if (fire) this.emit('input', this.hex);
  }
}

const PAINTER_CSS = `
.gpp-stage{position:absolute;inset:0;z-index:5;overflow:hidden;touch-action:none;background:#ddd8ea}
.gpp-stage canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.gpp-stage.gray canvas{filter:grayscale(1)}
.gpp-stage.locked{pointer-events:none}
.gpp-stage.locked::after{content:"";position:absolute;inset:0;background:rgba(40,30,70,.18)}
.gpp-hud{position:absolute;left:8px;top:8px;display:flex;gap:4px;flex-wrap:wrap;pointer-events:none;z-index:2}
.gpp-chip{background:rgba(24,18,43,.78);color:#fff;font:600 11px/1 system-ui,sans-serif;border-radius:999px;padding:5px 8px}
.gpp-chip.accent{background:var(--gpp-accent)}
.gpp-cp{display:flex;flex-direction:column;gap:8px;user-select:none}
.gpp-cp-svwrap,.gpp-cp-huewrap{position:relative}
.gpp-cp canvas{display:block;width:100%;border-radius:8px;cursor:crosshair}
.gpp-cp-huewrap canvas{height:14px;border-radius:7px}
.gpp-cp-mark{position:absolute;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none}
.gpp-cp-hmark{position:absolute;top:-3px;width:6px;height:20px;border-radius:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);transform:translateX(-50%);pointer-events:none}
.gpp-colors-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.gpp-swatch2{position:relative;width:52px;height:44px;flex:none;cursor:pointer}
.gpp-swatch2 span{position:absolute;width:32px;height:32px;border-radius:8px;border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 6px rgba(0,0,0,.35)}
.gpp-swatch2 .c1{left:0;top:0;z-index:1}.gpp-swatch2 .c2{right:0;bottom:0}
.gpp-sw-row{display:flex;flex-wrap:wrap;gap:4px}
.gpp-sw{width:20px;height:20px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,.18);flex:none}
.gpp-sw:hover{transform:scale(1.15)}
.gpp-sw.sel{outline:2px solid #fff;outline-offset:1px}
.gpp-seg{display:flex;gap:3px;flex-wrap:wrap}
.gpp-seg .gpp-icon-btn{width:auto;padding:0 8px;height:28px;font-size:12px;font-weight:600;background:var(--gpp-bg2)}
.gpp-seg .gpp-icon-btn.on{background:var(--gpp-accent);color:#fff}
.gpp-mini{display:flex;align-items:center;gap:8px;margin:4px 0}
.gpp-mini label{width:86px;color:var(--gpp-dim);flex:none}
.gpp-mini input[type=range]{flex:1;accent-color:var(--gpp-accent)}
.gpp-mini output{width:34px;text-align:right;font-variant-numeric:tabular-nums}
.gpp-popup-picker{position:fixed;z-index:2147483400;width:240px;padding:12px}
.gpp-details{border-top:1px solid var(--gpp-line);padding-top:8px;margin-top:10px}
.gpp-details summary{cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--gpp-dim);font-weight:700;list-style:none;margin-bottom:6px}
.gpp-details summary::before{content:"▸ ";}
.gpp-details[open] summary::before{content:"▾ ";}
`;

const Painter = new (class extends Emitter {
  constructor() {
    super();
    this.active = false;
    this.tool = TOOL.PEN;
    this.color = Settings.get('painter', 'defaultColor');
    this.color2 = Settings.get('painter', 'defaultColor2');
    this.thickness = Settings.get('painter', 'defaultThickness');
    this.opacity = Settings.get('painter', 'defaultOpacity');
    this.recent = Store.get('recentColors', []);
    this.sym = { on: false, mode: SYM.VERTICAL };
    this.view = { zoom: 1, rot: 0, panX: 0, panY: 0, mirrorX: false, mirrorY: false, gray: false, grid: false };
    this.history = [];
    this.redoStack = [];
    this.nextId = 1;
    this.pointer = null;
    this.locked = false;
  }

  /* ───── Жизненный цикл ───── */

  init() {
    injectCss(PAINTER_CSS, 'gpp-painter-css');
    this.registerHotkeys();
    Net.on('screen', screen => {
      if (screen === SCREEN.DRAW && Settings.get('painter', 'enabled')) this.scheduleAttach();
      else this.detach();
    });
    Net.on('ev:' + EV.READY, d => { if (d.user === Net.me.id) this.setLocked(!!d.ready); });
    Net.on('tool:out', d => {
      if (Array.isArray(d.v) && d.v[1] >= this.nextId) this.nextId = d.v[1] + 1;
    });
    Net.on('queue', n => this.updateHud(n));
    Settings.on('painter.enabled', on => { if (!on) this.detach(); else if (Net.state.screen === SCREEN.DRAW) this.scheduleAttach(); });
    this.ui = new GameUI(this);
  }

  async scheduleAttach() {
    this.detach();
    const token = (this.attachToken = Symbol());
    try {
      const canvas = await waitFor('.drawingContainer canvas', 15000);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (token !== this.attachToken || Net.state.screen !== SCREEN.DRAW) return;
      // .drawingContainer имеет нулевую ширину (холсты внутри абсолютные), поэтому слой крепится к .drawing
      this.attach(canvas.closest('.drawing') || canvas.parentElement.parentElement);
    } catch (e) { console.warn('[GP+] холст не найден', e); }
  }

  attach(container) {
    this.container = container;
    this.gameCanvases = [...container.querySelectorAll('.drawingContainer canvas')];
    if (!this.gameCanvases.length) this.gameCanvases = [...container.querySelectorAll('canvas')];
    const ref = this.gameCanvases[0];
    this.W = ref.width; this.H = ref.height;

    this.bg = h('canvas', { width: this.W, height: this.H });
    const bctx = this.bg.getContext('2d');
    for (const c of this.gameCanvases) bctx.drawImage(c, 0, 0, this.W, this.H);
    this.doc = h('canvas', { width: this.W, height: this.H });
    this.docCtx = this.doc.getContext('2d');
    this.work = h('canvas', { width: this.W, height: this.H });
    this.workCtx = this.work.getContext('2d');
    this.compCache = null;

    this.stage = h('div', { class: 'gpp-stage' });
    this.viewCanvas = h('canvas');
    this.vctx = this.viewCanvas.getContext('2d');
    this.hud = h('div', { class: 'gpp-hud' });
    this.stage.append(this.viewCanvas, this.hud);
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.append(this.stage);
    for (const c of this.gameCanvases) c.style.visibility = 'hidden';

    this.history = []; this.redoStack = []; this.current = null;
    this.timing = new Map();
    this.nextId = 1;
    for (const s of Net.state.draw || []) if (Array.isArray(s) && s[1] >= this.nextId) this.nextId = s[1] + 1;
    this.view = { ...this.view, zoom: 1, rot: 0, panX: 0, panY: 0 };
    if (Settings.get('painter', 'resetEachTurn')) {
      this.setColor(Settings.get('painter', 'defaultColor'), false);
      this.color2 = Settings.get('painter', 'defaultColor2');
      this.thickness = Settings.get('painter', 'defaultThickness');
      this.opacity = Settings.get('painter', 'defaultOpacity');
    }
    this.locked = false;

    this.bindInput();
    this.bindGameUi();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.stage);
    // React может перерисовать части экрана: слой или встроенные панели тогда монтируются заново
    this.guard = new MutationObserver(() => {
      if (!this.active) return;
      if (!this.stage.isConnected) return this.scheduleAttach();
      if (!this.ui.mounted && document.querySelector('.colors')) this.ui.mount();
    });
    this.guard.observe(document.body, { childList: true, subtree: true });
    this.active = true;
    this.resize();
    this.syncGameUi();
    this.ui.mount();
    // после анимации появления экрана и при изменении раскладки пересчитать размер холста
    this.resizeTimer = setTimeout(() => this.resize(), 800);
    this.offLayout = Layout.on('change', () => setTimeout(() => this.resize(), 50));
    this.emit('attach');
  }

  detach() {
    this.attachToken = null;
    if (!this.active) return;
    this.active = false;
    this.cancelStroke();
    if (this.history.length) Timelapse.rememberOwn(this.history.flatMap(g => g.strokes), this.timing);
    clearTimeout(this.resizeTimer); this.offLayout?.();
    this.ro?.disconnect(); this.guard?.disconnect();
    this.unbind?.forEach(f => f());
    this.unbind = [];
    for (const c of this.gameCanvases || []) c.style.visibility = '';
    this.stage?.remove();
    this.stage = null;
    this.ui.unmount();
    this.picker?.hide();
    this.emit('detach');
  }

  on2(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    (this.unbind ||= []).push(() => target.removeEventListener(type, fn, opts));
  }

  setLocked(v) {
    this.locked = v;
    this.stage?.classList.toggle('locked', v);
    if (v) this.cancelStroke();
  }

  /* ───── Вид ───── */

  resize() {
    if (!this.stage) return;
    // Координаты считаются в пикселях макета (offsetWidth не зависит от transform экрана игры),
    // а сам холст — в реальных пикселях экрана с учётом масштаба игры: так картинка не размывается.
    this.dpr = window.devicePixelRatio || 1;
    this.cw = this.stage.offsetWidth; this.ch = this.stage.offsetHeight;
    const r = this.stage.getBoundingClientRect();
    this.pxk = this.dpr * (r.width && this.cw ? r.width / this.cw : 1);
    this.viewCanvas.width = Math.max(1, round(this.cw * this.pxk));
    this.viewCanvas.height = Math.max(1, round(this.ch * this.pxk));
    this.render();
  }

  /* Координаты клиента -> координаты стадии в CSS-пикселях макета (с учётом внешних трансформаций) */
  toStage(clientX, clientY) {
    const r = this.stage.getBoundingClientRect();
    return [(clientX - r.left) * (this.cw / (r.width || 1)), (clientY - r.top) * (this.ch / (r.height || 1))];
  }

  get baseScale() { return Math.min(this.cw / this.W, this.ch / this.H); }

  matrix() {
    const v = this.view, s = this.baseScale * v.zoom;
    return new DOMMatrix()
      .translateSelf(this.cw / 2 + v.panX, this.ch / 2 + v.panY)
      .rotateSelf(v.rot)
      .scaleSelf(s * (v.mirrorX ? -1 : 1), s * (v.mirrorY ? -1 : 1))
      .translateSelf(-this.W / 2, -this.H / 2);
  }

  toDoc(clientX, clientY) {
    const [sx, sy] = this.toStage(clientX, clientY);
    const p = this.matrix().inverse().transformPoint(new DOMPoint(sx, sy));
    return [p.x, p.y];
  }

  zoomAt(newZoom, clientX, clientY) {
    const max = Settings.get('painter', 'maxZoom');
    newZoom = clamp(newZoom, 0.2, max);
    const [sx, sy] = this.toStage(clientX, clientY);
    const docPt = this.matrix().inverse().transformPoint(new DOMPoint(sx, sy));
    this.view.zoom = newZoom;
    const np = this.matrix().transformPoint(docPt);
    this.view.panX += sx - np.x;
    this.view.panY += sy - np.y;
    this.render();
  }

  resetView() {
    Object.assign(this.view, { zoom: 1, rot: 0, panX: 0, panY: 0 });
    this.render();
  }

  toggleView(key) {
    this.view[key] = !this.view[key];
    if (key === 'gray') this.stage?.classList.toggle('gray', this.view.gray);
    this.render();
    this.ui.refresh();
  }

  render() {
    if (!this.active || this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => { this.rafPending = false; this.draw(); });
  }

  draw() {
    if (!this.active) return;
    const c = this.vctx, k = this.pxk;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.viewCanvas.width, this.viewCanvas.height);
    const m = this.matrix();
    c.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]).multiply(m));
    c.imageSmoothingEnabled = this.view.zoom < 2;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, this.W, this.H);
    c.drawImage(this.bg, 0, 0);
    if (this.current) {
      this.workCtx.clearRect(0, 0, this.W, this.H);
      this.workCtx.drawImage(this.doc, 0, 0);
      for (const v of this.current.strokes) renderStroke(this.workCtx, v);
      c.drawImage(this.work, 0, 0);
    } else c.drawImage(this.doc, 0, 0);

    const px = 1 / (this.baseScale * this.view.zoom);
    if (this.view.grid) {
      const g = Settings.get('painter', 'gridSize');
      c.save(); c.globalAlpha = Settings.get('painter', 'gridOpacity'); c.strokeStyle = '#5b4b8a'; c.lineWidth = px;
      c.beginPath();
      for (let x = g; x < this.W; x += g) { c.moveTo(x, 0); c.lineTo(x, this.H); }
      for (let y = g; y < this.H; y += g) { c.moveTo(0, y); c.lineTo(this.W, y); }
      c.stroke(); c.restore();
    }
    if (this.sym.on) this.drawGuides(c, px);
    if (this.pointer && Settings.get('painter', 'showCursor') && !this.locked) this.drawCursor(c, px);
  }

  drawGuides(c, px) {
    const cx = this.W / 2, cy = this.H / 2, L = Math.hypot(this.W, this.H);
    c.save(); c.strokeStyle = Settings.get('painter', 'symmetryColor'); c.lineWidth = 1.5 * px; c.setLineDash([8 * px, 6 * px]); c.globalAlpha = 0.85;
    c.beginPath();
    const mode = this.sym.mode;
    if (mode === SYM.VERTICAL || mode === SYM.QUADRANT) { c.moveTo(cx, 0); c.lineTo(cx, this.H); }
    if (mode === SYM.HORIZONTAL || mode === SYM.QUADRANT) { c.moveTo(0, cy); c.lineTo(this.W, cy); }
    if (mode === SYM.RADIAL || mode === SYM.MANDALA) {
      const n = mode === SYM.RADIAL ? Settings.get('painter', 'radialCount') : Settings.get('painter', 'mandalaCount');
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (Math.PI * 2 * k) / n; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); }
    }
    c.stroke(); c.restore();
  }

  drawCursor(c, px) {
    const [x, y] = this.pointer;
    const mode = this.mode();
    c.save();
    c.lineWidth = px;
    if (mode === 'dropper') {
      c.beginPath(); c.arc(x, y, 18 * px, 0, Math.PI * 2);
      c.lineWidth = 8 * px; c.strokeStyle = this.peekColor || this.color; c.stroke();
      c.lineWidth = px; c.strokeStyle = '#000'; c.beginPath(); c.arc(x, y, 22 * px, 0, Math.PI * 2); c.stroke();
    } else {
      const tool = this.effectiveTool();
      const size = tool === TOOL.ERASER ? this.eraserSize() : this.thickness;
      const r = Math.max(size / 2, 2 * px);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(0,0,0,.65)'; c.stroke();
      c.beginPath(); c.arc(x, y, r + px, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
      if (r < 6 * px) { c.beginPath(); c.moveTo(x - 6 * px, y); c.lineTo(x + 6 * px, y); c.moveTo(x, y - 6 * px); c.lineTo(x, y + 6 * px); c.strokeStyle = '#000'; c.stroke(); }
    }
    c.restore();
  }

  /* Индикаторы состояния: в шапке книги, а если шапки нет — в углу холста */
  updateHud(queueSize = Net.queue.length) {
    if (!this.hud) return;
    const inHeader = !!this.ui?.chips?.isConnected;
    this.hud.style.display = inHeader ? 'none' : '';
    const target = inHeader ? this.ui.chips : this.hud;
    const chips = [];
    if (this.view.zoom !== 1) chips.push(round(this.view.zoom * 100) + '%');
    if (this.view.rot) chips.push('↻ ' + round(this.view.rot) + '°');
    if (this.view.mirrorX) chips.push('Зеркало');
    if (this.view.mirrorY) chips.push('Зеркало ↕');
    if (this.view.gray) chips.push('Ч/Б');
    if (this.sym.on) chips.push('Симметрия: ' + SYM_NAMES[this.sym.mode]);
    if (queueSize) chips.push('Отправка: ' + queueSize);
    target.replaceChildren(...chips.map(t => h('span', { class: 'gpp-chip' + (t.startsWith('Отправка') ? ' accent' : '') }, t)));
  }

  /* ───── Состояние инструмента ───── */

  setTool(t) {
    this.tool = t;
    this.syncGameUi();
    this.ui.refresh();
    this.render();
  }

  setColor(hex, addRecent = true) {
    if (!Color.valid(hex)) return;
    this.color = Color.norm(hex);
    if (addRecent) this.pushRecent(this.color);
    this.ui?.refresh();
    this.render();
  }

  pushRecent(hex) {
    this.recent = [hex, ...this.recent.filter(c => c !== hex)].slice(0, 14);
    Store.set('recentColors', this.recent);
  }

  setThickness(v) {
    this.thickness = clamp(round(v), 1, Settings.get('painter', 'maxThickness'));
    this.syncGameUi();
    this.ui.refresh();
    this.render();
  }

  setOpacity(v) {
    this.opacity = clamp(round(v), 1, 10);
    this.syncGameUi();
    this.ui.refresh();
  }

  resetColors() { this.color = '#000000'; this.color2 = '#ffffff'; this.ui.refresh(); this.render(); }

  swapColors() { [this.color, this.color2] = [this.color2, this.color]; this.ui.refresh(); this.render(); }

  eraserSize() { return Settings.get('painter', 'doubleEraser') ? this.thickness * 2 : this.thickness; }

  effectiveTool() { return Hotkeys.isHeld('eraserHold') ? TOOL.ERASER : this.tool; }

  mode() {
    const held = id => Hotkeys.isHeld(id);
    if (held('rotate')) return 'rotate';
    if (held('pan')) return 'pan';
    if (held('dropper')) return 'dropper';
    if (held('zoom')) return 'zoom';
    if (held('thickness')) return 'thickness';
    if (held('opacity')) return 'opacity';
    if (held('brightness')) return 'brightness';
    return 'draw';
  }

  /* ───── Ввод ───── */

  bindInput() {
    const vc = this.viewCanvas;
    vc.style.cursor = Settings.get('painter', 'showCursor') ? 'none' : 'crosshair';
    this.on2(vc, 'contextmenu', e => e.preventDefault());
    this.on2(vc, 'pointerdown', e => this.onDown(e));
    this.on2(vc, 'pointermove', e => this.onMove(e));
    this.on2(vc, 'pointerup', e => this.onUp(e));
    this.on2(vc, 'pointercancel', () => this.cancelStroke());
    this.on2(vc, 'pointerleave', () => { if (!this.drag) { this.pointer = null; this.render(); } });
    this.on2(vc, 'wheel', e => {
      e.preventDefault();
      const step = Settings.get('painter', 'zoomStep');
      this.zoomAt(this.view.zoom * (e.deltaY < 0 ? step : 1 / step), e.clientX, e.clientY);
      this.updateHud();
    }, { passive: false });
  }

  onDown(e) {
    if (this.locked) return;
    e.preventDefault();
    this.viewCanvas.setPointerCapture(e.pointerId);
    const p = this.toDoc(e.clientX, e.clientY);
    this.pointer = p;
    const mode = e.button === 1 ? 'pan' : this.mode();
    this.drag = { mode, sx: e.clientX, sy: e.clientY, start: p, view: { ...this.view }, thickness: this.thickness, opacity: this.opacity, hsv: Color.hexToHsv(this.color), button: e.button };
    if (mode === 'dropper') { this.pickColor(p, e.button === 2); return; }
    if (mode !== 'draw' || (e.button !== 0 && e.button !== 2)) return;
    this.beginStroke(p, e.button === 2 ? this.color2 : this.color);
  }

  onMove(e) {
    const p = this.toDoc(e.clientX, e.clientY);
    this.pointer = p;
    const d = this.drag;
    if (!d) {
      if (this.mode() === 'dropper') this.peekColor = this.sampleColor(p);
      return this.render();
    }
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    const S = k => Settings.get('painter', k);
    switch (d.mode) {
      case 'dropper': this.pickColor(p, d.button === 2); break;
      case 'pan': this.view.panX = d.view.panX + dx; this.view.panY = d.view.panY + dy; break;
      case 'zoom': {
        const z = clamp(d.view.zoom * Math.exp(-dy * 0.01), 0.2, S('maxZoom'));
        this.view = { ...d.view };
        this.zoomAt(z, d.sx, d.sy);
        break;
      }
      case 'rotate': {
        const r = this.stage.getBoundingClientRect();
        const cx = r.left + r.width / 2 + d.view.panX, cy = r.top + r.height / 2 + d.view.panY;
        const a0 = Math.atan2(d.sy - cy, d.sx - cx), a1 = Math.atan2(e.clientY - cy, e.clientX - cx);
        let deg = d.view.rot + ((a1 - a0) * 180) / Math.PI;
        if (e.shiftKey) deg = round(deg / 15) * 15;
        this.view.rot = ((deg % 360) + 360) % 360;
        break;
      }
      case 'thickness': this.setThickness(d.thickness + dx * 0.25 * S('thicknessSensitivity')); break;
      case 'opacity': this.setOpacity(d.opacity + dx * 0.03 * S('opacitySensitivity')); break;
      case 'brightness': {
        const [hh, s, v] = d.hsv;
        this.setColor(Color.hsvToHex(hh, s, clamp(v - dy * 0.004 * S('brightnessSensitivity'), 0, 1)), false);
        break;
      }
      case 'draw':
        if (this.current) this.extendStroke(p, e);
        break;
    }
    this.updateHud();
    this.render();
  }

  onUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.mode === 'draw' && this.current) this.endStroke(e);
    if (d.mode === 'brightness') this.pushRecent(this.color);
    this.render();
  }

  /* ───── Штрихи ───── */

  beginStroke(p, color) {
    const tool = this.effectiveTool();
    const ip = [round(p[0]), round(p[1])];
    if (tool === TOOL.FILL) return this.fillAt(ip, color);
    const style = [color, this.thickness, this.opacity];
    this.current = { tool, style, raw: [ip], smooth: [ip], start: ip, end: ip, strokes: [], ids: [], t0: Date.now() };
    const transforms = this.sym.on ? symmetryTransforms(this.sym.mode, this.symCount(), this.W / 2, this.H / 2) : [];
    this.current.transforms = [{ f: q => q, rigid: true }, ...transforms];
    if (SHAPE_TOOLS.has(tool) && (this.sym.mode === SYM.RADIAL || this.sym.mode === SYM.MANDALA))
      this.current.transforms = this.current.transforms.filter(t => t.rigid || tool === TOOL.LINE);
    this.current.ids = this.current.transforms.map(() => this.nextId++);
    this.buildStrokes();
    if (tool === TOOL.PEN || tool === TOOL.ERASER) this.current.strokes.forEach(v => Net.tool(1, v.slice()));
  }

  symCount() { return this.sym.mode === SYM.RADIAL ? Settings.get('painter', 'radialCount') : Settings.get('painter', 'mandalaCount'); }

  extendStroke(p, e) {
    const cur = this.current;
    const ip = [round(p[0]), round(p[1])];
    if (cur.tool === TOOL.PEN || cur.tool === TOOL.ERASER) {
      const lvl = Settings.get('painter', 'smoothing');
      const last = cur.smooth[cur.smooth.length - 1];
      const a = 1 / (1 + lvl);
      const sp = [round(last[0] + (p[0] - last[0]) * a), round(last[1] + (p[1] - last[1]) * a)];
      if (sp[0] === last[0] && sp[1] === last[1]) return;
      cur.smooth.push(sp);
    } else {
      cur.end = this.constrainShape(cur.tool, cur.start, ip, e);
    }
    this.buildStrokes();
  }

  constrainShape(tool, a, b, e) {
    let [x2, y2] = b;
    const perfect = Hotkeys.isHeld('perfect') || e?.shiftKey;
    if (perfect) {
      const dx = x2 - a[0], dy = y2 - a[1];
      if (tool === TOOL.LINE) {
        const ang = round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12), len = Math.hypot(dx, dy);
        x2 = round(a[0] + Math.cos(ang) * len); y2 = round(a[1] + Math.sin(ang) * len);
      } else {
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        x2 = a[0] + Math.sign(dx || 1) * s; y2 = a[1] + Math.sign(dy || 1) * s;
      }
    }
    return [x2, y2];
  }

  buildStrokes() {
    const cur = this.current;
    const centered = Hotkeys.isHeld('centered') && cur.tool !== TOOL.LINE;
    cur.strokes = cur.transforms.map(({ f }, i) => {
      const id = cur.ids[i];
      if (cur.tool === TOOL.PEN || cur.tool === TOOL.ERASER) {
        const pts = cur.smooth.map(q => f(q).map(round));
        const out = [cur.tool, id, cur.tool === TOOL.PEN ? cur.style : this.eraserSize(), pts[0][0], pts[0][1]];
        for (let k = 1; k < pts.length; k++) {
          const dx = pts[k][0] - pts[k - 1][0], dy = pts[k][1] - pts[k - 1][1];
          if (dx || dy) out.push(dx, dy);
        }
        return out;
      }
      let a = cur.start, b = cur.end;
      if (centered) a = [2 * cur.start[0] - cur.end[0], 2 * cur.start[1] - cur.end[1]];
      const pa = f(a).map(round), pb = f(b).map(round);
      if (cur.tool === TOOL.LINE) return [cur.tool, id, cur.style, pa[0], pa[1], pb[0], pb[1]];
      return [cur.tool, id, cur.style, Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1])];
    });
  }

  endStroke() {
    const cur = this.current;
    this.current = null;
    if (cur.tool === TOOL.PEN || cur.tool === TOOL.ERASER) {
      if (cur.smooth.length > 1) cur.strokes.forEach(v => Net.tool(3, v));
    } else {
      if (cur.start[0] === cur.end[0] && cur.start[1] === cur.end[1]) { this.render(); return; }
      cur.strokes.forEach(v => Net.tool(1, v));
    }
    this.commit({ ids: cur.ids, strokes: cur.strokes, t0: cur.t0 });
  }

  cancelStroke() {
    if (!this.current) return;
    const cur = this.current;
    this.current = null;
    if (cur.tool === TOOL.PEN || cur.tool === TOOL.ERASER) this.commit({ ids: cur.ids, strokes: cur.strokes, t0: cur.t0 });
    this.render();
  }

  commit(group) {
    const t1 = Date.now();
    for (const id of group.ids) if (!this.timing.has(id)) this.timing.set(id, [group.t0 || t1, t1]);
    this.history.push(group);
    this.redoStack = [];
    for (const v of group.strokes) renderStroke(this.docCtx, v);
    this.compCache = null;
    this.enableReady();
    this.render();
  }

  rebuildDoc() {
    this.docCtx.clearRect(0, 0, this.W, this.H);
    for (const g of this.history) for (const v of g.strokes) renderStroke(this.docCtx, v);
    this.compCache = null;
    this.render();
  }

  undo() {
    const g = this.history.pop();
    if (!g) return;
    g.ids.forEach(id => Net.tool(2, id));
    this.redoStack.push(g);
    this.rebuildDoc();
  }

  redo() {
    const g = this.redoStack.pop();
    if (!g) return;
    g.strokes.forEach(v => Net.tool(1, v));
    this.history.push(g);
    for (const v of g.strokes) renderStroke(this.docCtx, v);
    this.compCache = null;
    this.render();
  }

  async clearAll() {
    if (!this.history.length) return;
    if (Settings.get('painter', 'clearConfirm') && !(await confirmDialog('Очистить холст?', 'Все ваши штрихи этого хода будут отменены. Вернуть их будет нельзя.', 'Очистить'))) return;
    for (const g of [...this.history].reverse()) g.ids.forEach(id => Net.tool(2, id));
    this.history = []; this.redoStack = [];
    this.rebuildDoc();
  }

  composite() {
    if (this.compCache) return this.compCache;
    const c = h('canvas', { width: this.W, height: this.H });
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, this.W, this.H);
    x.drawImage(this.bg, 0, 0); x.drawImage(this.doc, 0, 0);
    this.compCache = x.getImageData(0, 0, this.W, this.H);
    return this.compCache;
  }

  sampleColor([x, y]) {
    x = round(x); y = round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return null;
    const d = this.composite().data, i = (y * this.W + x) * 4;
    return Color.rgbToHex(d[i], d[i + 1], d[i + 2]);
  }

  pickColor(p, secondary) {
    const c = this.sampleColor(p);
    if (!c) return;
    if (secondary) this.color2 = c; else this.color = c;
    this.peekColor = c;
    this.ui.refresh();
    this.render();
  }

  fillAt(p, color) {
    const img = this.composite();
    const transforms = [{ f: q => q }, ...(this.sym.on ? symmetryTransforms(this.sym.mode, this.symCount(), this.W / 2, this.H / 2) : [])];
    const tol = Settings.get('painter', 'fillTolerance');
    const group = { ids: [], strokes: [] };
    for (const { f } of transforms) {
      const [x, y] = f(p).map(round);
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
      const rects = floodRects(img, this.W, this.H, x, y, tol);
      if (!rects.length) continue;
      const id = this.nextId++;
      const v = [TOOL.FILL, id, [color, this.opacity]];
      for (const [rx, ry, rw, rh, k] of rects) v.push(rx, ry, rw, rh, k);
      group.ids.push(id); group.strokes.push(v);
      Net.tool(1, v);
    }
    if (group.ids.length) this.commit(group);
  }

  saveImage() {
    const c = h('canvas', { width: this.W, height: this.H });
    c.getContext('2d').putImageData(this.composite(), 0, 0);
    c.toBlob(b => downloadBlob(b, `gartic-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`));
  }

  /* ───── Связь с интерфейсом игры ───── */

  bindGameUi() {
    const tools = document.querySelector('.tools');
    if (tools) this.on2(tools, 'click', e => {
      const el = e.target.closest('.tool');
      if (!el) return;
      if (el.classList.contains('undo')) { e.stopImmediatePropagation(); e.preventDefault(); return this.undo(); }
      if (el.classList.contains('redo')) { e.stopImmediatePropagation(); e.preventDefault(); return this.redo(); }
      for (const [cls, id] of Object.entries(GAME_TOOL_CLASS)) if (el.classList.contains(cls)) { this.tool = id; this.ui.refresh(); }
    }, true);
    const opts = document.querySelector('.options');
    if (opts) {
      this.on2(opts, 'click', e => {
        const b = e.target.closest('.thickness');
        if (!b) return;
        const idx = [...opts.querySelectorAll('.thickness')].indexOf(b);
        if (idx >= 0) this.setThickness(GAME_THICKNESS[idx]);
      }, true);
      this.on2(opts, 'input', e => { if (e.target.type === 'range') this.setOpacity(+e.target.value); }, true);
    }
    this.on2(document, 'click', e => {
      const sw = e.target.closest('.colors .color, .colorslist > *, .colors [style*="background"]');
      if (!sw || !this.active) return;
      const bg = getComputedStyle(sw).backgroundColor.match(/\d+/g);
      if (bg) this.setColor(Color.rgbToHex(+bg[0], +bg[1], +bg[2]));
    }, true);
    const dl = document.querySelector('.header button.download');
    if (dl) this.on2(dl, 'click', e => { e.stopImmediatePropagation(); e.preventDefault(); this.saveImage(); }, true);
    const ready = document.querySelector('.content-button button');
    if (ready) {
      this.readyBtn = ready;
      // Игра не знает о наших штрихах и считает холст пустым, поэтому «Готово» отправляется самим скриптом.
      this.on2(ready, 'click', async e => {
        e.stopImmediatePropagation(); e.preventDefault();
        const next = !Net.me.ready;
        if (next && Settings.get('painter', 'readyConfirm') && !(await confirmDialog('Завершить ход?', 'Рисунок будет отправлен как готовый.', 'Готово'))) return;
        this.cancelStroke();
        Net.ready(next);
      }, true);
    }
  }

  enableReady() {
    const b = this.readyBtn;
    if (b && b.hasAttribute('disabled') && !Net.me.ready) b.removeAttribute('disabled');
  }

  syncGameUi() {
    if (!this.active) return;
    const cls = Object.entries(GAME_TOOL_CLASS).find(([, id]) => id === this.tool)?.[0];
    document.querySelectorAll('.tools .tool').forEach(t => {
      if (!/undo|redo/.test(t.className)) t.classList.toggle('sel', !!cls && t.classList.contains(cls));
    });
    const ths = document.querySelectorAll('.options .thickness');
    ths.forEach((t, i) => t.classList.toggle('sel', GAME_THICKNESS[i] === this.thickness));
    const op = document.querySelector('.options input[type=range]');
    if (op) op.value = this.opacity;
  }

  /* ───── Горячие клавиши ───── */

  registerHotkeys() {
    const R = (id, label, defs, o) => Hotkeys.register(id, label, defs, o);
    const G1 = { group: 'Инструменты' }, G2 = { group: 'Кисть и цвет' }, G3 = { group: 'Вид' }, G4 = { group: 'Действия' };
    R('brush', 'Кисть', ['KeyB'], G1);
    R('eraser', 'Ластик', ['KeyE'], G1);
    R('line', 'Линия', ['KeyL'], G1);
    R('rect', 'Прямоугольник', ['KeyU'], G1);
    R('rectFill', 'Прямоугольник залитый', ['Shift+KeyU'], G1);
    R('ellipse', 'Эллипс', ['KeyO'], G1);
    R('ellipseFill', 'Эллипс залитый', ['Shift+KeyO'], G1);
    R('fill', 'Заливка', ['KeyK'], G1);
    R('eraserHold', 'Ластик', ['KeyC'], { ...G1, hold: true });
    R('perfect', 'Ровные фигуры (квадрат, круг, 15°)', ['KeyQ'], { ...G1, hold: true });
    R('centered', 'Фигура от центра', ['KeyR'], { ...G1, hold: true });
    R('dropper', 'Пипетка', ['AltLeft'], { ...G2, hold: true });
    R('thickness', 'Толщина: тянуть мышью', ['ControlLeft'], { ...G2, hold: true });
    R('opacity', 'Насыщенность: тянуть мышью', ['ShiftLeft'], { ...G2, hold: true });
    R('brightness', 'Яркость цвета: тянуть мышью', ['KeyV'], { ...G2, hold: true });
    R('thinner', 'Тоньше', ['BracketLeft'], { ...G2, repeat: true });
    R('thicker', 'Толще', ['BracketRight'], { ...G2, repeat: true });
    R('lessOpacity', 'Прозрачнее', ['Comma'], { ...G2, repeat: true });
    R('moreOpacity', 'Насыщеннее', ['Period'], { ...G2, repeat: true });
    GAME_THICKNESS.forEach((t, i) => R('size' + (i + 1), `Толщина ${t}`, ['Digit' + (i + 1)], G2));
    R('swap', 'Поменять основной и доп. цвет', ['KeyX'], G2);
    R('resetColors', 'Чёрный и белый', ['KeyD'], G2);
    R('picker', 'Палитра под курсором', ['Tab'], G2);
    R('pan', 'Перемещать холст', ['Space'], { ...G3, hold: true });
    R('rotate', 'Поворачивать холст', ['Ctrl+Space'], { ...G3, hold: true });
    R('zoom', 'Масштаб: тянуть мышью', ['KeyZ'], { ...G3, hold: true });
    R('zoomIn', 'Приблизить', ['Equal', 'Ctrl+Equal'], { ...G3, repeat: true });
    R('zoomOut', 'Отдалить', ['Minus', 'Ctrl+Minus'], { ...G3, repeat: true });
    R('zoomPoint', 'Приблизить к курсору / вернуть', ['KeyS'], G3);
    R('resetView', 'Сбросить вид', ['KeyA', 'Ctrl+Digit0'], G3);
    R('mirror', 'Отразить вид по горизонтали', ['KeyM'], G3);
    R('mirrorY', 'Отразить вид по вертикали', ['Shift+KeyM'], G3);
    R('gray', 'Чёрно-белый просмотр', ['KeyW'], G3);
    R('grid', 'Сетка', ['KeyG'], G3);
    R('symmetry', 'Симметрия вкл/выкл', ['KeyT'], G3);
    R('undo', 'Отменить', ['Ctrl+KeyZ'], { ...G4, repeat: true });
    R('redo', 'Повторить', ['Ctrl+KeyY', 'Ctrl+Shift+KeyZ'], { ...G4, repeat: true });
    R('save', 'Сохранить PNG', ['Ctrl+KeyS'], G4);
    R('clear', 'Очистить холст', ['Shift+Delete'], G4);
    R('studio', 'Показать / скрыть панели GP+', ['KeyH'], G4);
    R('reference', 'Окно референсов', ['KeyP'], { group: 'Окна' });

    Hotkeys.on('tap', id => {
      if (id === 'reference') return Reference.toggle();
      if (!this.active) return;
      const T = { brush: TOOL.PEN, eraser: TOOL.ERASER, line: TOOL.LINE, rect: TOOL.RECT, rectFill: TOOL.RECT_FILL, ellipse: TOOL.ELLIPSE, ellipseFill: TOOL.ELLIPSE_FILL, fill: TOOL.FILL };
      if (T[id]) return this.setTool(T[id]);
      const m = id.match(/^size(\d)$/);
      if (m) return this.setThickness(GAME_THICKNESS[+m[1] - 1]);
      const p = this.lastClient || { x: this.stage.getBoundingClientRect().left + this.cw / 2, y: this.stage.getBoundingClientRect().top + this.ch / 2 };
      const step = Settings.get('painter', 'zoomStep');
      switch (id) {
        case 'thinner': this.setThickness(this.thickness - 1); break;
        case 'thicker': this.setThickness(this.thickness + 1); break;
        case 'lessOpacity': this.setOpacity(this.opacity - 1); break;
        case 'moreOpacity': this.setOpacity(this.opacity + 1); break;
        case 'swap': this.swapColors(); break;
        case 'resetColors': this.resetColors(); break;
        case 'picker': this.openPicker(p.x, p.y); break;
        case 'zoomIn': this.zoomAt(this.view.zoom * step, p.x, p.y); break;
        case 'zoomOut': this.zoomAt(this.view.zoom / step, p.x, p.y); break;
        case 'zoomPoint': this.view.zoom > 1.01 ? this.resetView() : this.zoomAt(Settings.get('painter', 'zoomToPoint'), p.x, p.y); break;
        case 'resetView': this.resetView(); break;
        case 'mirror': this.toggleView('mirrorX'); break;
        case 'mirrorY': this.toggleView('mirrorY'); break;
        case 'gray': this.toggleView('gray'); break;
        case 'grid': this.toggleView('grid'); break;
        case 'symmetry': this.sym.on = !this.sym.on; this.ui.refresh(); this.render(); break;
        case 'undo': this.undo(); break;
        case 'redo': this.redo(); break;
        case 'save': this.saveImage(); break;
        case 'clear': this.clearAll(); break;
        case 'studio': this.ui.togglePanels(); break;
      }
      this.updateHud();
    });
    Hotkeys.on('hold:start', () => this.active && this.render());
    Hotkeys.on('hold:end', id => {
      if (!this.active) return;
      if (id === 'dropper') { this.peekColor = null; this.pushRecent(this.color); }
      this.render();
    });
    window.addEventListener('pointermove', e => { this.lastClient = { x: e.clientX, y: e.clientY }; }, true);
  }

  openPicker(x, y) {
    if (!this.picker) {
      this.picker = new Win({ id: 'popup-picker', title: 'Цвет', width: 250 });
      this.picker.el.classList.add('gpp-popup-picker');
      this.popupCp = new ColorPicker({ width: 196, height: 170, vertical: true });
      this.popupCp.on('input', hex => this.setColor(hex, false));
      this.popupCp.on('commit', hex => this.pushRecent(hex));
      this.picker.body.append(this.popupCp.el);
      // Как всплывающая палитра в редакторах: повторная клавиша, Esc или клик мимо — закрыть
      window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.picker.visible) { e.stopPropagation(); this.picker.hide(); } }, true);
      window.addEventListener('pointerdown', e => { if (this.picker.visible && !this.picker.el.contains(e.target)) this.picker.hide(); }, true);
    } else if (this.picker.visible) return this.picker.hide();
    this.popupCp.set(this.color);
    this.picker.pos = { x: x - 125, y: y - 110 };
    this.picker.show();
  }
})();

/* ───────────────────────────── Встраивание в интерфейс игры ─────────────────────────────
   Левая колонка игры (.colors): своя панель цвета вместо родной палитры.
   Правая колонка (.tools): блок симметрии и вида под инструментами игры.
   Шапка книги (.header): кнопки «Настройки» и «Референсы», индикаторы состояния.
   Всё вставляется внутрь .screen, поэтому масштабируется вместе с игрой.            */

const GAMEUI_CSS = `
.gpp-col{width:129px;padding:4px 8px 8px;border-radius:9px;background:var(--gpp-panel-bg);border:1.6px solid var(--gpp-panel-border);
box-shadow:0 0 0 3px var(--gpp-panel-shadow);display:flex;flex-direction:column;color:#fff;font:11px/1.2 var(--gpp-f-bold);user-select:none}
.gpp-col *{box-sizing:border-box}
.gpp-left{width:152px}
.gpp-right{margin-top:16px}
.gpp-panels-hidden .gpp-col,.gpp-panels-hidden .gpp-hdr{display:none}
.gpp-panels-hidden .colors .content.gpp-native-hidden{display:flex !important}
.gpp-pn{padding:6px 0 2px;border-top:1px solid var(--gpp-panel-border)}
.gpp-pn:first-child{border-top:0}
.gpp-pn-h{display:flex;align-items:center;gap:2px;height:20px;margin-bottom:6px}
.gpp-pn-h .t{flex:1;min-width:0;display:flex;align-items:center;gap:5px;font:11px var(--gpp-f-bold);color:rgba(255,255,255,.8);cursor:pointer;white-space:nowrap}
.gpp-pn-h .t:hover{color:#fff}
.gpp-pn-h .t:empty{flex:none;padding:0 4px 0 0;height:20px}
.gpp-pn-h .t::before{content:"";border:4px solid transparent;border-top-color:currentColor;border-bottom:0;transition:transform .15s}
.gpp-pn.collapsed .gpp-pn-h{margin-bottom:2px}
.gpp-pn.collapsed .gpp-pn-h .t::before{transform:rotate(-90deg)}
.gpp-pn.collapsed .gpp-pn-b{display:none}
.gpp-pn-b{display:flex;flex-direction:column;gap:7px}
.gpp-ib{width:20px;height:20px;flex:none;border:0;border-radius:5px;background:transparent;color:#fff;opacity:.75;cursor:pointer;display:grid;place-items:center;padding:0}
.gpp-ib:hover{opacity:1;background:rgba(255,255,255,.16)}
.gpp-ib svg{width:13px;height:13px}
.gpp-pn-h select{flex:1;min-width:0;background:rgba(0,0,0,.3);border:0;border-radius:5px;color:#fff;font:11px var(--gpp-f-bold);padding:2px 2px;outline:none;cursor:pointer}
.gpp-pn-h select option{background:var(--gpp-field)}
.gpp-fgbg{display:flex;align-items:center;gap:9px}
.gpp-sq{position:relative;width:44px;height:40px;flex:none}
.gpp-sq .fg,.gpp-sq .bg{position:absolute;width:28px;height:28px;border-radius:5px;box-shadow:0 0 0 1.5px #fff,0 0 0 3px rgba(0,0,0,.3);cursor:pointer}
.gpp-sq .fg{left:1px;top:1px;z-index:1}
.gpp-sq .bg{right:1px;bottom:1px}
.gpp-hexbox{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.gpp-hexbox input{width:100%;background:rgba(0,0,0,.3);border:1.5px solid transparent;border-radius:6px;color:#fff;font:12px var(--gpp-f-bold);padding:5px 6px;outline:none;text-transform:uppercase}
.gpp-hexbox input:focus{border-color:#fff}
.gpp-hexbox .row{display:flex;gap:2px}
.gpp-cp.vert{flex-direction:row;gap:8px}
.gpp-cp.vert .gpp-cp-svwrap{flex:1;min-width:0}
.gpp-col .gpp-cp.vert{gap:6px}
.gpp-col .gpp-cp canvas{border-radius:5px;box-shadow:0 0 0 1.5px rgba(255,255,255,.65)}
.gpp-cp.vert .gpp-cp-huewrap{width:12px;flex:none}
.gpp-cp.vert .gpp-cp-huewrap canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:6px}
.gpp-cp.vert .gpp-cp-hmark{left:-3px;top:0;width:18px;height:6px;transform:translateY(-50%)}
.gpp-spectrum{display:grid;grid-template-columns:repeat(13,1fr);border-radius:5px;overflow:hidden;box-shadow:0 0 0 1.5px rgba(255,255,255,.65)}
.gpp-spectrum i{display:block;aspect-ratio:1;cursor:pointer}
.gpp-spectrum i:hover{outline:2px solid #fff;outline-offset:-1px;position:relative;z-index:1}
.gpp-spectrum i.sel{outline:2px solid var(--gpp-accent);outline-offset:-1px;position:relative;z-index:2}
.gpp-swgrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;max-height:124px;overflow:hidden auto;padding:2px;margin:-2px}
.gpp-swgrid::-webkit-scrollbar{width:4px;height:0}.gpp-swgrid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:4px}
.gpp-col .gpp-sw{width:auto;height:auto;border:0;outline:0;transform:none;aspect-ratio:1;border-radius:4px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25),0 0 0 1px rgba(255,255,255,.45)}
.gpp-col .gpp-sw:hover{transform:none;box-shadow:0 0 0 2px #fff}
.gpp-col .gpp-sw.sel{outline:0;box-shadow:0 0 0 2px var(--gpp-accent)}
.gpp-swgrid .gpp-empty{grid-column:1/-1;font:10.5px/1.3 var(--gpp-f-reg);opacity:.75}
.gpp-sl{display:grid;grid-template-columns:14px 1fr 32px;align-items:center;gap:6px}
.gpp-sl svg{width:14px;height:14px;opacity:.85}
.gpp-sl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:16px;margin:0;background:transparent;cursor:pointer}
.gpp-sl input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,#fff var(--p,50%),rgba(255,255,255,.25) var(--p,50%))}
.gpp-sl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px var(--gpp-tool-ring)}
.gpp-sl input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:rgba(255,255,255,.25)}
.gpp-sl input[type=range]::-moz-range-progress{height:4px;border-radius:2px;background:#fff}
.gpp-sl input[type=range]::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff;box-shadow:0 0 0 2px var(--gpp-tool-ring)}
.gpp-sl .num{width:32px;background:rgba(0,0,0,.3);border:1.5px solid transparent;border-radius:5px;color:#fff;font:11px var(--gpp-f-bold);text-align:center;padding:3px 0;outline:none;-moz-appearance:textfield}
.gpp-sl .num::-webkit-inner-spin-button{-webkit-appearance:none}
.gpp-sl .num:focus{border-color:#fff}
.gpp-tgrid{display:grid;grid-template-columns:repeat(3,30px);justify-content:space-between;gap:8px 0}
.gpp-tbtn{position:relative;width:30px;height:30px;border-radius:7px;border:1.6px solid #fff;box-shadow:0 0 0 2px var(--gpp-tool-ring);background:transparent;
color:#fff;display:grid;place-items:center;cursor:pointer;padding:0;font:12px/1 var(--gpp-f-black)}
.gpp-tbtn:hover{background:rgba(255,255,255,.18)}
.gpp-tbtn.on{background:#fff;color:var(--gpp-tool-ring)}
.gpp-tbtn svg{width:19px;height:19px}
.gpp-tbtn[data-tip]:hover::after{content:attr(data-tip);position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);white-space:nowrap;
background:var(--gpp-edge);color:#fff;font:11px/1 var(--gpp-f-bold);padding:6px 8px;border-radius:6px;pointer-events:none;z-index:50}
.gpp-hdr{position:absolute;left:56px;top:10px;display:flex;gap:4px;z-index:6}
.gpp-hbtn{width:32px;height:30px;border:0;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center;padding:0;border-radius:7px}
.gpp-hbtn:hover{background:rgba(255,255,255,.14)}
.gpp-hbtn.on{background:var(--gpp-accent);color:var(--gpp-edge)}
.gpp-hbtn svg{width:25px;height:25px;filter:drop-shadow(0 2px 0 rgba(23,5,87,.7))}
.gpp-hbtn svg *{stroke-width:2.1}
.gpp-chips{position:absolute;left:16px;top:50px;display:flex;flex-wrap:wrap;gap:4px;max-width:215px;z-index:6;pointer-events:none}
.gpp-chips .gpp-chip{background:rgba(23,5,87,.55);color:#fff;font:11px/1 var(--gpp-f-bold);border-radius:999px;padding:5px 8px}
.gpp-chips .gpp-chip.accent{background:var(--gpp-accent);color:var(--gpp-edge)}
`;

class GameUI {
  constructor(p) {
    this.p = p;
    this.palettes = Store.get('palettes', null) || { 'Мои цвета': [] };
    this.palName = Store.get('palette.current', 'Спектр');
    this.gamePalette = [];
    injectCss(GAMEUI_CSS, 'gpp-gameui-css');
  }

  get mounted() { return !!this.left?.isConnected; }

  mount() {
    this.unmount();
    const screen = document.querySelector('.screen');
    const colors = document.querySelector('.colors');
    const tools = document.querySelector('.tools');
    const header = document.querySelector('.book .header');
    if (!screen) return;
    this.screen = screen;
    this.copyTheme();
    if (colors) {
      const native = colors.querySelector('.content');
      this.gamePalette = [...colors.querySelectorAll('.color')].map(c => (getComputedStyle(c).backgroundColor.match(/\d+/g) || []).slice(0, 3))
        .filter(a => a.length === 3).map(a => Color.rgbToHex(+a[0], +a[1], +a[2]));
      if (native) { native.classList.add('gpp-native-hidden'); native.style.display = 'none'; this.native = native; }
      this.left = this.buildLeft();
      colors.append(this.left);
    }
    if (tools) { this.right = this.buildRight(); tools.append(this.right); }
    if (header) {
      this.hdr = h('div', { class: 'gpp-hdr gpp' },
        this.hbtn(ICON.gear, 'Настройки GP+', () => Menu.open()),
        this.refBtn = this.hbtn(ICON.image, 'Референсы (P)', () => Reference.toggle()));
      this.chips = h('div', { class: 'gpp-chips gpp' });
      header.append(this.hdr, this.chips);
    }
    screen.classList.toggle('gpp-panels-hidden', !!Store.get('panels.hidden', false));
    this.refresh();
    this.p.updateHud();
  }

  unmount() {
    for (const el of [this.left, this.right, this.hdr, this.chips]) el?.remove();
    if (this.native) { this.native.style.display = ''; this.native.classList.remove('gpp-native-hidden'); }
    this.screen?.classList.remove('gpp-panels-hidden');
    this.left = this.right = this.hdr = this.chips = this.native = null;
  }

  togglePanels() {
    const hidden = !Store.get('panels.hidden', false);
    Store.set('panels.hidden', hidden);
    this.screen?.classList.toggle('gpp-panels-hidden', hidden);
    toast(hidden ? 'Панели GP+ скрыты (H — вернуть)' : 'Панели GP+ показаны');
  }

  /* Цвета панелей берутся с колонки инструментов: у разных экранов игры своя гамма */
  copyTheme() {
    const panel = document.querySelector('.tools > div'), tool = document.querySelector('.tools .tool');
    const st = this.screen.style;
    if (panel) {
      const cs = getComputedStyle(panel);
      st.setProperty('--gpp-panel-bg', cs.backgroundColor);
      st.setProperty('--gpp-panel-border', cs.borderTopColor);
      const sh = cs.boxShadow.match(/rgba?\([^)]+\)/);
      if (sh) st.setProperty('--gpp-panel-shadow', sh[0]);
    }
    if (tool) {
      const ring = getComputedStyle(tool).boxShadow.match(/rgba?\([^)]+\)/);
      if (ring) st.setProperty('--gpp-tool-ring', ring[0]);
    }
  }

  hbtn(icon, tip, onclick) {
    return h('button', { class: 'gpp-hbtn', title: tip, html: icon, onclick: e => { e.stopPropagation(); onclick(); } });
  }

  tbtn(icon, tip, onclick, data = {}) {
    return h('button', { class: 'gpp-tbtn', 'data-tip': tip, html: icon, dataset: data, onclick: e => { e.stopPropagation(); onclick(e); } });
  }

  stop(el) {
    for (const t of ['pointerdown', 'mousedown', 'click', 'wheel', 'keydown']) el.addEventListener(t, e => e.stopPropagation());
    return el;
  }

  /* Секция панели в стиле графических редакторов: заголовок (клик — свернуть), иконки справа, содержимое */
  section(key, title, tools, ...content) {
    const el = h('div', { class: 'gpp-pn' + (Store.get('pn.' + key, false) ? ' collapsed' : '') });
    const t = h('div', { class: 't', title: 'Свернуть / развернуть' }, title || null);
    t.addEventListener('click', () => Store.set('pn.' + key, el.classList.toggle('collapsed')));
    el.append(h('div', { class: 'gpp-pn-h' }, t, ...tools), h('div', { class: 'gpp-pn-b' }, ...content));
    return el;
  }

  ibtn(icon, title, fn) {
    return h('button', { class: 'gpp-ib', title, html: icon, onclick: e => { e.stopPropagation(); fn(); } });
  }

  /* Ползунок: иконка, тонкая дорожка с заливкой и редактируемое число */
  slider(icon, title, min, get, set) {
    const inp = h('input', { type: 'range', min, step: 1, title });
    const num = h('input', { class: 'num', type: 'number', min, title });
    const paint = () => inp.style.setProperty('--p', ((inp.value - inp.min) / Math.max(1, inp.max - inp.min)) * 100 + '%');
    inp.addEventListener('input', () => { set(+inp.value); paint(); });
    num.addEventListener('change', () => set(clamp(+num.value || min, min, +inp.max)));
    num.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') num.blur(); });
    const row = h('div', { class: 'gpp-sl', title }, h('span', { html: icon }), inp, num);
    row.upd = max => {
      inp.max = num.max = max;
      inp.value = get();
      if (document.activeElement !== num) num.value = get();
      paint();
    };
    return row;
  }

  buildLeft() {
    const p = this.p;
    this.fg = h('div', { class: 'fg', title: 'Основной цвет' });
    this.bg = h('div', { class: 'bg', title: 'Дополнительный цвет — рисуется правой кнопкой. Клик — поменять местами (X)', onclick: () => p.swapColors() });
    this.hex = h('input', { maxlength: 7, spellcheck: 'false', title: 'HEX-код основного цвета' });
    this.hex.addEventListener('change', () => p.setColor(this.hex.value.startsWith('#') ? this.hex.value : '#' + this.hex.value));
    this.hex.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.hex.blur(); });
    this.cp = new ColorPicker({ width: 118, height: 86, vertical: true });
    this.cp.on('input', hex => p.setColor(hex, false));
    this.cp.on('commit', hex => p.pushRecent(hex));
    this.palSel = h('select', { title: 'Набор цветов' });
    this.palSel.addEventListener('change', () => { this.palName = this.palSel.value; Store.set('palette.current', this.palName); this.refresh(); });
    const file = h('input', { type: 'file', accept: '.aco,.gpl,.txt,.hex', style: { display: 'none' } });
    file.addEventListener('change', () => this.importPalette(file.files[0]).finally(() => (file.value = '')));
    this.spectrum = this.buildSpectrum();
    this.palGrid = h('div', { class: 'gpp-swgrid' });
    this.recentGrid = h('div', { class: 'gpp-swgrid gpp-recent' });
    this.size = this.slider(ICON.dot, 'Толщина кисти: [ и ], или Ctrl + тянуть мышью', 1, () => p.thickness, v => p.setThickness(v));
    this.opac = this.slider(ICON.gray, 'Насыщенность кисти: , и ., или Shift + тянуть мышью', 1, () => p.opacity, v => p.setOpacity(v));
    return this.stop(h('div', { class: 'gpp-col gpp-left gpp' },
      this.section('color', 'Цвет', [
        this.ibtn(ICON.swap, 'Поменять основной и дополнительный (X)', () => p.swapColors()),
        this.ibtn(ICON.bw, 'Чёрный и белый (D)', () => p.resetColors()),
      ],
      h('div', { class: 'gpp-fgbg' }, h('div', { class: 'gpp-sq' }, this.fg, this.bg), h('div', { class: 'gpp-hexbox' }, this.hex)),
      this.cp.el),
      this.section('palette', '', [this.palSel,
        this.ibtn(ICON.plus, 'Добавить текущий цвет в «Мои цвета»', () => this.addToMine()),
        this.ibtn(ICON.upload, 'Импорт палитры (.aco, .gpl, .txt)', () => file.click()), file],
      this.spectrum, this.palGrid),
      this.section('brush', 'Кисть', [], this.size, this.opac),
      this.section('recent', 'Недавние', [], this.recentGrid)));
  }

  /* Спектр как в gpmod: столбцы — оттенки, строки — светлота; последний столбец серый, нижняя строка — тона кожи */
  buildSpectrum() {
    const hsl = (hh, s, l) => {
      const a = s * Math.min(l, 1 - l), f = n => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return Color.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    };
    const colors = [];
    for (let r = 0; r < 10; r++) {
      const l = 0.9 - r * 0.084;
      for (let c = 0; c < 12; c++) colors.push(hsl(c * 30, r < 1 ? 0.75 : 0.88, l));
      colors.push(hsl(0, 0, r === 0 ? 1 : r === 9 ? 0 : 1 - r / 9));
    }
    colors.push('#ffe8d6', '#ffd5b8', '#f5c19e', '#e8a87c', '#d4915f', '#bf7a4a', '#a0613a', '#82492b', '#66361f', '#4a2616', '#f2d7c9', '#c99d84', '#2e1a10');
    this.spectrumColors = colors;
    const el = h('div', { class: 'gpp-spectrum', title: 'ЛКМ — основной цвет, ПКМ — дополнительный' });
    colors.forEach(c => el.append(h('i', { style: { background: c }, dataset: { c } })));
    el.addEventListener('click', e => { const c = e.target.dataset?.c; if (c) this.p.setColor(c); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.dataset?.c; if (c) { this.p.color2 = c; this.refresh(); } });
    return el;
  }

  buildRight() {
    const p = this.p;
    const symBtn = (mode, icon, tip) => this.tbtn(icon, tip, () => {
      if (p.sym.on && p.sym.mode === mode) p.sym.on = false;
      else { p.sym.mode = mode; p.sym.on = true; }
      this.refresh(); p.render(); p.updateHud();
    }, { mode });
    this.raysBtn = this.tbtn('', 'Лучей: колесо мыши или клик', e => this.changeRays(e.shiftKey ? -1 : 1));
    this.raysBtn.addEventListener('wheel', e => { e.preventDefault(); this.changeRays(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    this.raysBtn.addEventListener('contextmenu', e => { e.preventDefault(); this.changeRays(-1); });
    const viewBtn = (key, icon, tip) => this.tbtn(icon, tip, () => { p.toggleView(key); p.updateHud(); }, { key });
    this.symGrid = h('div', { class: 'gpp-tgrid' },
      symBtn(SYM.VERTICAL, ICON.symV, 'Симметрия: вертикальная ось (T)'),
      symBtn(SYM.HORIZONTAL, ICON.symH, 'Симметрия: горизонтальная ось'),
      symBtn(SYM.QUADRANT, ICON.symQ, 'Симметрия: 4 четверти'),
      symBtn(SYM.RADIAL, ICON.symR, 'Симметрия: радиальная'),
      symBtn(SYM.MANDALA, ICON.symM, 'Симметрия: мандала'),
      this.raysBtn);
    this.viewGrid = h('div', { class: 'gpp-tgrid' },
      viewBtn('mirrorX', ICON.mirror, 'Зеркальный вид (M)'),
      viewBtn('mirrorY', ICON.mirrorY, 'Зеркальный вид по вертикали (Shift+M)'),
      viewBtn('gray', ICON.gray, 'Чёрно-белый просмотр (W)'),
      viewBtn('grid', ICON.grid, 'Сетка (G)'),
      this.tbtn(ICON.target, 'Сбросить масштаб и поворот (A)', () => { p.resetView(); p.updateHud(); }),
      this.tbtn(ICON.trash, 'Очистить холст (Shift+Delete)', () => p.clearAll()));
    return this.stop(h('div', { class: 'gpp-col gpp-right gpp' },
      this.section('sym', 'Симметрия', [], this.symGrid),
      this.section('view', 'Вид', [], this.viewGrid)));
  }

  changeRays(d) {
    const p = this.p;
    const key = p.sym.mode === SYM.MANDALA ? 'mandalaCount' : 'radialCount';
    if (p.sym.mode !== SYM.RADIAL && p.sym.mode !== SYM.MANDALA) { p.sym.mode = SYM.RADIAL; p.sym.on = true; }
    Settings.set('painter', key, clamp(Settings.get('painter', key) + d, 2, 24));
    this.refresh(); p.render(); p.updateHud();
  }

  allPalettes() {
    return { 'Спектр': this.spectrumColors || [], Gartic: this.gamePalette.length ? this.gamePalette : BUILTIN_PALETTES['Базовая'], ...BUILTIN_PALETTES, 'Гармония': this.harmony(), ...this.palettes };
  }

  harmony() {
    const [hh, s, v] = Color.hexToHsv(this.p.color);
    const at = d => Color.hsvToHex((hh + d + 1) % 1, s, v);
    return [this.p.color, at(0.5), at(1 / 3), at(2 / 3), at(-1 / 12), at(1 / 12), at(0.25), at(0.75),
      ...[0.25, 0.5, 0.75, 1].map(k => Color.hsvToHex(hh, s, k * Math.max(v, 0.3))), ...[0.3, 0.6].map(k => Color.hsvToHex(hh, s * k, v))];
  }

  addToMine() {
    const mine = this.palettes['Мои цвета'] || (this.palettes['Мои цвета'] = []);
    if (!mine.includes(this.p.color)) mine.push(this.p.color);
    this.palName = 'Мои цвета';
    this.savePalettes();
  }

  savePalettes() { Store.set('palettes', this.palettes); Store.set('palette.current', this.palName); this.refresh(); }

  async importPalette(f) {
    if (!f) return;
    try {
      const colors = /\.aco$/i.test(f.name) ? parseAco(await f.arrayBuffer()) : parsePaletteText(await f.text());
      if (!colors.length) throw new Error('цвета не найдены');
      const name = f.name.replace(/\.[^.]+$/, '');
      this.palettes[name] = [...new Set(colors)].slice(0, 512);
      this.palName = name;
      this.savePalettes();
      toast(`Палитра «${name}»: ${this.palettes[name].length} цветов`);
    } catch (e) { toast('Не удалось прочитать палитру: ' + e.message); }
  }

  swatch(hex, removable) {
    return h('div', {
      class: 'gpp-sw' + (hex === this.p.color ? ' sel' : ''), title: hex + (removable ? ' (Shift+клик — удалить)' : ''), style: { background: hex },
      onclick: e => {
        if (e.shiftKey && removable) { this.palettes[this.palName] = this.palettes[this.palName].filter(c => c !== hex); return this.savePalettes(); }
        this.p.setColor(hex);
      },
      oncontextmenu: e => { e.preventDefault(); this.p.color2 = hex; this.refresh(); },
    });
  }

  refresh() {
    const p = this.p;
    if (!this.mounted) return;
    this.fg.style.background = p.color;
    this.bg.style.background = p.color2;
    if (document.activeElement !== this.hex) this.hex.value = p.color.toUpperCase();
    if (!this.cp.dragging) this.cp.set(p.color);
    this.size.upd(Settings.get('painter', 'maxThickness'));
    this.opac.upd(10);
    const all = this.allPalettes();
    if (!all[this.palName]) this.palName = 'Спектр';
    this.palSel.replaceChildren(...Object.keys(all).map(n => h('option', { value: n, selected: n === this.palName }, n)));
    const isSpectrum = this.palName === 'Спектр';
    this.spectrum.style.display = isSpectrum ? '' : 'none';
    this.palGrid.style.display = isSpectrum ? 'none' : '';
    if (isSpectrum) this.spectrum.querySelectorAll('i').forEach(i => i.classList.toggle('sel', i.dataset.c === p.color));
    else {
      const removable = !!this.palettes[this.palName];
      this.palGrid.replaceChildren(...all[this.palName].map(c => this.swatch(c, removable)));
      if (!all[this.palName].length) this.palGrid.append(h('div', { class: 'gpp-empty' }, 'Пусто. Кнопка «+» добавит текущий цвет.'));
    }
    this.recentGrid.replaceChildren(...p.recent.slice(0, 6).map(c => this.swatch(c)));
    if (!p.recent.length) this.recentGrid.append(h('div', { class: 'gpp-empty' }, 'Здесь появятся цвета, которыми вы рисовали.'));
    if (this.right) {
      this.symGrid.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', p.sym.on && b.dataset.mode === p.sym.mode));
      const rays = p.sym.mode === SYM.RADIAL || p.sym.mode === SYM.MANDALA;
      this.raysBtn.textContent = rays ? p.symCount() : '';
      if (!rays) this.raysBtn.innerHTML = ICON.rays;
      this.viewGrid.querySelectorAll('[data-key]').forEach(b => b.classList.toggle('on', !!p.view[b.dataset.key]));
    }
    this.refBtn?.classList.toggle('on', Reference.isOpen?.() || false);
  }
}
