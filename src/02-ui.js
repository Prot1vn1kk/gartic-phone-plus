/* ───────────────────────────── Стили ───────────────────────────── */

const CSS = `
:root{--gpp-accent:#5bffb6;--gpp-book:rgb(48 26 107/var(--gpp-op,1));--gpp-head:rgb(83,34,160);--gpp-head-hi:rgb(104,61,209);--gpp-edge:rgb(23,5,87);
--gpp-field:rgb(36,18,84);--gpp-text:#fff;--gpp-dim:rgba(232,222,255,.72);--gpp-line:rgba(160,130,240,.35);
--gpp-panel-bg:rgba(94,24,51,.6);--gpp-panel-border:rgba(255,110,153,.3);--gpp-panel-shadow:rgba(94,24,51,.6);--gpp-tool-ring:rgb(103,22,52);
--gpp-f-black:Black,"Arial Black",system-ui,sans-serif;--gpp-f-bold:Bold,system-ui,"Segoe UI",Arial,sans-serif;--gpp-f-reg:Regular,system-ui,"Segoe UI",Arial,sans-serif}
.gpp,.gpp *{box-sizing:border-box}
.gpp{color:var(--gpp-text);font:13px/1.35 var(--gpp-f-bold)}
.gpp :where(button){font:inherit;color:inherit}
.gpp-win{position:fixed;z-index:2147483000;background:var(--gpp-book);border:1.6px solid var(--gpp-edge);border-radius:14px;
box-shadow:inset 0 0 0 2px var(--gpp-head),0 6px 0 rgba(0,0,0,.25),0 16px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;min-width:220px;max-height:calc(100vh - 16px)}
.gpp-win.hidden{display:none}
.gpp-win-head{display:flex;align-items:center;gap:6px;padding:7px 8px 7px 14px;cursor:grab;user-select:none;background:var(--gpp-head);
border-radius:12px 12px 0 0;box-shadow:inset 0 0 0 2px var(--gpp-head-hi)}
.gpp-win-head:active{cursor:grabbing}
.gpp-win-title{font:15px/1.2 var(--gpp-f-black);text-transform:uppercase;letter-spacing:.3px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gpp-win-title b{color:var(--gpp-accent);font-weight:400}
.gpp-icon-btn{width:28px;height:28px;border-radius:8px;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;color:#fff;flex:none;opacity:.85}
.gpp-icon-btn:hover{background:rgba(255,255,255,.14);opacity:1}
.gpp-icon-btn.on{background:var(--gpp-accent);color:var(--gpp-edge);opacity:1}
.gpp-icon-btn svg{width:17px;height:17px}
.gpp-win-body{padding:12px 14px;overflow:auto;flex:1}
.gpp-win-body::-webkit-scrollbar,.gpp-scroll::-webkit-scrollbar{width:8px}
.gpp-win-body::-webkit-scrollbar-thumb,.gpp-scroll::-webkit-scrollbar-thumb{background:var(--gpp-head-hi);border-radius:8px}
.gpp-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
.gpp-tabs{display:flex;gap:6px;padding:10px 12px 0;overflow-x:auto}
.gpp-tab{border:0;background:var(--gpp-field);padding:9px 14px;border-radius:9px 9px 0 0;cursor:pointer;color:var(--gpp-dim);font:13px/1 var(--gpp-f-black);text-transform:uppercase;white-space:nowrap}
.gpp-tab:hover{color:#fff}.gpp-tab.on{color:var(--gpp-accent);background:var(--gpp-head);box-shadow:inset 0 2px 0 var(--gpp-head-hi)}
.gpp-sec{font:12px/1 var(--gpp-f-black);text-transform:uppercase;letter-spacing:.6px;color:var(--gpp-accent);margin:16px 0 6px}
.gpp-sec:first-child{margin-top:0}
.gpp-row{display:flex;align-items:center;gap:10px;padding:6px 0;min-height:34px;border-bottom:1px solid rgba(255,255,255,.06)}
.gpp-row .gpp-label{flex:1;min-width:0}
.gpp-row .gpp-label small{display:block;color:var(--gpp-dim);font:11.5px/1.3 var(--gpp-f-reg);margin-top:2px}
.gpp-switch{position:relative;width:42px;height:24px;border-radius:24px;background:var(--gpp-field);box-shadow:inset 0 0 0 2px var(--gpp-head-hi);border:0;cursor:pointer;flex:none;transition:background .15s}
.gpp-switch::after{content:"";position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:#cbbcf2;transition:transform .15s,background .15s}
.gpp-switch.on{background:var(--gpp-accent);box-shadow:none}.gpp-switch.on::after{transform:translateX(18px);background:var(--gpp-edge)}
.gpp-slider{display:flex;align-items:center;gap:8px;width:170px;flex:none}
.gpp-slider input{flex:1;accent-color:var(--gpp-accent);min-width:0}
.gpp-slider output{width:44px;text-align:right;color:var(--gpp-dim);font-variant-numeric:tabular-nums}
.gpp-select,.gpp-input{background:var(--gpp-field);border:1.6px solid var(--gpp-head-hi);color:#fff;border-radius:8px;padding:6px 8px;font:13px var(--gpp-f-bold);outline:none}
.gpp-select:focus,.gpp-input:focus{border-color:var(--gpp-accent)}
.gpp-select option{background:var(--gpp-field)}
.gpp-colorin{width:40px;height:28px;border:1.6px solid #fff;border-radius:7px;padding:0;background:none;cursor:pointer;box-shadow:0 0 0 2px var(--gpp-edge)}
.gpp-btn{border:0;background:linear-gradient(#f6f0ff,#ddd0f5);color:var(--gpp-edge);border-radius:8px;padding:8px 14px;cursor:pointer;
font:13px/1 var(--gpp-f-black);text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;box-shadow:inset 0 0 0 2px #fff,0 4px 0 #9687bf;margin-bottom:4px}
.gpp-btn:hover{filter:brightness(1.05)}.gpp-btn:active{transform:translateY(2px);box-shadow:inset 0 0 0 2px #fff,0 2px 0 #9687bf}
.gpp-btn svg{width:16px;height:16px;flex:none}
.gpp-btn.primary{background:linear-gradient(#8dffd0,#3ee6a0);box-shadow:inset 0 0 0 2px #c8ffe8,0 4px 0 #1f9e6c}
.gpp-btn.danger{background:linear-gradient(#ffb3c8,#ff7aa0);box-shadow:inset 0 0 0 2px #ffd6e2,0 4px 0 #b4235a}
.gpp-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.gpp-key{display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.gpp-kbd{border:1.6px solid var(--gpp-head-hi);background:var(--gpp-field);border-radius:7px;padding:3px 8px;font:12px var(--gpp-f-bold);cursor:pointer;min-width:30px;text-align:center}
.gpp-kbd:hover{border-color:var(--gpp-accent)}.gpp-kbd.rec{border-color:var(--gpp-accent);background:var(--gpp-accent);color:var(--gpp-edge)}
.gpp-kbd.empty{color:var(--gpp-dim)}
.gpp-note{color:var(--gpp-dim);font:12px/1.4 var(--gpp-f-reg);margin:6px 0}
.gpp-toasts{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.gpp-toast{background:var(--gpp-head);border:1.6px solid var(--gpp-edge);box-shadow:inset 0 0 0 2px var(--gpp-head-hi),0 4px 0 rgba(0,0,0,.25);border-radius:10px;padding:9px 16px;animation:gpp-in .18s ease-out}
@keyframes gpp-in{from{opacity:0;transform:translateY(-6px)}}
.gpp-entry{position:absolute;z-index:20;height:28px;padding:0 10px 0 6px;border:0;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:5px;
background:linear-gradient(#8dffd0,#3ee6a0);color:var(--gpp-edge);font:13px/1 var(--gpp-f-black);box-shadow:inset 0 0 0 2px #c8ffe8,0 3px 0 #1f9e6c}
.gpp-entry:hover{filter:brightness(1.06)}
.gpp-entry svg{width:16px;height:16px}
.gpp-entry.floating{position:fixed;right:14px;bottom:14px;z-index:2147483100}
.gpp-overlay{position:absolute;inset:0;z-index:200;background:rgba(23,5,87,.55);display:flex;align-items:center;justify-content:center}
.gpp-overlay.fixed{position:fixed;z-index:2147483300}
.gpp-dialog{position:relative;background:var(--gpp-book);border:1.6px solid var(--gpp-edge);border-radius:14px;box-shadow:inset 0 0 0 2px var(--gpp-head),0 6px 0 rgba(0,0,0,.25);
display:flex;flex-direction:column;max-width:calc(100% - 40px);max-height:calc(100% - 40px)}
.gpp-dialog-head{position:relative;background:var(--gpp-head);border-radius:12px 12px 0 0;box-shadow:inset 0 0 0 2px var(--gpp-head-hi);padding:12px 48px;text-align:center;
font:20px/1.1 var(--gpp-f-black);text-transform:uppercase;letter-spacing:.4px}
.gpp-dialog-head .gpp-icon-btn{position:absolute;right:10px;top:50%;transform:translateY(-50%)}
.gpp-dialog-body{overflow:auto;flex:1;padding:14px 18px}
.gpp-confirm{padding:16px 22px;min-width:320px;text-align:center}
.gpp-confirm .gpp-btns{justify-content:center}
`;

