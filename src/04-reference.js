/* ───────────────────────────── Референсы ─────────────────────────────
   Боковая панель слева от игры: поиск (Wikimedia Commons, Openverse), история, просмотр картинки
   с перемещением и масштабом. Картинку можно открепить в плавающее окно поверх игры.
   Google и Pinterest открываются во вкладке: картинку оттуда перетаскивают или вставляют Ctrl+V. */

const REF_CSS = `
.gpp-dock{position:fixed;z-index:2147482000;display:flex;flex-direction:column;background:var(--gpp-book);border:1.6px solid var(--gpp-edge);border-radius:12px;
box-shadow:inset 0 0 0 2px var(--gpp-head),0 6px 0 rgba(0,0,0,.25);overflow:hidden}
.gpp-dock.hidden{display:none}
.gpp-dock-head{display:flex;align-items:center;gap:4px;padding:6px;background:var(--gpp-head);box-shadow:inset 0 -2px 0 var(--gpp-head-hi)}
.gpp-dock-search{flex:1;min-width:0;display:flex;align-items:center;gap:4px;background:var(--gpp-field);border:1.6px solid var(--gpp-head-hi);border-radius:8px;padding:0 4px 0 8px}
.gpp-dock-search:focus-within{border-color:var(--gpp-accent)}
.gpp-dock-search input{flex:1;min-width:0;background:none;border:0;outline:none;color:#fff;font:13px var(--gpp-f-bold);padding:6px 0}
.gpp-dock-search svg{width:15px;height:15px;opacity:.7;flex:none}
.gpp-dock-head .gpp-icon-btn{width:28px;height:28px}
.gpp-dock-head select{max-width:92px;background:var(--gpp-field);border:1.6px solid var(--gpp-head-hi);border-radius:8px;color:#fff;font:12px var(--gpp-f-bold);padding:5px 2px;outline:none}
.gpp-dock-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.gpp-dock-status{padding:5px 10px;color:var(--gpp-dim);font:11.5px/1.3 var(--gpp-f-reg)}
.gpp-dock-grid{flex:1;min-height:0;overflow:auto;padding:0 6px 6px;column-gap:6px}
.gpp-dock-grid img{display:block;width:100%;margin:0 0 6px;border-radius:6px;cursor:zoom-in;background:var(--gpp-field);break-inside:avoid;min-height:40px}
.gpp-dock-grid img:hover{outline:2px solid var(--gpp-accent);outline-offset:-2px}
.gpp-dock-empty{padding:18px 14px;color:var(--gpp-dim);font:12.5px/1.5 var(--gpp-f-reg);text-align:center}
.gpp-dock-empty b{color:#fff;font-family:var(--gpp-f-bold)}
.gpp-dock-resize{position:absolute;right:-3px;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:5}
.gpp-dock-resize:hover{background:linear-gradient(90deg,transparent 2px,var(--gpp-accent) 2px,var(--gpp-accent) 5px,transparent 5px)}
.gpp-dock.dragover{box-shadow:inset 0 0 0 3px var(--gpp-accent)}
.gpp-history{position:absolute;left:6px;right:6px;top:2px;max-height:70%;overflow:auto;z-index:10;background:var(--gpp-field);border:1.6px solid var(--gpp-head-hi);border-radius:8px;
display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:4px;padding:6px;box-shadow:0 8px 20px rgba(0,0,0,.4)}
.gpp-history img{width:100%;height:60px;object-fit:cover;border-radius:5px;cursor:pointer}
.gpp-history img:hover{outline:2px solid var(--gpp-accent)}
.gpp-viewer{position:absolute;inset:0;overflow:hidden;background:repeating-conic-gradient(#ffffff0d 0 25%,transparent 0 50%) 0 0/16px 16px;cursor:grab;touch-action:none}
.gpp-viewer.panning{cursor:grabbing}
.gpp-viewer img{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;max-width:none}
.gpp-viewer.gray img{filter:grayscale(1)}
.gpp-viewer-bar{position:absolute;left:6px;right:6px;top:6px;display:flex;flex-wrap:wrap;gap:3px;padding:3px;border-radius:9px;background:rgba(23,5,87,.78);
opacity:0;transition:opacity .15s;z-index:2}
.gpp-viewer:hover .gpp-viewer-bar,.gpp-viewer-bar:hover{opacity:1}
.gpp-viewer-bar .gpp-icon-btn{width:26px;height:26px}
.gpp-viewer-bar .gpp-zoomval{color:#fff;font:11px var(--gpp-f-bold);align-self:center;min-width:38px;text-align:center}
.gpp-viewer-hint{position:absolute;left:8px;bottom:6px;right:8px;color:#fff;font:11px/1.3 var(--gpp-f-reg);text-shadow:0 1px 2px #000;opacity:0;transition:opacity .2s;pointer-events:none}
.gpp-viewer:hover .gpp-viewer-hint{opacity:.85}
.gpp-frame .gpp-win-body{padding:0;overflow:hidden;position:relative}
.gpp-frame .gpp-viewer{border-radius:0 0 12px 12px}
.gpp-frame .gpp-win-head{padding:4px 4px 4px 10px}
.gpp-frame .gpp-win-head .gpp-icon-btn{width:24px;height:24px}
.gpp-frame .gpp-op{width:64px;accent-color:var(--gpp-accent)}
.gpp-frame.pinned{pointer-events:none}
.gpp-frame.pinned .gpp-win-head{pointer-events:auto;opacity:.85}
`;

