/* ───────────────────────────── Референсы ─────────────────────────────
   Поиск идёт через открытые API (Wikimedia Commons, Openverse). Google и Pinterest открываются
   в новой вкладке: картинку оттуда можно перетащить, вставить (Ctrl+V) или добавить по ссылке.   */

const REF_CSS = `
.gpp-ref .gpp-win-body{display:flex;flex-direction:column;gap:8px;padding:10px}
.gpp-ref-bar{display:flex;gap:6px}
.gpp-ref-bar .gpp-input{flex:1;min-width:0}
.gpp-ref-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:start;min-height:120px}
.gpp-ref-grid img{width:100%;height:96px;object-fit:cover;border-radius:8px;cursor:pointer;background:var(--gpp-bg2);display:block}
.gpp-ref-grid img:hover{outline:2px solid var(--gpp-accent)}
.gpp-ref-drop{border:2px dashed var(--gpp-line);border-radius:10px;padding:10px;text-align:center;color:var(--gpp-dim);font-size:12px}
.gpp-ref.dragover .gpp-ref-drop{border-color:var(--gpp-accent);color:var(--gpp-text)}
.gpp-frame .gpp-win-body{padding:0;overflow:hidden;position:relative;cursor:grab;background:repeating-conic-gradient(#ffffff10 0 25%,transparent 0 50%) 0 0/16px 16px}
.gpp-frame img{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;max-width:none}
.gpp-frame .gpp-win-head{padding:5px 6px 5px 10px}
.gpp-frame .gpp-op{width:70px;accent-color:var(--gpp-accent)}
.gpp-frame.pinned{pointer-events:none}
.gpp-frame.pinned .gpp-win-head{pointer-events:auto}
.gpp-frame.pinned .gpp-win-body{cursor:default}
`;

const REF_ENGINES = {
  commons: {
    name: 'Wikimedia Commons',
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

class RefFrame {
  constructor(src, { title = 'Референс', state } = {}) {
    this.src = src;
    this.id = 'frame-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.op = h('input', { type: 'range', class: 'gpp-op', min: 0.1, max: 1, step: 0.05, value: state?.op ?? Settings.get('reference', 'frameOpacity'), title: 'Прозрачность' });
    this.pinBtn = h('button', { class: 'gpp-icon-btn', title: 'Закрепить: клики проходят сквозь картинку', html: ICON.pin, onclick: () => this.setPinned(!this.pinned) });
    this.win = new Win({ id: this.id, title, width: state?.w || 300, height: state?.h || 240, x: state?.x ?? 120 + Math.random() * 80, y: state?.y ?? 120 + Math.random() * 60, resizable: true, className: 'gpp-frame', buttons: [this.op, this.pinBtn] });
    this.img = h('img', { referrerpolicy: 'no-referrer', draggable: 'false' });
    this.win.body.append(this.img);
    this.z = 1; this.x = 0; this.y = 0;
    this.op.addEventListener('input', () => { this.win.el.style.opacity = this.op.value; Reference.saveFrames(); });
    this.win.el.style.opacity = this.op.value;
    this.img.addEventListener('load', () => this.fit());
    this.img.addEventListener('error', () => this.fallback());
    this.img.src = src;
    this.win.on('hide', () => Reference.removeFrame(this));
    new ResizeObserver(() => this.loaded && this.apply()).observe(this.win.body);
    this.bindPanZoom();
    this.win.show();
    if (state?.pinned) this.setPinned(true);
    this.win.el.addEventListener('pointerup', () => Reference.saveFrames());
  }

  fallback() {
    if (this.triedGm || !/^https?:/.test(this.src)) return toast('Не удалось загрузить картинку');
    this.triedGm = true;
    GM_xmlhttpRequest({
      url: this.src, method: 'GET', responseType: 'blob', anonymous: true, timeout: 20000,
      onload: r => { if (r.status === 200 && r.response) this.img.src = URL.createObjectURL(r.response); else toast('Не удалось загрузить картинку'); },
      onerror: () => toast('Не удалось загрузить картинку'),
    });
  }

  fit() {
    this.loaded = true;
    const bw = this.win.body.clientWidth, bh = this.win.body.clientHeight;
    this.z = Math.min(bw / this.img.naturalWidth, bh / this.img.naturalHeight);
    this.x = (bw - this.img.naturalWidth * this.z) / 2;
    this.y = (bh - this.img.naturalHeight * this.z) / 2;
    this.apply();
  }

  apply() { this.img.style.transform = `translate(${this.x}px,${this.y}px) scale(${this.z})`; }

  bindPanZoom() {
    const b = this.win.body;
    b.addEventListener('wheel', e => {
      e.preventDefault();
      const r = b.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const nz = clamp(this.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.02, 40);
      this.x = mx - ((mx - this.x) * nz) / this.z;
      this.y = my - ((my - this.y) * nz) / this.z;
      this.z = nz;
      this.apply();
    }, { passive: false });
    b.addEventListener('dblclick', () => this.fit());
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      const sx = e.clientX - this.x, sy = e.clientY - this.y;
      const mv = ev => { this.x = ev.clientX - sx; this.y = ev.clientY - sy; this.apply(); };
      const up = () => { b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); };
      b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up);
    });
  }

  setPinned(v) {
    this.pinned = v;
    this.win.el.classList.toggle('pinned', v);
    this.pinBtn.classList.toggle('on', v);
    Reference.saveFrames();
  }

  state() {
    return { src: this.src, x: this.win.pos.x, y: this.win.pos.y, w: this.win.el.offsetWidth, h: this.win.el.offsetHeight, op: +this.op.value, pinned: !!this.pinned };
  }
}