function injectCss(text, id) {
  const st = h('style', { id }, text);
  (document.head || document.documentElement).append(st);
  return st;
}

function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--gpp-accent', Settings.get('ui', 'accent'));
  r.setProperty('--gpp-op', Settings.get('ui', 'panelOpacity'));
}

/* ───────────────────────────── Иконки ───────────────────────────── */

const ICON = {
  close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  min: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h8"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>',
  restart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2v3h3"/></svg>',
  download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10"/></svg>',
  video: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="4" width="9" height="8" rx="1.5"/><path d="M10.5 7l4-2.5v7l-4-2.5"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>',
  image: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2.5" width="12" height="11" rx="2"/><circle cx="6" cy="6.5" r="1.3"/><path d="M2.5 12l3.5-3.5 3 3 2-2 2.5 2.5"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/></svg>',
  pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 2h4l-.5 4 2.5 2.5H4L6.5 6zM8 8.5V14"/></svg>',
  palette: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2a6 6 0 1 0 0 12c1 0 1.3-.8.9-1.5-.5-.8 0-1.8 1-1.8H12a2.5 2.5 0 0 0 2-2.5C14 4.6 11.3 2 8 2z"/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="8" cy="5" r=".9" fill="currentColor"/><circle cx="11" cy="7" r=".9" fill="currentColor"/></svg>',
  gear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
  symV: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v19" stroke-dasharray="3 3"/><path d="M9 8 4.5 12 9 16M15 8l4.5 4L15 16"/></svg>',
  symH: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2.5 12h19" stroke-dasharray="3 3"/><path d="M8 9l4-4.5L16 9M8 15l4 4.5 4-4.5"/></svg>',
  symQ: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v19M2.5 12h19" stroke-dasharray="3 3"/><circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/><circle cx="17.5" cy="6.5" r="1.8" fill="currentColor"/><circle cx="6.5" cy="17.5" r="1.8" fill="currentColor"/><circle cx="17.5" cy="17.5" r="1.8" fill="currentColor"/></svg>',
  symR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 12V3M12 12l7.8 4.5M12 12l-7.8 4.5"/></svg>',
  symM: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke-width="1.5"/></svg>',
  mirror: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3v18" stroke-dasharray="2.5 2.5"/><path d="M9.5 6 3 18h6.5zM14.5 6 21 18h-6.5z"/></svg>',
  mirrorY: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 12h18" stroke-dasharray="2.5 2.5"/><path d="M6 9.5 18 3v6.5zM6 14.5 18 21v-6.5z"/></svg>',
  gray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>',
  rays: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 12 12 3M12 12l8 4M12 12l-8 4"/></svg>',
};

