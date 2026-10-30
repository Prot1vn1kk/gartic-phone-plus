/* ───────────────────────────── Стили ───────────────────────────── */

const CSS = `
:root{--gpp-accent:#8b5cf6;--gpp-bg:rgba(24,18,43,var(--gpp-op,.92));--gpp-bg2:rgba(255,255,255,.06);--gpp-bg3:rgba(255,255,255,.11);
--gpp-line:rgba(255,255,255,.12);--gpp-text:#efeaff;--gpp-dim:#a99fc9;--gpp-r:12px;--gpp-font:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.gpp,.gpp *{box-sizing:border-box;font-family:var(--gpp-font)}
.gpp{color:var(--gpp-text);font-size:13px;line-height:1.35}
.gpp button{font:inherit;color:inherit}
.gpp-win{position:fixed;z-index:2147483000;background:var(--gpp-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
border:1px solid var(--gpp-line);border-radius:var(--gpp-r);box-shadow:0 18px 50px rgba(0,0,0,.45);display:flex;flex-direction:column;min-width:220px;max-height:calc(100vh - 16px)}
.gpp-win.hidden{display:none}
.gpp-win-head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 14px;cursor:grab;user-select:none;border-bottom:1px solid var(--gpp-line)}
.gpp-win-head:active{cursor:grabbing}
.gpp-win-title{font-weight:700;font-size:13px;letter-spacing:.2px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gpp-win-title b{color:var(--gpp-accent)}
.gpp-icon-btn{width:26px;height:26px;border-radius:8px;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;color:var(--gpp-dim);flex:none}
.gpp-icon-btn:hover{background:var(--gpp-bg3);color:var(--gpp-text)}
.gpp-icon-btn.on{background:var(--gpp-accent);color:#fff}
.gpp-icon-btn svg{width:16px;height:16px}
.gpp-win-body{padding:12px 14px;overflow:auto;flex:1}
.gpp-win-body::-webkit-scrollbar{width:8px}.gpp-win-body::-webkit-scrollbar-thumb{background:var(--gpp-bg3);border-radius:8px}
.gpp-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
.gpp-tabs{display:flex;gap:4px;padding:8px 10px 0;border-bottom:1px solid var(--gpp-line);overflow-x:auto}
.gpp-tab{border:0;background:transparent;padding:8px 11px;border-radius:9px 9px 0 0;cursor:pointer;color:var(--gpp-dim);font-weight:600;white-space:nowrap}
.gpp-tab:hover{color:var(--gpp-text)}.gpp-tab.on{color:var(--gpp-text);background:var(--gpp-bg2);box-shadow:inset 0 -2px 0 var(--gpp-accent)}
.gpp-sec{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--gpp-dim);margin:14px 0 6px;font-weight:700}
.gpp-sec:first-child{margin-top:0}
.gpp-row{display:flex;align-items:center;gap:10px;padding:6px 0;min-height:32px}
.gpp-row .gpp-label{flex:1;min-width:0}
.gpp-row .gpp-label small{display:block;color:var(--gpp-dim);font-size:11.5px;margin-top:1px}
.gpp-switch{position:relative;width:38px;height:22px;border-radius:22px;background:var(--gpp-bg3);border:0;cursor:pointer;flex:none;transition:background .15s}
.gpp-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.gpp-switch.on{background:var(--gpp-accent)}.gpp-switch.on::after{transform:translateX(16px)}
.gpp-slider{display:flex;align-items:center;gap:8px;width:170px;flex:none}
.gpp-slider input{flex:1;accent-color:var(--gpp-accent);min-width:0}
.gpp-slider output{width:42px;text-align:right;color:var(--gpp-dim);font-variant-numeric:tabular-nums}
.gpp-select,.gpp-input{background:var(--gpp-bg2);border:1px solid var(--gpp-line);color:var(--gpp-text);border-radius:8px;padding:6px 8px;font:inherit;outline:none}
.gpp-select:focus,.gpp-input:focus{border-color:var(--gpp-accent)}
.gpp-select option{background:#241b3d}
.gpp-colorin{width:38px;height:26px;border:1px solid var(--gpp-line);border-radius:7px;padding:0;background:none;cursor:pointer}
.gpp-btn{border:1px solid var(--gpp-line);background:var(--gpp-bg2);border-radius:9px;padding:7px 12px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.gpp-btn:hover{background:var(--gpp-bg3)}
.gpp-btn svg{width:16px;height:16px;flex:none}
.gpp-btn.primary{background:var(--gpp-accent);border-color:transparent;color:#fff}
.gpp-btn.danger:hover{background:#b4235a}
.gpp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.gpp-key{display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.gpp-kbd{border:1px solid var(--gpp-line);background:var(--gpp-bg2);border-radius:7px;padding:3px 8px;font-size:12px;cursor:pointer;min-width:30px;text-align:center}
.gpp-kbd:hover{border-color:var(--gpp-accent)}.gpp-kbd.rec{border-color:var(--gpp-accent);background:var(--gpp-accent);color:#fff}
.gpp-kbd.empty{color:var(--gpp-dim)}
.gpp-note{color:var(--gpp-dim);font-size:12px;margin:6px 0}
.gpp-toasts{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483600;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.gpp-toast{background:var(--gpp-bg);border:1px solid var(--gpp-line);border-radius:10px;padding:8px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:gpp-in .18s ease-out}
@keyframes gpp-in{from{opacity:0;transform:translateY(-6px)}}
.gpp-fab{position:fixed;right:14px;bottom:14px;z-index:2147483100;height:38px;padding:0 14px 0 10px;border-radius:19px;border:1px solid var(--gpp-line);
background:var(--gpp-bg);backdrop-filter:blur(10px);color:var(--gpp-text);cursor:pointer;display:flex;align-items:center;gap:7px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.gpp-fab:hover{border-color:var(--gpp-accent)}
.gpp-fab i{width:20px;height:20px;border-radius:6px;background:var(--gpp-accent);display:grid;place-items:center;font-style:normal;font-size:12px;color:#fff}
.gpp-modal{position:fixed;inset:0;z-index:2147483500;background:rgba(10,6,22,.55);display:grid;place-items:center}
.gpp-modal .gpp-dialog{background:var(--gpp-bg);border:1px solid var(--gpp-line);border-radius:14px;padding:18px 20px;min-width:300px;max-width:420px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.gpp-dialog h3{margin:0 0 8px;font-size:15px}
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

function confirmDialog(title, text, okText = 'Да', cancelText = 'Отмена') {
  return new Promise(resolve => {
    const done = v => { m.remove(); resolve(v); };
    const m = h('div', { class: 'gpp gpp-modal', onpointerdown: e => { if (e.target === m) done(false); } },
      h('div', { class: 'gpp-dialog' }, h('h3', {}, title), h('div', { class: 'gpp-note' }, text),
        h('div', { class: 'gpp-btns', style: { justifyContent: 'flex-end' } },
          h('button', { class: 'gpp-btn', onclick: () => done(false) }, cancelText),
          h('button', { class: 'gpp-btn primary', onclick: () => done(true) }, okText))));
    document.body.append(m);
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