const REF_ENGINES = {
  commons: {
    name: 'Wikimedia',
    async search(q, page) {
      const offset = (page - 1) * 40;
      const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
        action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: q + ' filetype:bitmap', gsrlimit: '40', gsroffset: String(offset),
        prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: '320', origin: '*',
      });
      const data = await gmJson(url);
      const pages = Object.values(data?.query?.pages || {}).sort((a, b) => a.index - b.index);
      return {
        items: pages.map(p => p.imageinfo?.[0]).filter(i => i && /image\/(jpeg|png|gif|webp)/.test(i.mime))
          .map(i => ({ thumb: i.thumburl, full: i.responsiveUrls?.['2'] || i.url, w: i.width, h: i.height })),
        more: !!data?.continue,
      };
    },
  },
  openverse: {
    name: 'Openverse',
    async search(q, page) {
      const data = await gmJson('https://api.openverse.org/v1/images/?' + new URLSearchParams({ q, page: String(page), page_size: '40' }));
      return { items: (data.results || []).map(r => ({ thumb: r.thumbnail || r.url, full: r.url, w: r.width, h: r.height })), more: page < (data.page_count || 0) };
    },
  },
};

function gmJson(url) {
  return new Promise((resolve, reject) => GM_xmlhttpRequest({
    url, method: 'GET', timeout: 15000, anonymous: true, responseType: 'json',
    onload: r => {
      if (r.status !== 200) return reject(new Error('HTTP ' + r.status));
      try { resolve(typeof r.response === 'object' && r.response ? r.response : JSON.parse(r.responseText)); } catch (e) { reject(e); }
    },
    onerror: () => reject(new Error('сеть недоступна')),
    ontimeout: () => reject(new Error('таймаут')),
  }));
}

function gmBlob(url) {
  return new Promise((resolve, reject) => GM_xmlhttpRequest({
    url, method: 'GET', responseType: 'blob', anonymous: true, timeout: 20000,
    onload: r => (r.status === 200 && r.response ? resolve(r.response) : reject(new Error('HTTP ' + r.status))),
    onerror: () => reject(new Error('сеть недоступна')),
    ontimeout: () => reject(new Error('таймаут')),
  }));
}

async function saveImage(src, name = 'reference') {
  try {
    const blob = /^(blob:|data:)/.test(src) ? await (await fetch(src)).blob() : await gmBlob(src);
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    downloadBlob(blob, `${name.replace(/[^\wа-яё -]+/gi, '').trim() || 'reference'}.${ext}`);
  } catch (e) {
    toast('Не удалось скачать картинку: ' + e.message + '. Открываю во вкладке.');
    window.open(src, '_blank', 'noopener');
  }
}

/* Просмотр картинки: ЛКМ — перемещение, колесо — масштаб к курсору, двойной клик / средняя кнопка — вписать.
   Используется и в боковой панели, и в плавающих окнах. */
class RefViewer extends Emitter {
  constructor() {
    super();
    this.img = h('img', { referrerpolicy: 'no-referrer', draggable: 'false' });
    this.zoomVal = h('span', { class: 'gpp-zoomval' });
    this.bar = h('div', { class: 'gpp-viewer-bar' });
    this.hint = h('div', { class: 'gpp-viewer-hint' });
    this.el = h('div', { class: 'gpp-viewer' }, this.img, this.bar, this.hint);
    this.z = 1; this.x = 0; this.y = 0; this.flip = false;
    this.img.addEventListener('load', () => { this.loaded = true; this.fit(); this.emit('load'); });
    this.img.addEventListener('error', () => this.fallback());
    new ResizeObserver(() => this.loaded && !this.touched && this.fit()).observe(this.el);
    this.bindInput();
  }

