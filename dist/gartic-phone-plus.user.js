// ==UserScript==
// @name         Gartic Phone Plus
// @namespace    https://github.com/Prot1vn1kk
// @version      1.2.0
// @description  Расширенное рисование, референсы, таймлапс-плеер и настройки для Gartic Phone. Один скрипт, без внешнего кода и аналитики.
// @author       Prot1vn1kk
// @license      MIT
// @homepageURL  https://github.com/Prot1vn1kk/gartic-phone-plus
// @supportURL   https://github.com/Prot1vn1kk/gartic-phone-plus/issues
// @downloadURL  https://raw.githubusercontent.com/Prot1vn1kk/gartic-phone-plus/main/dist/gartic-phone-plus.user.js
// @updateURL    https://raw.githubusercontent.com/Prot1vn1kk/gartic-phone-plus/main/dist/gartic-phone-plus.user.js
// @match        https://garticphone.com/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      commons.wikimedia.org
// @connect      api.openverse.org
// @connect      upload.wikimedia.org
// @connect      thumb.wikimedia.org
// @icon         https://www.google.com/s2/favicons?sz=64&domain=garticphone.com
// ==/UserScript==

// Сеть нужна только модулю «Референсы»: поиск картинок через открытые API Wikimedia Commons и Openverse.
// Скрипт не подгружает внешний код, не собирает аналитику и не отправляет ваши данные на сторонние серверы.

(function () {
'use strict';

const W = unsafeWindow;
if (W.top !== W || W.__gpPlusLoaded) return;
W.__gpPlusLoaded = true;
/* ───────────────────────────── Утилиты ───────────────────────────── */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = Math.round;

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

class Emitter {
  constructor() { this._l = new Map(); }
  on(name, fn) { (this._l.get(name) || this._l.set(name, new Set()).get(name)).add(fn); return () => this.off(name, fn); }
  off(name, fn) { this._l.get(name)?.delete(fn); }
  emit(name, ...args) {
    for (const fn of [...(this._l.get(name) || [])]) {
      try { fn(...args); } catch (e) { console.error('[GP+]', name, e); }
    }
  }
}

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

function waitFor(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); clearTimeout(t); resolve(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    const t = setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
  });
}

function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function isTyping(e) {
  const t = e.target;
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && t.type !== 'range' && t.type !== 'checkbox';
}

/* ───────────────────────────── Цвет ───────────────────────────── */