/* ───────────────────────────── Окна ───────────────────────────── */

const Layer = {
  root: null,
  z: 2147483000,
  init() {
    this.root = h('div', { class: 'gpp', id: 'gpp-root' });
    document.body.append(this.root);
    this.toasts = h('div', { class: 'gpp-toasts gpp' });
    document.body.append(this.toasts);
  },
};

function toast(text, ms = 2200) {
  const t = h('div', { class: 'gpp-toast' }, text);
  Layer.toasts.append(t);
  setTimeout(() => t.remove(), ms);
}

/* Окно в стиле диалогов Gartic. Встраивается внутрь .screen игры, поэтому масштабируется вместе с ней. */
class GameModal extends Emitter {
  constructor({ title, width = 640, height, className = '' }) {
    super();
    this.overlay = h('div', { class: 'gpp gpp-overlay' });
    this.titleEl = h('span', { html: title });
    this.head = h('div', { class: 'gpp-dialog-head' }, this.titleEl,
      h('button', { class: 'gpp-icon-btn', title: 'Закрыть (Esc)', html: ICON.close, onclick: () => this.close() }));
    this.body = h('div', { class: 'gpp-dialog-body gpp-scroll' });
    this.dialog = h('div', { class: 'gpp-dialog ' + className, style: { width: width + 'px', height: height ? height + 'px' : null } }, this.head, this.body);
    this.overlay.append(this.dialog);
    this.overlay.addEventListener('pointerdown', e => { if (e.target === this.overlay) this.close(); });
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'contextmenu']) this.dialog.addEventListener(t, e => e.stopPropagation());
    this.onKey = e => { if (e.key === 'Escape' && this.isOpen && !Hotkeys.recording) { e.stopPropagation(); this.close(); } };
  }
  get isOpen() { return this.overlay.isConnected; }
  open() {
    const host = document.querySelector('.screen');
    this.overlay.classList.toggle('fixed', !host);
    (host || document.body).append(this.overlay);
    window.addEventListener('keydown', this.onKey, true);
    this.emit('open');
  }
  close() {
    if (!this.isOpen) return;
    this.overlay.remove();
    window.removeEventListener('keydown', this.onKey, true);
    this.emit('close');
  }
  toggle() { this.isOpen ? this.close() : this.open(); }
  setTitle(t) { this.titleEl.innerHTML = t; }
}