const Reference = new (class {
  init() {
    injectCss(REF_CSS, 'gpp-ref-css');
    this.frames = [];
    this.page = 1;
    this.win = new Win({ id: 'reference', title: '<b>GP+</b> Референсы', width: 360, height: 460, x: window.innerWidth - 400, y: 80, resizable: true, className: 'gpp-ref' });
    const b = this.win.body;
    this.q = h('input', { class: 'gpp-input', placeholder: 'Что ищем? Например: cat, лошадь, Eiffel tower' });
    this.q.addEventListener('keydown', e => { if (e.key === 'Enter') this.search(true); });
    this.engine = UI.select(Settings.get('reference', 'engine') in REF_ENGINES ? Settings.get('reference', 'engine') : 'commons',
      Object.entries(REF_ENGINES).map(([k, v]) => [k, v.name]), v => { Settings.set('reference', 'engine', v); this.search(true); });
    this.grid = h('div', { class: 'gpp-ref-grid' });
    this.grid.addEventListener('scroll', () => { if (this.grid.scrollTop + this.grid.clientHeight > this.grid.scrollHeight - 80) this.search(false); });
    this.status = h('div', { class: 'gpp-note', style: { margin: 0 } });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    file.addEventListener('change', () => { [...file.files].forEach(f => this.open(URL.createObjectURL(f), f.name, false)); file.value = ''; });
    const url = h('input', { class: 'gpp-input', placeholder: 'Ссылка на картинку' });
    url.addEventListener('keydown', e => { if (e.key === 'Enter' && url.value.trim()) { this.open(url.value.trim()); url.value = ''; } });
    b.append(
      h('div', { class: 'gpp-ref-bar' }, this.q, h('button', { class: 'gpp-btn primary', html: ICON.search, title: 'Искать', onclick: () => this.search(true) })),
      h('div', { class: 'gpp-ref-bar' }, this.engine,
        h('button', { class: 'gpp-btn', title: 'Открыть Google Картинки в новой вкладке', onclick: () => this.openExternal('google') }, 'Google ↗'),
        h('button', { class: 'gpp-btn', title: 'Открыть Pinterest в новой вкладке', onclick: () => this.openExternal('pinterest') }, 'Pinterest ↗')),
      this.status, this.grid,
      h('div', { class: 'gpp-ref-drop' }, 'Перетащите картинку сюда, вставьте Ctrl+V или ',
        h('a', { href: '#', style: { color: 'var(--gpp-accent)' }, onclick: e => { e.preventDefault(); file.click(); } }, 'выберите файл'), file),
      url,
    );
    this.bindDrop();
    document.addEventListener('paste', e => this.onPaste(e));
    for (const s of Store.get('ref.frames', [])) if (/^https?:/.test(s.src)) this.frames.push(new RefFrame(s.src, { state: s }));
  }

  openExternal(where) {
    const q = encodeURIComponent(this.q.value.trim() || 'drawing reference');
    window.open(where === 'google' ? `https://www.google.com/search?udm=2&q=${q}` : `https://www.pinterest.com/search/pins/?q=${q}`, '_blank', 'noopener');
  }

  async search(fresh) {
    const q = this.q.value.trim();
    if (!q || this.loading || (!fresh && !this.more)) return;
    if (fresh) { this.page = 1; this.grid.replaceChildren(); this.grid.scrollTop = 0; }
    this.loading = true;
    this.status.textContent = 'Ищу…';
    const eng = REF_ENGINES[this.engine.value];
    try {
      const { items, more } = await eng.search(q, this.page);
      this.more = more; this.page++;
      for (const it of items) {
        const img = h('img', { src: it.thumb, loading: 'lazy', referrerpolicy: 'no-referrer', title: `${it.w}×${it.h}`, onclick: () => this.open(it.full, q) });
        this.grid.append(img);
      }
      this.status.textContent = this.grid.children.length ? `Найдено: ${this.grid.children.length}${more ? '+' : ''}. Клик — открыть поверх игры.` : 'Ничего не найдено. Попробуйте запрос на английском.';
    } catch (e) {
      this.status.textContent = `${eng.name}: ${e.message}. Попробуйте другой источник.`;
    } finally { this.loading = false; }
  }

  bindDrop() {
    const el = this.win.el;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      if (files.length) return files.forEach(f => this.open(URL.createObjectURL(f), f.name, false));
      const html = e.dataTransfer.getData('text/html');
      const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1] || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (src && /^(https?:|data:image)/.test(src.trim())) this.open(src.trim().replace(/&amp;/g, '&'));
    });
  }

  onPaste(e) {
    if (isTyping(e) || !(this.win.visible || Painter.active)) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); this.open(URL.createObjectURL(item.getAsFile()), 'Из буфера', false); return; }
    const text = e.clipboardData?.getData('text');
    if (text && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(text.trim())) { e.preventDefault(); this.open(text.trim()); }
  }

  open(src, title = 'Референс', persist = true) {
    const f = new RefFrame(src, { title: String(title).slice(0, 40) });
    f.persist = persist && /^https?:/.test(src);
    this.frames.push(f);
    this.saveFrames();
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