const Color = {
  hexToRgb(hex) {
    let s = String(hex).replace('#', '');
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    const n = parseInt(s.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  },
  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hue = 0;
    if (d) {
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue /= 6;
      if (hue < 0) hue += 1;
    }
    return [hue, max ? d / max : 0, max];
  },
  hsvToRgb(hh, s, v) {
    const i = Math.floor(hh * 6), f = hh * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
    return [r * 255, g * 255, b * 255];
  },
  hexToHsv(hex) { return Color.rgbToHsv(...Color.hexToRgb(hex)); },
  hsvToHex(hh, s, v) { return Color.rgbToHex(...Color.hsvToRgb(hh, s, v)); },
  valid(hex) { return /^#?[0-9a-f]{6}$/i.test(hex) || /^#?[0-9a-f]{3}$/i.test(hex); },
  norm(hex) { return Color.rgbToHex(...Color.hexToRgb(hex)); },
};

/* ───────────────────────────── Хранилище настроек ───────────────────────────── */

const Store = {
  get(key, def) {
    try {
      const v = GM_getValue(key);
      return v === undefined ? structuredClone(def) : JSON.parse(v);
    } catch { return structuredClone(def); }
  },
  set(key, value) { GM_setValue(key, JSON.stringify(value)); },
};

const DEFAULTS = {
  painter: {
    enabled: true,
    defaultColor: '#000000',
    defaultColor2: '#ffffff',
    defaultThickness: 12,
    defaultOpacity: 10,
    resetEachTurn: true,
    maxThickness: 200,
    doubleEraser: true,
    smoothing: 2,
    fillTolerance: 24,
    thicknessSensitivity: 1,
    opacitySensitivity: 1,
    brightnessSensitivity: 1,
    zoomStep: 1.2,
    maxZoom: 30,
    zoomToPoint: 3,
    gridSize: 50,
    gridOpacity: 0.35,
    symmetryColor: '#33d6ff',
    radialCount: 8,
    mandalaCount: 4,
    readyConfirm: false,
    clearConfirm: true,
    hideHeader: false,
    showCursor: true,
  },
  reference: {
    dockWidth: 360,
    engine: 'commons',
    googleSafe: 'active',
    frameOpacity: 1,
    stickyEdges: true,
  },
  player: {
    autoplay: true,
    openOnDblClick: true,
    speed: 10,
  },
  ui: {
    accent: '#5bffb6',
    panelOpacity: 1,
    fixedSize: false,
    fixedScale: 1,
  },
};

const Settings = new (class extends Emitter {
  constructor() {
    super();
    this.data = {};
    for (const k of Object.keys(DEFAULTS)) this.data[k] = Object.assign(structuredClone(DEFAULTS[k]), Store.get('s.' + k, {}));
  }
  get(mod, key) { return this.data[mod][key]; }
  set(mod, key, value) {
    this.data[mod][key] = value;
    Store.set('s.' + mod, this.data[mod]);
    this.emit('change', mod, key, value);
    this.emit(mod + '.' + key, value);
  }
  reset(mod) {
    this.data[mod] = structuredClone(DEFAULTS[mod]);
    Store.set('s.' + mod, this.data[mod]);
    for (const [k, v] of Object.entries(this.data[mod])) this.emit(mod + '.' + k, v);
    this.emit('change', mod);
  }
  exportAll() {
    return { app: 'gartic-phone-plus', version: 1, settings: this.data, hotkeys: Store.get('hotkeys', {}), palettes: Store.get('palettes', null) };
  }
  importAll(obj) {
    if (!obj || obj.app !== 'gartic-phone-plus') throw new Error('Это не файл настроек Gartic Phone Plus');
    for (const k of Object.keys(DEFAULTS)) {
      this.data[k] = Object.assign(structuredClone(DEFAULTS[k]), obj.settings?.[k] || {});
      Store.set('s.' + k, this.data[k]);
    }
    if (obj.hotkeys) Store.set('hotkeys', obj.hotkeys);
    if (obj.palettes) Store.set('palettes', obj.palettes);
  }
})();

/* ───────────────────────────── Сеть: перехват socket.io ─────────────────────────────
   Gartic Phone работает через socket.io (EIO=4): сначала HTTP long-polling, затем WebSocket.
   Сообщения игры: 42[2, СОБЫТИЕ, ДАННЫЕ]; стартовое состояние комнаты: 42[1, {...}].       */

const EV = {
  PLAYER_JOINED: 2, PLAYER_LEFT: 3, GAME_STARTED: 5, PHRASE: 6, TOOL: 7, ALBUM_ITEM: 9,
  TURN_STARTED: 11, ALBUM_INFO: 12, KICK: 14, READY: 15, NEW_GAME: 20, PLAYER_LEFT_GAME: 21,
  PLAYER_RETURNED: 22, GALLERY: 23, TURNS_ENDED: 24, CHANGE_MODE: 26, GAME_QUIT: 28,
};
const SCREEN = { LOBBY: 1, PHRASE: 3, DESCRIPTION: 4, DRAW: 5, ALBUM: 7 };
const SEND_GAP = 130;

const Net = new (class extends Emitter {
  constructor() {
    super();
    this.ws = null;
    this.state = { screen: null, user: {}, users: [], turnNum: 0, configs: {}, previous: null, draw: [] };
    this.album = { num: -1, author: null, items: [] };
    this.queue = [];
    this.lastSend = 0;
    this.timer = null;
  }

  install() {
    const self = this;
    const WSProto = W.WebSocket.prototype;
    const origSend = WSProto.send;
    WSProto.send = function (data) {
      try {
        if (this.url && this.url.includes('garticphone.com/socket.io') && this.__gpPlusWs !== true) {
          this.__gpPlusWs = true;
          self.attach(this);
        }
        if (typeof data === 'string') self.onOutgoing(data);
      } catch (e) { console.error('[GP+]', e); }
      return origSend.call(this, data);
    };

    const XProto = W.XMLHttpRequest.prototype;
    const origOpen = XProto.open;
    XProto.open = function (method, url) {
      this.__gpPlusUrl = String(url || '');
      return origOpen.apply(this, arguments);
    };
    const origXSend = XProto.send;
    XProto.send = function (body) {
      if (this.__gpPlusUrl.includes('/socket.io/')) {
        try { if (typeof body === 'string') body.split('\x1e').forEach(p => self.onOutgoing(p)); } catch (e) { console.error('[GP+]', e); }
        this.addEventListener('load', () => {
          try {
            const t = this.responseText;
            if (t && t !== 'ok') t.split('\x1e').forEach(p => self.onIncoming(p));
          } catch (e) { console.error('[GP+]', e); }
        });
      }
      return origXSend.apply(this, arguments);
    };
  }

  attach(ws) {
    this.ws = ws;
    ws.addEventListener('message', e => {
      try { if (typeof e.data === 'string') this.onIncoming(e.data); } catch (err) { console.error('[GP+]', err); }
    });
    ws.addEventListener('close', () => { if (this.ws === ws) this.ws = null; this.emit('disconnect'); });
    this.emit('connect');
  }

  parse(raw) {
    if (!raw || raw[0] !== '4' || raw[1] !== '2') return null;
    const i = raw.indexOf('[');
    if (i < 0) return null;
    try { return JSON.parse(raw.slice(i)); } catch { return null; }
  }

  onOutgoing(raw) {
    const p = this.parse(raw);
    if (!p || p[0] !== 2) return;
    const [, ev, data] = p;
    if (this._own) return;
    if (ev === EV.TOOL && data && data.v != null) this.emit('tool:out', data);
    this.emit('out', ev, data);
  }

  onIncoming(raw) {
    const p = this.parse(raw);
    if (!p) return;
    if (p[0] === 1 && p[1] && typeof p[1] === 'object') return this.applyPresets(p[1]);
    if (p[0] !== 2) return;
    const [, ev, data] = p;
    this.reduce(ev, data);
    this.emit('event', ev, data);
    this.emit('ev:' + ev, data);
  }

  applyPresets(s) {
    if (s.error) return;
    Object.assign(this.state, s);
    const me = this.state.users?.find(u => u.id === s.user?.id);
    if (me) me.you = true;
    this.emit('presets', this.state);
    this.emit('screen', this.state.screen, true);
  }

  reduce(ev, d) {
    const st = this.state;
    switch (ev) {
      case EV.PLAYER_JOINED: st.users.push(d); break;
      case EV.PLAYER_LEFT:
      case EV.PLAYER_LEFT_GAME:
        if (ev === EV.PLAYER_LEFT) st.users = st.users.filter(u => u.id !== d.userLeft);
        if (d.newOwner) { st.users.forEach(u => (u.owner = u.id === d.newOwner)); st.user.owner = st.user.id === d.newOwner; }
        break;
      case EV.KICK: st.users = st.users.filter(u => u.id !== d); break;
      case EV.READY:
        st.users.forEach(u => { if (u.id === d.user) u.ready = d.ready; });
        if (d.user === st.user.id) st.user.ready = d.ready;
        break;
      case EV.GAME_STARTED: st.turnNum = 0; st.turnMax = d; break;
      case EV.TURN_STARTED:
        Object.assign(st, { draw: [], previous: null }, d);
        st.user.ready = false;
        st.users.forEach(u => (u.ready = false));
        this.emit('screen', st.screen, false);
        break;
      case EV.TURNS_ENDED: st.screen = SCREEN.ALBUM; this.emit('screen', st.screen, false); break;
      case EV.ALBUM_INFO:
        this.album = { num: d.bookNum, author: d.bookAuthor, items: [] };
        (d.timeline || []).forEach(it => this.addAlbumItem(it));
        break;
      case EV.ALBUM_ITEM: if (d && d.data !== undefined) this.addAlbumItem(d); break;
      case EV.NEW_GAME: st.screen = SCREEN.LOBBY; this.emit('screen', st.screen, false); break;
      case EV.GAME_QUIT: st.screen = null; this.emit('screen', null, false); break;
    }
  }

  addAlbumItem(it) {
    if (!it || it.id == null || it.data == null) return;
    this.album.items[it.id] = it;
    this.emit('album:item', it, this.album);
  }

  get me() { return this.state.user || {}; }
  get isHost() { return !!this.state.user?.owner; }
  get connected() { return !!this.ws && this.ws.readyState === 1; }

  sendRaw(ev, data) {
    if (!this.connected) return false;
    this._own = true;
    try { this.ws.send('42' + JSON.stringify(data === undefined ? [2, ev] : [2, ev, data])); }
    finally { this._own = false; }
    return true;
  }

  /* Пакеты инструментов идут через очередь не чаще одного раза в SEND_GAP мс:
     пачки штрихов (симметрия) иначе упираются в ограничение сервера. */
  tool(d, v) {
    const pkt = { t: this.state.turnNum, d, v };
    const id = Array.isArray(v) ? v[1] : null;
    if (d === 3 && id != null) {
      const q = this.queue.find(x => x.v && Array.isArray(x.v) && x.v[1] === id && x.d !== 2);
      if (q) { q.v = v; return; }
    }
    this.queue.push(pkt);
    this.flush();
  }

  flush() {
    if (this.timer) return;
    const step = () => {
      this.timer = null;
      if (!this.queue.length) return this.emit('queue', 0);
      const wait = SEND_GAP - (Date.now() - this.lastSend);
      if (wait > 0) { this.timer = setTimeout(step, wait); return this.emit('queue', this.queue.length); }
      const pkt = this.queue.shift();
      if (pkt.ready !== undefined) this.sendRaw(EV.READY, pkt.ready);
      else { pkt.t = this.state.turnNum; this.sendRaw(EV.TOOL, pkt); }
      this.lastSend = Date.now();
      if (this.queue.length) this.timer = setTimeout(step, SEND_GAP);
      this.emit('queue', this.queue.length);
    };
    step();
  }

  clearQueue() { clearTimeout(this.timer); this.timer = null; this.queue = []; this.emit('queue', 0); }
  /* «Готово» идёт через ту же очередь, чтобы не обогнать ещё не отправленные штрихи */
  ready(value) { this.queue.push({ ready: !!value }); this.flush(); }
})();
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

/* ───────────────────────────── Раскладка экрана игры ─────────────────────────────
   Игра центрирует .screen и масштабирует его от размера окна. Когда открыта боковая панель
   референсов или включён фиксированный размер, масштаб и сдвиг считает скрипт.             */

const Layout = new (class extends Emitter {
  constructor() { super(); this.dock = 0; }

  init() {
    injectCss('html.gpp-layout .screen{transform:scale(var(--gpp-scr-scale,1)) !important}', 'gpp-layout-css');
    window.addEventListener('resize', () => this.applySoon());
    new MutationObserver(() => { if (this.active) this.applySoon(); }).observe(document.body, { childList: true, subtree: true });
    Settings.on('change', mod => { if (mod === 'ui') this.applySoon(); });
    this.applySoon();
  }

  get active() { return this.dock > 0 || Settings.get('ui', 'fixedSize'); }

  setDock(px) { this.dock = Math.max(0, px | 0); this.apply(); }

  applySoon() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.apply(); });
  }

  apply() {
    const scr = document.querySelector('.screen');
    const root = document.documentElement;
    if (!scr) return;
    const par = scr.parentElement;
    if (!this.active) {
      if (root.classList.contains('gpp-layout')) { root.classList.remove('gpp-layout'); par.style.marginLeft = ''; this.emit('change'); }
      return;
    }
    root.classList.add('gpp-layout');
    const ml = this.dock ? this.dock + 'px' : '';
    if (par.style.marginLeft !== ml) par.style.marginLeft = ml;
    const pr = par.getBoundingClientRect();
    const fit = Math.min((pr.width - 12) / scr.offsetWidth, (pr.height - 12) / scr.offsetHeight);
    const scale = Settings.get('ui', 'fixedSize') ? Math.min(Settings.get('ui', 'fixedScale'), this.dock ? fit : Infinity) : fit;
    const val = String(Math.max(0.3, Math.round(scale * 1000) / 1000));
    if (root.style.getPropertyValue('--gpp-scr-scale') !== val) { root.style.setProperty('--gpp-scr-scale', val); this.emit('change'); }
    else if (this.lastDock !== this.dock) this.emit('change');
    this.lastDock = this.dock;
  }

  /* Прямоугольник экрана игры в координатах окна */
  screenRect() { return document.querySelector('.screen')?.getBoundingClientRect() || null; }
})();
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
  constructor({ width = 220, height = 150 } = {}) {
    super();
    this.hsv = [0, 0, 0];
    this.el = h('div', { class: 'gpp-cp' });
    this.sv = h('canvas', { class: 'gpp-cp-sv', width, height });
    this.hue = h('canvas', { class: 'gpp-cp-hue', width, height: 14 });
    this.svMark = h('div', { class: 'gpp-cp-mark' });
    this.hueMark = h('div', { class: 'gpp-cp-hmark' });
    this.el.append(h('div', { class: 'gpp-cp-svwrap' }, this.sv, this.svMark), h('div', { class: 'gpp-cp-huewrap' }, this.hue, this.hueMark));
    const hc = this.hue.getContext('2d');
    const g = hc.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    hc.fillStyle = g; hc.fillRect(0, 0, width, 14);
    this.drag(this.sv, (x, y) => { this.hsv[1] = x; this.hsv[2] = 1 - y; this.update(true); });
    this.drag(this.hue, x => { this.hsv[0] = Math.min(x, 0.9999); this.update(true); });
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
    this.hueMark.style.left = this.hsv[0] * 100 + '%';
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
      this.popupCp = new ColorPicker({ width: 220, height: 160 });
      this.popupCp.on('input', hex => this.setColor(hex, false));
      this.popupCp.on('commit', hex => this.pushRecent(hex));
      this.picker.body.append(this.popupCp.el);
    }
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
.gpp-col{width:129px;padding:8px;border-radius:9px;background:var(--gpp-panel-bg);border:1.6px solid var(--gpp-panel-border);
box-shadow:0 0 0 3px var(--gpp-panel-shadow);display:flex;flex-direction:column;gap:7px;color:#fff;font:11px/1.2 var(--gpp-f-bold);user-select:none}
.gpp-col *{box-sizing:border-box}
.gpp-right{margin-top:16px}
.gpp-panels-hidden .gpp-col,.gpp-panels-hidden .gpp-hdr{display:none}
.gpp-panels-hidden .colors .content.gpp-native-hidden{display:flex !important}
.gpp-tgrid{display:grid;grid-template-columns:repeat(3,30px);justify-content:space-between;gap:8px 0}
.gpp-tbtn{position:relative;width:30px;height:30px;border-radius:7px;border:1.6px solid #fff;box-shadow:0 0 0 2px var(--gpp-tool-ring);background:transparent;
color:#fff;display:grid;place-items:center;cursor:pointer;padding:0;font:12px/1 var(--gpp-f-black)}
.gpp-tbtn:hover{background:rgba(255,255,255,.18)}
.gpp-tbtn.on{background:#fff;color:var(--gpp-tool-ring)}
.gpp-tbtn svg{width:19px;height:19px}
.gpp-tbtn[data-tip]:hover::after{content:attr(data-tip);position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);white-space:nowrap;
background:var(--gpp-edge);color:#fff;font:11px/1 var(--gpp-f-bold);padding:6px 8px;border-radius:6px;pointer-events:none;z-index:50}
.gpp-left .gpp-tbtn[data-tip]:hover::after{right:auto;left:calc(100% + 8px)}
.gpp-sep{height:1px;background:var(--gpp-panel-border);margin:1px 0}
.gpp-colhead{display:flex;align-items:center;gap:6px}
.gpp-pair{position:relative;width:40px;height:36px;flex:none;cursor:pointer}
.gpp-pair span{position:absolute;width:26px;height:26px;border-radius:6px;border:1.6px solid rgb(67,17,31);box-shadow:0 0 0 2px #fff}
.gpp-pair .c1{left:2px;top:2px;z-index:1}.gpp-pair .c2{right:2px;bottom:2px}
.gpp-hex{width:100%;min-width:0;background:rgba(0,0,0,.28);border:1.6px solid var(--gpp-panel-border);border-radius:6px;color:#fff;font:11px var(--gpp-f-bold);padding:4px 5px;outline:none;text-transform:uppercase}
.gpp-hex:focus{border-color:#fff}
.gpp-col .gpp-cp{gap:6px}
.gpp-col .gpp-cp canvas{border-radius:6px;box-shadow:0 0 0 1.6px rgba(255,255,255,.7)}
.gpp-col .gpp-cp-huewrap canvas{height:10px;border-radius:5px}
.gpp-col .gpp-cp-hmark{height:16px}
.gpp-rangebox{display:flex;align-items:center;gap:5px}
.gpp-rangebox input{flex:1;min-width:0;accent-color:#fff;height:14px}
.gpp-rangebox b{width:26px;text-align:right;font:11px var(--gpp-f-black)}
.gpp-palbar{display:flex;align-items:center;gap:3px}
.gpp-palbar select{flex:1;min-width:0;background:rgba(0,0,0,.28);border:1.6px solid var(--gpp-panel-border);border-radius:6px;color:#fff;font:10.5px var(--gpp-f-bold);padding:3px 2px;outline:none}
.gpp-palbar select option{background:var(--gpp-field)}
.gpp-palbar button{width:20px;height:20px;border:0;border-radius:5px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0;flex:none}
.gpp-palbar button:hover{background:rgba(255,255,255,.3)}
.gpp-palbar svg{width:13px;height:13px}
.gpp-left{width:154px}
.gpp-spectrum{display:grid;grid-template-columns:repeat(13,1fr);border-radius:6px;overflow:hidden;box-shadow:0 0 0 1.6px rgba(255,255,255,.75)}
.gpp-spectrum i{display:block;aspect-ratio:1;cursor:pointer}
.gpp-spectrum i:hover{outline:2px solid #fff;outline-offset:-1px;position:relative;z-index:1}
.gpp-spectrum i.sel{outline:2px solid var(--gpp-accent);outline-offset:-1px;position:relative;z-index:2}
.gpp-big{position:relative;height:30px;border-radius:7px;display:flex;overflow:hidden;box-shadow:0 0 0 1.6px #fff,0 0 0 3.4px rgb(67,17,31);margin:2px}
.gpp-big .p{flex:1}.gpp-big .s{width:32%;cursor:pointer;box-shadow:inset 2px 0 0 rgba(255,255,255,.8)}
.gpp-big input{position:absolute;left:5px;top:50%;transform:translateY(-50%);width:70px;background:rgba(0,0,0,.38);border:0;border-radius:5px;color:#fff;font:11px var(--gpp-f-bold);padding:3px 5px;text-transform:uppercase;outline:none}
.gpp-big input:focus{background:rgba(0,0,0,.6)}
.gpp-rangebox span{width:36px;font:10.5px var(--gpp-f-bold);opacity:.85}
.gpp-swgrid{display:grid;grid-template-columns:repeat(6,20px);justify-content:space-between;gap:4px 0;max-height:142px;overflow-y:auto;padding:2px 2px 2px 1px;margin:0 -2px 0 -1px}
.gpp-swgrid::-webkit-scrollbar{width:4px}.gpp-swgrid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:4px}
.gpp-col .gpp-sw{width:20px;height:20px;border-radius:4px;border:1px solid rgb(67,17,31);box-shadow:0 0 0 1.5px #fff;cursor:pointer}
.gpp-col .gpp-sw:hover{transform:scale(1.12)}
.gpp-col .gpp-sw.sel{box-shadow:0 0 0 2.5px var(--gpp-accent)}
.gpp-recent{grid-template-columns:repeat(6,20px);max-height:none}
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

  buildLeft() {
    const p = this.p;
    this.hex = h('input', { maxlength: 7, spellcheck: 'false', title: 'HEX-код основного цвета' });
    this.hex.addEventListener('change', () => p.setColor(this.hex.value.startsWith('#') ? this.hex.value : '#' + this.hex.value));
    this.hex.addEventListener('click', e => e.stopPropagation());
    this.bigP = h('div', { class: 'p', title: 'Основной цвет (ЛКМ)' });
    this.bigS = h('div', { class: 's', title: 'Дополнительный цвет (ПКМ рисует им). Клик — поменять местами (X)', onclick: () => p.swapColors() });
    this.cp = new ColorPicker({ width: 136, height: 92 });
    this.cp.on('input', hex => p.setColor(hex, false));
    this.cp.on('commit', hex => p.pushRecent(hex));
    const range = (title, min, get, set) => {
      const inp = h('input', { type: 'range', min, step: 1, title });
      const val = h('b');
      inp.addEventListener('input', () => set(+inp.value));
      const box = h('div', { class: 'gpp-rangebox', title }, h('span', {}, title.split(' ')[0]), inp, val);
      box.upd = max => { inp.max = max; inp.value = get(); val.textContent = get(); };
      return box;
    };
    this.size = range('Толщина кисти ([ и ], Ctrl+тянуть)', 1, () => p.thickness, v => p.setThickness(v));
    this.opac = range('Насыщенность кисти (, и ., Shift+тянуть)', 1, () => p.opacity, v => p.setOpacity(v));
    this.palSel = h('select', { title: 'Палитра' });
    this.palSel.addEventListener('change', () => { this.palName = this.palSel.value; Store.set('palette.current', this.palName); this.refresh(); });
    const file = h('input', { type: 'file', accept: '.aco,.gpl,.txt,.hex', style: { display: 'none' } });
    file.addEventListener('change', () => this.importPalette(file.files[0]).finally(() => (file.value = '')));
    this.spectrum = this.buildSpectrum();
    this.palGrid = h('div', { class: 'gpp-swgrid' });
    this.recentGrid = h('div', { class: 'gpp-swgrid gpp-recent', title: 'Последние цвета' });
    return this.stop(h('div', { class: 'gpp-col gpp-left gpp' },
      h('div', { class: 'gpp-palbar' }, this.palSel,
        h('button', { title: 'Добавить текущий цвет в «Мои цвета»', html: ICON.plus, onclick: () => this.addToMine() }),
        h('button', { title: 'Импорт палитры (.aco, .gpl, .txt)', html: ICON.download, style: { transform: 'rotate(180deg)' }, onclick: () => file.click() }),
        file),
      this.spectrum, this.palGrid,
      this.cp.el,
      h('div', { class: 'gpp-big' }, this.bigP, this.bigS, this.hex),
      this.size, this.opac,
      this.recentGrid));
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
    return this.stop(h('div', { class: 'gpp-col gpp-right gpp' }, this.symGrid, h('div', { class: 'gpp-sep' }), this.viewGrid));
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
    this.bigP.style.background = p.color;
    this.bigS.style.background = p.color2;
    if (document.activeElement !== this.hex) this.hex.value = p.color;
    this.hex.style.color = Color.hexToHsv(p.color)[2] > 0.6 && Color.hexToHsv(p.color)[1] < 0.5 ? '#000' : '#fff';
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
      if (!all[this.palName].length) this.palGrid.append(h('div', { style: { gridColumn: '1 / -1', opacity: 0.75 } }, 'Пусто: «+» добавит текущий цвет'));
    }
    this.recentGrid.replaceChildren(...p.recent.slice(0, 12).map(c => this.swatch(c)));
    this.recentGrid.style.display = p.recent.length ? '' : 'none';
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
/* ───────────────────────────── Главное меню ───────────────────────────── */

const Menu = new (class {
  init() {
    this.modal = new GameModal({ title: '<b>GP+</b> Gartic Phone Plus', width: 640, height: 600, className: 'gpp-menu' });
    this.modal.body.style.cssText = 'padding:0;display:flex;flex-direction:column;overflow:hidden';
    this.tabsEl = h('div', { class: 'gpp-tabs' });
    this.content = h('div', { class: 'gpp-dialog-body gpp-scroll', style: { background: 'var(--gpp-head)', margin: '0 12px 12px', borderRadius: '0 9px 9px 9px' } });
    this.modal.body.append(this.tabsEl, this.content);
    this.tabs = [
      ['Рисование', () => this.painterTab()],
      ['Клавиши', () => this.keysTab()],
      ['Референсы', () => this.refTab()],
      ['Таймлапс', () => this.playerTab()],
      ['Общее', () => this.generalTab()],
    ];
    this.current = Store.get('menu.tab', 0);
    this.entry = h('button', { class: 'gpp-entry gpp', title: 'Gartic Phone Plus: настройки', html: ICON.gear + '<span>GP+</span>', onclick: e => { e.stopPropagation(); this.toggle(); } });
    this.placeEntry();
    new MutationObserver(() => this.placeEntrySoon()).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => this.placeEntrySoon());
  }

  /* Кнопка GP+ встаёт в шапку текущего экрана слева от кнопок звука и полноэкранного режима */
  placeEntrySoon() {
    if (this.placing) return;
    this.placing = true;
    requestAnimationFrame(() => { this.placing = false; this.placeEntry(); });
  }

  placeEntry() {
    const sound = [...document.querySelectorAll('button.sound')].find(b => b.offsetParent);
    const lang = !sound && [...document.querySelectorAll('.button-language')].find(b => b.offsetParent);
    if (lang) {
      // Главная страница: кнопки звука нет, GP+ встаёт справа от кнопки выбора языка
      clearTimeout(this.fallbackTimer);
      const parent = lang.parentElement;
      const left = lang.offsetLeft + lang.offsetWidth + 10, top = lang.offsetTop + (lang.offsetHeight - 28) / 2;
      if (this.entry.parentElement === parent && this.entry.style.left === left + 'px') return;
      this.entry.classList.remove('floating');
      this.entry.style.cssText = `left:${left}px;top:${top}px`;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      parent.append(this.entry);
      return;
    }
    if (!sound) {
      clearTimeout(this.fallbackTimer);
      if (!this.entry.isConnected || !this.entry.classList.contains('floating'))
        this.fallbackTimer = setTimeout(() => { if (![...document.querySelectorAll('button.sound')].some(b => b.offsetParent)) { this.entry.classList.add('floating'); this.entry.style.cssText = ''; document.body.append(this.entry); } }, 1200);
      return;
    }
    clearTimeout(this.fallbackTimer);
    const parent = sound.parentElement;
    const icons = [...parent.children].filter(el => el.tagName === 'BUTTON' && el !== this.entry && Math.abs(el.offsetTop - sound.offsetTop) < 12 && el.offsetLeft >= sound.offsetLeft - 120);
    const left = Math.min(...icons.map(el => el.offsetLeft));
    const right = parent.clientWidth - left + 8;
    const top = sound.offsetTop + (sound.offsetHeight - 28) / 2;
    if (this.entry.parentElement === parent && this.entry.style.right === right + 'px' && this.entry.style.top === top + 'px') return;
    this.entry.classList.remove('floating');
    this.entry.style.cssText = `right:${right}px;top:${top}px`;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.append(this.entry);
  }

  toggle() { this.modal.isOpen ? this.modal.close() : this.open(); }

  open(i = this.current) {
    if (!this.modal.isOpen) this.modal.open();
    this.show(i);
  }

  renderTabs() {
    this.tabsEl.replaceChildren(...this.tabs.map(([name], i) => h('button', { class: 'gpp-tab' + (i === this.current ? ' on' : ''), onclick: () => this.show(i) }, name)));
  }

  show(i) {
    this.current = i;
    Store.set('menu.tab', i);
    this.renderTabs();
    this.content.replaceChildren(this.tabs[i][1]());
    this.content.scrollTop = 0;
  }

  painterTab() {
    const B = (k, kind, o) => UI.bind('painter', k, kind, o);
    const px = v => v + 'px', x = v => '×' + v;
    return h('div', {},
      UI.sec('Основное'),
      UI.row('Расширенное рисование', 'Свой слой поверх холста: симметрия, зум, поворот, пипетка, заливка, горячие клавиши', B('enabled', 'switch')),
      UI.row('Панели GP+ в интерфейсе игры', 'Цвет и палитры вместо родной палитры, симметрия и вид под инструментами. Клавиша H', UI.switch(!Store.get('panels.hidden', false), v => {
        Store.set('panels.hidden', !v);
        document.querySelector('.screen')?.classList.toggle('gpp-panels-hidden', !v);
      })),
      UI.row('Подтверждать «Готово»', 'Спрашивать перед завершением хода', B('readyConfirm', 'switch')),
      UI.row('Подтверждать очистку холста', null, B('clearConfirm', 'switch')),
      UI.row('Курсор-кисть', 'Показывать размер кисти вместо обычного курсора', B('showCursor', 'switch')),
      UI.sec('В начале каждого хода'),
      UI.row('Сбрасывать кисть', 'Ставить цвета, толщину и насыщенность по умолчанию', B('resetEachTurn', 'switch')),
      UI.row('Основной цвет', null, B('defaultColor', 'color')),
      UI.row('Дополнительный цвет', 'Рисуется правой кнопкой мыши', B('defaultColor2', 'color')),
      UI.row('Толщина', null, B('defaultThickness', 'slider', { min: 1, max: 100, fmt: px })),
      UI.row('Насыщенность', null, B('defaultOpacity', 'slider', { min: 1, max: 10 })),
      UI.sec('Кисть'),
      UI.row('Максимальная толщина', null, B('maxThickness', 'slider', { min: 36, max: 400, step: 4, fmt: px })),
      UI.row('Двойная толщина ластика', 'Как в самой игре', B('doubleEraser', 'switch')),
      UI.row('Сглаживание линий', '0 — выключено. Чем больше, тем плавнее и «ленивее» линия', B('smoothing', 'slider', { min: 0, max: 8 })),
      UI.row('Допуск заливки', 'Насколько отличающиеся цвета захватывает заливка', B('fillTolerance', 'slider', { min: 0, max: 120 })),
      UI.sec('Чувствительность (тянуть мышью с зажатой клавишей)'),
      UI.row('Толщина', null, B('thicknessSensitivity', 'slider', { min: 0.2, max: 4, step: 0.1, fmt: x })),
      UI.row('Насыщенность', null, B('opacitySensitivity', 'slider', { min: 0.2, max: 4, step: 0.1, fmt: x })),
      UI.row('Яркость', null, B('brightnessSensitivity', 'slider', { min: 0.2, max: 4, step: 0.1, fmt: x })),
      UI.sec('Вид'),
      UI.row('Шаг масштаба', 'Колесо мыши и клавиши +/−', B('zoomStep', 'slider', { min: 1.05, max: 2, step: 0.05, fmt: x })),
      UI.row('Максимальный масштаб', null, B('maxZoom', 'slider', { min: 4, max: 60, fmt: x })),
      UI.row('Приближение к курсору (S)', null, B('zoomToPoint', 'slider', { min: 2, max: 20, fmt: x })),
      UI.row('Шаг сетки', null, B('gridSize', 'slider', { min: 10, max: 200, step: 5, fmt: px })),
      UI.row('Яркость сетки', null, B('gridOpacity', 'slider', { min: 0.1, max: 1, step: 0.05 })),
      UI.row('Цвет осей симметрии', null, B('symmetryColor', 'color')),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn', onclick: () => { Settings.reset('painter'); this.show(this.current); toast('Настройки рисования сброшены'); } }, 'Сбросить раздел')),
    );
  }

  keysTab() {
    const GPMOD = { mirror: ['CapsLock'], mirrorY: ['Shift+CapsLock'], gray: ['KeyB'], brush: [], clear: ['KeyF'] };
    return h('div', {},
      h('div', { class: 'gpp-note' }, 'Клавиши работают во время своего хода рисования. ЛКМ по клавише — переназначить, ПКМ — удалить, «+» — добавить ещё одно сочетание. Esc — отменить запись.'),
      h('div', { class: 'gpp-btns', style: { marginBottom: '10px' } },
        h('button', { class: 'gpp-btn', onclick: () => { Hotkeys.resetAll(); this.show(this.current); toast('Раскладка GP+'); } }, 'Раскладка GP+'),
        h('button', { class: 'gpp-btn primary', title: 'Зеркало — CapsLock, Ч/Б — B, очистка — F, как в gpmod', onclick: () => { Store.set('hotkeys', GPMOD); Hotkeys.emit('changed'); this.show(this.current); toast('Раскладка как в gpmod'); } }, 'Как в gpmod')),
      Hotkeys.view());
  }

  refTab() {
    return h('div', {},
      UI.sec('Боковая панель референсов'),
      h('div', { class: 'gpp-note' }, 'Панель открывается слева от игры, игра сдвигается вправо. Ширину меняйте, перетаскивая правую границу панели (двойной клик по границе — минимум/максимум). Открыть: клавиша P во время рисования, кнопка с картинкой в шапке или кнопка ниже.'),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn primary', onclick: () => { this.modal.close(); Reference.open(); } }, 'Открыть панель')),
      h('div', { class: 'gpp-note' }, 'В просмотре: колесо — масштаб, ЛКМ — двигать, двойной клик или средняя кнопка — вписать, ПКМ — назад к результатам, Ctrl+клик — сохранить. В строку поиска можно вставить ссылку на картинку.'),
      UI.sec('Плавающие окна'),
      h('div', { class: 'gpp-note' }, 'Кнопка-булавка в просмотре открепляет картинку в окно поверх игры. В окне: прозрачность, отражение, Ч/Б, закрепление (клики проходят сквозь картинку).'),
      UI.row('Прозрачность окон по умолчанию', null, UI.bind('reference', 'frameOpacity', 'slider', { min: 0.1, max: 1, step: 0.05 })),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn danger', onclick: () => { [...Reference.frames].forEach(f => f.win.hide()); toast('Окна референсов закрыты'); } }, 'Закрыть все окна')),
    );
  }

  playerTab() {
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    file.addEventListener('change', () => { if (file.files[0]) { this.modal.close(); Timelapse.openFile(file.files[0]); } file.value = ''; });
    return h('div', {},
      UI.sec('Плеер процесса рисования'),
      h('div', { class: 'gpp-note' }, 'В альбоме на каждом рисунке есть кнопка «Таймлапс»; также работает двойной клик или средняя кнопка мыши по рисунку. Плеер открывается прямо на месте рисунка.'),
      h('div', { class: 'gpp-note' }, 'Управление: клик по рисунку — пуск/пауза, средняя кнопка — развернуть на весь интерфейс игры, двойной клик или F — полный экран без рамок, ПКМ — меню сохранения (процесс .json, PNG, видео). Скорость — зажать и вести по индикатору «x10» или колесо. До x100 штрихи рисуются плавно, выше — мгновенно.'),
      h('div', { class: 'gpp-note' }, 'Над перемоткой — график: сколько штрихов сделано на каждом участке, цвет — основной цвет штрихов. Для своих рисунков график по реальному времени (скрипт записывает время штрихов), для чужих — по ходу рисования, потому что игра время не передаёт.'),
      UI.row('Автовоспроизведение', 'Запускать сразу после открытия', UI.bind('player', 'autoplay', 'switch')),
      UI.row('Открывать двойным кликом', null, UI.bind('player', 'openOnDblClick', 'switch')),
      UI.sec('Сохранённые процессы'),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn primary', onclick: () => file.click() }, 'Открыть процесс (.json)'), file),
    );
  }

  generalTab() {
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    file.addEventListener('change', async () => {
      try {
        Settings.importAll(JSON.parse(await file.files[0].text()));
        applyTheme();
        toast('Настройки импортированы. Часть изменений применится после перезагрузки страницы.');
        this.show(this.current);
      } catch (e) { toast('Ошибка импорта: ' + e.message, 4000); }
      file.value = '';
    });
    return h('div', {},
      UI.sec('Оформление'),
      UI.row('Акцентный цвет', null, UI.color(Settings.get('ui', 'accent'), v => { Settings.set('ui', 'accent', v); applyTheme(); })),
      UI.row('Непрозрачность панелей', null, UI.slider(Settings.get('ui', 'panelOpacity'), { min: 0.6, max: 1, step: 0.02 }, v => { Settings.set('ui', 'panelOpacity', v); applyTheme(); })),
      UI.sec('Размер интерфейса игры'),
      UI.row('Фиксированный размер', 'Игра не меняет размер вместе с окном браузера — удобно рисовать с референса на одном мониторе', UI.bind('ui', 'fixedSize', 'switch')),
      UI.row('Масштаб', null, UI.bind('ui', 'fixedScale', 'slider', { min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' })),
      UI.sec('Настройки'),
      h('div', { class: 'gpp-note' }, 'Файл содержит все настройки, клавиши и ваши палитры.'),
      h('div', { class: 'gpp-btns' },
        h('button', { class: 'gpp-btn', onclick: () => downloadBlob(new Blob([JSON.stringify(Settings.exportAll(), null, 2)], { type: 'application/json' }), 'gartic-phone-plus-settings.json') }, 'Экспорт'),
        h('button', { class: 'gpp-btn', onclick: () => file.click() }, 'Импорт'), file,
        h('button', { class: 'gpp-btn danger', onclick: async () => {
          if (!(await confirmDialog('Сбросить всё?', 'Настройки, клавиши и положение окон вернутся к исходным. Ваши палитры сохранятся.', 'Сбросить'))) return;
          Object.keys(DEFAULTS).forEach(k => Settings.reset(k)); Hotkeys.resetAll(); applyTheme(); this.show(this.current); toast('Сброшено');
        } }, 'Сбросить всё')),
      UI.sec('О скрипте'),
      h('div', { class: 'gpp-note' }, 'Gartic Phone Plus 1.2. Весь код находится внутри этого файла: скрипт не подгружает внешний код, не собирает аналитику и не отправляет ваши данные на сторонние серверы. Сеть используется только для поиска референсов по вашему запросу.'),
      h('div', { class: 'gpp-note' }, 'Состояние: ' + (Net.connected ? 'подключено к игре' : 'ожидание подключения к комнате')),
    );
  }
})();

/* ───────────────────────────── Запуск ───────────────────────────── */

Net.install();
Hotkeys.enabled = () => Painter.active && !Painter.locked;
Hotkeys.install();

onReady(() => {
  injectCss(CSS, 'gpp-css');
  applyTheme();
  Layer.init();
  Layout.init();
  Painter.init();
  Reference.init();
  Timelapse.init();
  Menu.init();
  if (Net.state.screen === SCREEN.DRAW) Painter.scheduleAttach();
  if (W.__gpPlusDebug) W.__gpPlus = { Net, Painter, Hotkeys, Settings, Reference, Timelapse, Menu };
  console.log('[GP+] Gartic Phone Plus 1.2 загружен');
});

})();