function confirmDialog(title, text, okText = 'Да', cancelText = 'Отмена') {
  return new Promise(resolve => {
    const m = new GameModal({ title, width: 380, className: 'gpp-confirm-dlg' });
    let result = false;
    m.on('close', () => resolve(result));
    m.body.classList.add('gpp-confirm');
    m.body.append(h('div', { class: 'gpp-note', style: { fontSize: '14px', color: '#fff' } }, text),
      h('div', { class: 'gpp-btns' },
        h('button', { class: 'gpp-btn', onclick: () => m.close() }, cancelText),
        h('button', { class: 'gpp-btn primary', onclick: () => { result = true; m.close(); } }, okText)));
    m.open();
  });
}

class Win extends Emitter {
  constructor({ id, title, width = 320, height, x, y, resizable = false, buttons = [], className = '' }) {
    super();
    this.id = id;
    const saved = Store.get('win.' + id, {});
    this.el = h('div', { class: 'gpp-win hidden ' + className });
    this.titleEl = h('div', { class: 'gpp-win-title', html: title });
    this.head = h('div', { class: 'gpp-win-head' }, this.titleEl, ...buttons,
      h('button', { class: 'gpp-icon-btn', title: 'Закрыть', html: ICON.close, onclick: () => this.hide() }));
    this.body = h('div', { class: 'gpp-win-body' });
    this.el.append(this.head, this.body);
    this.el.style.width = (saved.w || width) + 'px';
    if (saved.h || height) this.el.style.height = (saved.h || height) + 'px';
    this.pos = { x: saved.x ?? x ?? 80, y: saved.y ?? y ?? 80 };
    if (resizable) {
      const rz = h('div', { class: 'gpp-resize' });
      this.el.append(rz);
      this.dragger(rz, (dx, dy, s) => {
        this.el.style.width = Math.max(220, s.w + dx) + 'px';
        this.el.style.height = Math.max(140, s.h + dy) + 'px';
      }, () => ({ w: this.el.offsetWidth, h: this.el.offsetHeight }), () => this.save());
    }
    this.dragger(this.head, (dx, dy, s) => this.move(s.x + dx, s.y + dy), () => ({ ...this.pos }), () => this.save());
    this.el.addEventListener('pointerdown', () => this.front(), true);
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'wheel', 'keydown', 'contextmenu']) this.el.addEventListener(t, e => e.stopPropagation());
    Layer.root.append(this.el);
    window.addEventListener('resize', () => this.visible && this.move(this.pos.x, this.pos.y));
  }

  dragger(handle, onMove, getStart, onEnd) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button,input,select')) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, start = getStart();
      handle.setPointerCapture(e.pointerId);
      const mv = ev => onMove(ev.clientX - sx, ev.clientY - sy, start);
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); onEnd?.(); };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
    });
  }

  move(x, y) {
    const w = this.el.offsetWidth || 300, hh = this.el.offsetHeight || 100;
    this.pos.x = clamp(x, 4 - w + 60, window.innerWidth - 60);
    this.pos.y = clamp(y, 4, window.innerHeight - 40);
    this.el.style.left = this.pos.x + 'px';
    this.el.style.top = this.pos.y + 'px';
    void hh;
  }

  save() { Store.set('win.' + this.id, { x: this.pos.x, y: this.pos.y, w: this.el.offsetWidth, h: this.el.style.height ? this.el.offsetHeight : undefined }); }
  front() { this.el.style.zIndex = ++Layer.z; }
  get visible() { return !this.el.classList.contains('hidden'); }
  show() { this.el.classList.remove('hidden'); this.move(this.pos.x, this.pos.y); this.front(); this.emit('show'); }
  hide() { if (!this.visible) return; this.el.classList.add('hidden'); this.emit('hide'); }
  toggle() { this.visible ? this.hide() : this.show(); }
  setTitle(t) { this.titleEl.innerHTML = t; }
}