  tool(icon, title, fn) {
    const b = h('button', { class: 'gpp-icon-btn', title, html: icon, onclick: e => { e.stopPropagation(); fn(b); } });
    this.bar.append(b);
    return b;
  }

  load(src, title) {
    this.src = src; this.title = title || 'Референс'; this.loaded = false; this.triedGm = false; this.touched = false;
    this.img.src = src;
  }

  fallback() {
    if (this.triedGm || !/^https?:/.test(this.src)) return toast('Не удалось загрузить картинку');
    this.triedGm = true;
    gmBlob(this.src).then(b => { this.img.src = URL.createObjectURL(b); }).catch(() => toast('Не удалось загрузить картинку'));
  }

  fit() {
    if (!this.loaded) return;
    const bw = this.el.clientWidth, bh = this.el.clientHeight;
    if (!bw || !bh) return;
    this.z = Math.min(bw / this.img.naturalWidth, bh / this.img.naturalHeight);
    this.x = (bw - this.img.naturalWidth * this.z) / 2;
    this.y = (bh - this.img.naturalHeight * this.z) / 2;
    this.touched = false;
    this.apply();
  }

  zoomTo(nz, mx, my) {
    nz = clamp(nz, 0.02, 40);
    this.x = mx - ((mx - this.x) * nz) / this.z;
    this.y = my - ((my - this.y) * nz) / this.z;
    this.z = nz;
    this.touched = true;
    this.apply();
  }

  zoomBy(k) { this.zoomTo(this.z * k, this.el.clientWidth / 2, this.el.clientHeight / 2); }

  apply() {
    this.img.style.transform = `translate(${this.x}px,${this.y}px) scale(${this.z})` + (this.flip ? ` translate(${this.img.naturalWidth}px,0) scaleX(-1)` : '');
    this.zoomVal.textContent = round(this.z * 100) + '%';
  }

  toggleFlip() { this.flip = !this.flip; this.apply(); return this.flip; }
  toggleGray() { return this.el.classList.toggle('gray'); }

  bindInput() {
    const el = this.el;
    el.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      this.zoomTo(this.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    el.addEventListener('dblclick', e => { e.stopPropagation(); this.fit(); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); this.emit('back'); });
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.gpp-viewer-bar')) return;
      e.stopPropagation();
      if (e.button === 1) { e.preventDefault(); return this.fit(); }
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); return saveImage(this.src, this.title); }
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('panning');
      const sx = e.clientX - this.x, sy = e.clientY - this.y;
      const mv = ev => { this.x = ev.clientX - sx; this.y = ev.clientY - sy; this.touched = true; this.apply(); };
      const up = () => { el.classList.remove('panning'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  }
}

/* Плавающее окно с картинкой поверх игры */
class RefFrame {
  constructor(src, { title = 'Референс', state } = {}) {
    this.src = src;
    this.id = 'frame-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.op = h('input', { type: 'range', class: 'gpp-op', min: 0.1, max: 1, step: 0.05, value: state?.op ?? Settings.get('reference', 'frameOpacity'), title: 'Прозрачность окна' });
    this.pinBtn = h('button', { class: 'gpp-icon-btn', title: 'Закрепить: клики проходят сквозь картинку, можно рисовать под ней', html: ICON.pin, onclick: () => this.setPinned(!this.pinned) });
    const box = Layout.screenRect();
    this.win = new Win({
      id: this.id, title: String(title).slice(0, 40), width: state?.w || 320, height: state?.h || 260,
      x: state?.x ?? (box ? box.left + 20 : 120), y: state?.y ?? (box ? box.top + 60 : 120), resizable: true, className: 'gpp-frame gpp', buttons: [this.op, this.pinBtn],
    });
    this.viewer = new RefViewer();
    this.viewer.tool(ICON.mirror, 'Отразить по горизонтали', b => b.classList.toggle('on', this.viewer.toggleFlip()));
    this.viewer.tool(ICON.gray, 'Чёрно-белый просмотр', b => b.classList.toggle('on', this.viewer.toggleGray()));
    this.viewer.tool(ICON.target, 'Вписать (двойной клик)', () => this.viewer.fit());
    this.viewer.tool(ICON.download, 'Сохранить (Ctrl+клик)', () => saveImage(this.src, title));
    this.viewer.tool(ICON.image, 'Вернуть в боковую панель', () => { Reference.openImage(this.src, title); this.win.hide(); });
    this.viewer.bar.append(this.viewer.zoomVal);
    this.viewer.hint.textContent = 'Колесо — масштаб, ЛКМ — двигать, двойной клик — вписать';
    this.win.body.append(this.viewer.el);
    this.op.addEventListener('input', () => { this.win.el.style.opacity = this.op.value; Reference.saveFrames(); });
    this.win.el.style.opacity = this.op.value;
    this.win.on('hide', () => Reference.removeFrame(this));
    this.win.el.addEventListener('pointerup', () => Reference.saveFrames());
    this.win.show();
    this.viewer.load(src, title);
    if (state?.pinned) this.setPinned(true);
  }