/* ───────────────────────────── Элементы настроек ───────────────────────────── */

const UI = {
  sec: text => h('div', { class: 'gpp-sec' }, text),
  row(label, hint, control) {
    return h('div', { class: 'gpp-row' }, h('div', { class: 'gpp-label' }, label, hint ? h('small', {}, hint) : null), control);
  },
  switch(value, onChange) {
    const b = h('button', { class: 'gpp-switch' + (value ? ' on' : ''), role: 'switch' });
    b.addEventListener('click', () => { b.classList.toggle('on'); onChange(b.classList.contains('on')); });
    b.set = v => b.classList.toggle('on', !!v);
    return b;
  },
  slider(value, { min, max, step = 1, fmt = v => v }, onChange) {
    const out = h('output', {}, fmt(value));
    const inp = h('input', { type: 'range', min, max, step, value });
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onChange(+inp.value); });
    const wrap = h('div', { class: 'gpp-slider' }, inp, out);
    wrap.set = v => { inp.value = v; out.textContent = fmt(v); };
    return wrap;
  },
  select(value, items, onChange) {
    const s = h('select', { class: 'gpp-select' }, items.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t)));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  },
  color(value, onChange) {
    const c = h('input', { type: 'color', class: 'gpp-colorin', value });
    c.addEventListener('input', () => onChange(c.value));
    return c;
  },
  /* Привязка элемента к настройке: UI.bind('painter','smoothing','switch'|'slider'|..., opts) */
  bind(mod, key, kind, opts = {}) {
    const v = Settings.get(mod, key);
    const set = val => Settings.set(mod, key, val);
    if (kind === 'switch') return UI.switch(v, set);
    if (kind === 'slider') return UI.slider(v, opts, set);
    if (kind === 'select') return UI.select(v, opts.items, set);
    if (kind === 'color') return UI.color(v, set);
  },
};

/* ───────────────────────────── Горячие клавиши ───────────────────────────── */