  setPinned(v) {
    this.pinned = v;
    this.win.el.classList.toggle('pinned', v);
    this.pinBtn.classList.toggle('on', v);
    Reference.saveFrames();
  }

  state() {
    return { src: this.src, title: this.win.titleEl.textContent, x: this.win.pos.x, y: this.win.pos.y, w: this.win.el.offsetWidth, h: this.win.el.offsetHeight, op: +this.op.value, pinned: !!this.pinned };
  }
}

const Reference = new (class {
  init() {
    injectCss(REF_CSS, 'gpp-ref-css');
    this.frames = [];
    this.page = 1;
    this.history = Store.get('ref.history', []);
    this.width = Settings.get('reference', 'dockWidth');

    this.q = h('input', { placeholder: 'Поиск или ссылка на картинку', spellcheck: 'false' });
    this.q.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); if (e.key === 'Escape') this.q.blur(); });
    this.engine = h('select', { title: 'Где искать' }, Object.entries(REF_ENGINES).map(([k, v]) => h('option', { value: k, selected: k === Settings.get('reference', 'engine') }, v.name)));
    this.engine.addEventListener('change', () => { Settings.set('reference', 'engine', this.engine.value); if (this.q.value.trim()) this.search(true); });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    file.addEventListener('change', () => { [...file.files].forEach(f => this.openImage(URL.createObjectURL(f), f.name, false)); file.value = ''; });
    const ext = (label, where) => h('button', { class: 'gpp-icon-btn', title: `Открыть ${label} в новой вкладке`, style: { width: 'auto', padding: '0 6px', font: '11px var(--gpp-f-black)' }, onclick: () => this.openExternal(where) }, label[0]);
    this.head = h('div', { class: 'gpp-dock-head' },
      h('div', { class: 'gpp-dock-search' }, h('span', { html: ICON.search }), this.q,
        h('button', { class: 'gpp-icon-btn', title: 'История открытых картинок', html: ICON.restart, style: { width: '22px', height: '22px' }, onclick: () => this.toggleHistory() })),
      this.engine, ext('Google', 'google'), ext('Pinterest', 'pinterest'),
      h('button', { class: 'gpp-icon-btn', title: 'Открыть файл с компьютера', html: ICON.plus, onclick: () => file.click() }), file,
      h('button', { class: 'gpp-icon-btn', title: 'Закрыть панель (P)', html: ICON.close, onclick: () => this.close() }));

    this.status = h('div', { class: 'gpp-dock-status' });
    this.grid = h('div', { class: 'gpp-dock-grid gpp-scroll' });
    this.grid.addEventListener('scroll', () => { if (this.grid.scrollTop + this.grid.clientHeight > this.grid.scrollHeight - 120) this.search(false); });
    this.empty = h('div', { class: 'gpp-dock-empty', html:
      '<b>Найдите картинку</b> по запросу (лучше на английском) или вставьте ссылку.<br><br>Картинку с компьютера или из Google/Pinterest можно <b>перетащить сюда</b> или вставить <b>Ctrl+V</b>.<br><br>' +
      'В просмотре: колесо — масштаб, ЛКМ — двигать, двойной клик или средняя кнопка — вписать, <b>ПКМ — назад к результатам</b>, Ctrl+клик — сохранить.' });
    this.viewer = new RefViewer();
    this.viewer.tool(ICON.close, 'К результатам (ПКМ)', () => this.showResults());
    this.viewer.tool(ICON.min, 'Уменьшить', () => this.viewer.zoomBy(1 / 1.25));
    this.viewer.bar.append(this.viewer.zoomVal);
    this.viewer.tool(ICON.plus, 'Увеличить', () => this.viewer.zoomBy(1.25));
    this.viewer.tool(ICON.target, 'Вписать (двойной клик)', () => this.viewer.fit());
    this.viewer.tool(ICON.mirror, 'Отразить по горизонтали', b => b.classList.toggle('on', this.viewer.toggleFlip()));
    this.viewer.tool(ICON.gray, 'Чёрно-белый просмотр', b => b.classList.toggle('on', this.viewer.toggleGray()));
    this.viewer.tool(ICON.pin, 'Открепить в окно поверх игры', () => this.detach());
    this.viewer.tool(ICON.download, 'Сохранить картинку (Ctrl+клик)', () => saveImage(this.viewer.src, this.viewer.title));
    this.viewer.hint.textContent = 'ПКМ — назад · колесо — масштаб · двойной клик — вписать';
    this.viewer.on('back', () => this.showResults());
    this.viewer.el.style.display = 'none';
    this.body = h('div', { class: 'gpp-dock-body' }, this.status, this.grid, this.viewer.el);
    this.resizer = h('div', { class: 'gpp-dock-resize', title: 'Тяните, чтобы изменить ширину. Двойной клик — минимум/максимум' });
    this.el = h('div', { class: 'gpp gpp-dock hidden' }, this.head, this.body, this.resizer);
    for (const t of ['pointerdown', 'mousedown', 'click', 'keydown', 'contextmenu']) this.el.addEventListener(t, e => e.stopPropagation());
    document.body.append(this.el);
    this.grid.append(this.empty);
    this.bindResize();
    this.bindDrop();
    document.addEventListener('paste', e => this.onPaste(e));
    Layout.on('change', () => this.place());
    window.addEventListener('resize', () => this.place());
    for (const s of Store.get('ref.frames', [])) if (/^https?:/.test(s.src)) this.frames.push(new RefFrame(s.src, { title: s.title, state: s }));
    if (Store.get('ref.open', false)) setTimeout(() => this.open(), 300);
  }

  /* ───── Панель ───── */

  isOpen() { return !!this.el && !this.el.classList.contains('hidden'); }
  open() {
    this.el.classList.remove('hidden');
    Store.set('ref.open', true);
    Layout.setDock(this.width + 14);
    this.place();
    Painter.ui?.refresh();
    if (!this.viewer.loaded && !this.grid.querySelector('img')) this.q.focus({ preventScroll: true });
  }
  close() {
    this.el.classList.add('hidden');
    Store.set('ref.open', false);
    Layout.setDock(0);
    this.historyEl?.remove();
    Painter.ui?.refresh();
  }
  toggle() { this.isOpen() ? this.close() : this.open(); }

  place() {
    if (!this.isOpen()) return;
    const r = Layout.screenRect();
    const top = r ? Math.max(4, r.top) : 8, height = r ? Math.min(r.height, innerHeight - top - 4) : innerHeight - 16;
    const left = r ? Math.max(4, r.left - this.width - 10) : 8;
    Object.assign(this.el.style, { left: left + 'px', top: top + 'px', width: this.width + 'px', height: height + 'px' });
    this.grid.style.columnCount = Math.max(1, Math.round(this.width / 130));
  }

  setWidth(w) {
    this.width = clamp(round(w), 220, Math.max(240, innerWidth * 0.6));
    Settings.set('reference', 'dockWidth', this.width);
    Layout.setDock(this.width + 14);
    this.place();
  }

  bindResize() {
    this.resizer.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.resizer.setPointerCapture(e.pointerId);
      const sx = e.clientX, sw = this.width;
      const mv = ev => { this.width = clamp(sw + ev.clientX - sx, 220, innerWidth * 0.6); Layout.setDock(this.width + 14); this.place(); };
      const up = () => { this.resizer.removeEventListener('pointermove', mv); this.resizer.removeEventListener('pointerup', up); this.setWidth(this.width); };
      this.resizer.addEventListener('pointermove', mv); this.resizer.addEventListener('pointerup', up);
    });
    this.resizer.addEventListener('dblclick', e => { e.stopPropagation(); this.setWidth(this.width < innerWidth * 0.4 ? innerWidth * 0.6 : 240); });
  }

  /* ───── Поиск ───── */

  submit() {
    const v = this.q.value.trim();
    if (!v) return;
    if (/^(https?:\/\/|data:image\/)\S+$/i.test(v)) { this.q.value = ''; return this.openImage(v, 'По ссылке'); }
    this.search(true);
  }

  openExternal(where) {
    const q = encodeURIComponent(this.q.value.trim() || 'drawing reference');
    window.open(where === 'google' ? `https://www.google.com/search?udm=2&q=${q}` : `https://www.pinterest.com/search/pins/?q=${q}`, '_blank', 'noopener');
  }

  async search(fresh) {
    const q = fresh ? this.q.value.trim() : this.lastQuery;
    if (!q || this.loading || (!fresh && !this.more)) return;
    if (fresh) { this.page = 1; this.grid.replaceChildren(); this.grid.scrollTop = 0; this.lastQuery = q; }
    this.showResults();
    this.empty.remove();
    this.loading = true;
    this.status.textContent = 'Ищу…';
    const eng = REF_ENGINES[this.engine.value] || REF_ENGINES.commons;
    try {
      const { items, more } = await eng.search(q, this.page);
      this.more = more; this.page++;
      for (const it of items) {
        this.grid.append(h('img', {
          src: it.thumb, loading: 'lazy', referrerpolicy: 'no-referrer', title: `${it.w}×${it.h} · Shift+клик — сразу в окно поверх игры`,
          onclick: e => (e.shiftKey ? this.detachSrc(it.full, q) : this.openImage(it.full, q, true, it.thumb)),
        }));
      }
      const n = this.grid.querySelectorAll('img').length;
      this.status.textContent = n ? `${eng.name}: ${n}${more ? '+' : ''} картинок по запросу «${q}»` : 'Ничего не найдено. Попробуйте запрос на английском или другой источник.';
    } catch (e) {
      this.status.textContent = `${eng.name}: ${e.message}. Попробуйте другой источник.`;
    } finally { this.loading = false; }
  }

  showResults() {
    this.viewer.el.style.display = 'none';
    this.status.style.display = this.grid.style.display = '';
    if (!this.grid.children.length) this.grid.append(this.empty);
  }

  /* ───── Просмотр ───── */

  openImage(src, title = 'Референс', remember = true, thumb) {
    if (!this.isOpen()) this.open();
    this.historyEl?.remove();
    this.status.style.display = this.grid.style.display = 'none';
    this.viewer.el.style.display = '';
    this.viewer.load(src, title);
    if (remember && /^https?:/.test(src)) {
      this.history = [{ src, title, thumb: thumb || src }, ...this.history.filter(x => x.src !== src)].slice(0, 40);
      Store.set('ref.history', this.history);
    }
  }

  toggleHistory() {
    if (this.historyEl?.isConnected) return this.historyEl.remove();
    this.historyEl = h('div', { class: 'gpp-history gpp-scroll' },
      this.history.length ? this.history.map(it => h('img', { src: it.thumb, title: it.title, referrerpolicy: 'no-referrer', onclick: () => this.openImage(it.src, it.title, true, it.thumb) }))
        : h('div', { class: 'gpp-note', style: { gridColumn: '1/-1' } }, 'История пуста'));
    this.body.append(this.historyEl);
  }

  detach() { if (this.viewer.src) { this.detachSrc(this.viewer.src, this.viewer.title); this.showResults(); } }
  detachSrc(src, title) {
    const f = new RefFrame(src, { title });
    f.persist = /^https?:/.test(src);
    this.frames.push(f);
    this.saveFrames();
  }

  bindDrop() {
    const el = this.el;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      if (files.length) return this.openImage(URL.createObjectURL(files[0]), files[0].name, false);
      const html = e.dataTransfer.getData('text/html');
      const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1] || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (src && /^(https?:|data:image)/.test(src.trim())) this.openImage(src.trim().replace(/&amp;/g, '&'), 'Перетащено');
    });
  }

  onPaste(e) {
    if (isTyping(e) || !(this.isOpen() || Painter.active)) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); this.openImage(URL.createObjectURL(item.getAsFile()), 'Из буфера', false); return; }
    const text = e.clipboardData?.getData('text')?.trim();
    if (text && /^https?:\/\/\S+$/i.test(text)) { e.preventDefault(); this.openImage(text, 'По ссылке'); }
  }

  removeFrame(f) {
    this.frames = this.frames.filter(x => x !== f);
    f.win.el.remove();
    this.saveFrames();
  }

  saveFrames() {
    Store.set('ref.frames', this.frames.filter(f => f.persist !== false && /^https?:/.test(f.src)).map(f => f.state()));
  }
})();