const KEY_NAMES = {
  Space: 'Пробел', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Shift', AltLeft: 'Alt', AltRight: 'Alt',
  CapsLock: 'Caps', Tab: 'Tab', Equal: '=', Minus: '−', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/',
  Backquote: '`', Semicolon: ';', Quote: "'", Backslash: '\\', Escape: 'Esc', Enter: 'Enter', Backspace: '⌫', Delete: 'Del',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
const MOD_CODES = { ControlLeft: 'Ctrl', ControlRight: 'Ctrl', ShiftLeft: 'Shift', ShiftRight: 'Shift', AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta' };

function keyLabel(combo) {
  return combo.split('+').map(p => KEY_NAMES[p] || p.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num')).join(' + ');
}

const Hotkeys = new (class extends Emitter {
  constructor() {
    super();
    this.actions = new Map();
    this.held = new Set();
    this.enabled = () => false;
  }

  /* hold: действие активно, пока клавиша зажата (emit hold:start / hold:end) */
  register(id, label, defs, { hold = false, group = 'Рисование', repeat = false } = {}) {
    this.actions.set(id, { id, label, defs, hold, group, repeat });
  }

  combos(id) {
    const custom = Store.get('hotkeys', {})[id];
    return custom || this.actions.get(id).defs;
  }

  setCombos(id, list) {
    const all = Store.get('hotkeys', {});
    all[id] = list;
    Store.set('hotkeys', all);
    this.emit('changed');
  }

  resetAll() { Store.set('hotkeys', {}); this.emit('changed'); }

  static matches(combo, e) {
    const parts = combo.split('+');
    const main = parts.pop();
    if (e.code !== main) return false;
    const mods = new Set(parts);
    const own = MOD_CODES[main];
    const need = m => mods.has(m) || own === m;
    return e.ctrlKey === need('Ctrl') && e.shiftKey === need('Shift') && e.altKey === need('Alt') && e.metaKey === need('Meta');
  }

  install() {
    window.addEventListener('keydown', e => this.onDown(e), true);
    window.addEventListener('keyup', e => this.onUp(e), true);
    window.addEventListener('blur', () => this.releaseAll());
  }

  onDown(e) {
    if (this.recording) return;
    if (!this.enabled() || isTyping(e)) return;
    for (const a of this.actions.values()) {
      if (!this.combos(a.id).some(c => Hotkeys.constructor.matches(c, e))) continue;
      e.preventDefault();
      e.stopPropagation();
      if (a.hold) {
        if (!this.held.has(a.id)) { this.held.add(a.id); a.code = e.code; this.emit('hold:start', a.id); }
      } else if (!e.repeat || a.repeat) {
        this.emit('tap', a.id);
      }
      return;
    }
  }

  onUp(e) {
    for (const id of [...this.held]) {
      const a = this.actions.get(id);
      if (a.code === e.code || (MOD_CODES[a.code] && MOD_CODES[a.code] === MOD_CODES[e.code])) {
        this.held.delete(id);
        this.emit('hold:end', id);
        e.preventDefault();
      }
    }
    if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
  }

  releaseAll() { for (const id of [...this.held]) { this.held.delete(id); this.emit('hold:end', id); } }
  isHeld(id) { return this.held.has(id); }

  /* Запись новой комбинации: возвращает Promise<string|null> */
  record() {
    this.recording = true;
    return new Promise(resolve => {
      const finish = v => { this.recording = false; window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true); resolve(v); };
      let lastMod = null;
      const kd = e => {
        e.preventDefault(); e.stopPropagation();
        if (e.code === 'Escape') return finish(null);
        if (MOD_CODES[e.code]) { lastMod = e.code; return; }
        const mods = [];
        if (e.ctrlKey) mods.push('Ctrl');
        if (e.shiftKey) mods.push('Shift');
        if (e.altKey) mods.push('Alt');
        if (e.metaKey) mods.push('Meta');
        finish([...mods, e.code].join('+'));
      };
      const ku = e => {
        e.preventDefault(); e.stopPropagation();
        if (MOD_CODES[e.code] && lastMod === e.code) finish(e.code);
      };
      window.addEventListener('keydown', kd, true);
      window.addEventListener('keyup', ku, true);
    });
  }

  view() {
    const box = h('div');
    const render = () => {
      box.innerHTML = '';
      let group = null;
      for (const a of this.actions.values()) {
        if (a.group !== group) { group = a.group; box.append(UI.sec(group)); }
        const keys = h('div', { class: 'gpp-key' });
        const list = this.combos(a.id);
        list.forEach((c, i) => keys.append(h('span', {
          class: 'gpp-kbd', title: 'ЛКМ — изменить, ПКМ — удалить',
          onclick: async ev => { ev.currentTarget.classList.add('rec'); ev.currentTarget.textContent = '…'; const r = await this.record(); if (r) { const l = [...list]; l[i] = r; this.setCombos(a.id, l); } render(); },
          oncontextmenu: ev => { ev.preventDefault(); const l = list.filter((_, j) => j !== i); this.setCombos(a.id, l); render(); },
        }, keyLabel(c))));
        keys.append(h('span', {
          class: 'gpp-kbd empty', title: 'Добавить сочетание',
          onclick: async ev => { ev.currentTarget.classList.add('rec'); ev.currentTarget.textContent = '…'; const r = await this.record(); if (r) this.setCombos(a.id, [...list, r]); render(); },
        }, '+'));
        box.append(UI.row(a.label + (a.hold ? ' (зажать)' : ''), null, keys));
      }
      box.append(h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn', onclick: () => { this.resetAll(); render(); } }, 'Сбросить все клавиши')));
    };
    render();
    return box;
  }
})();
