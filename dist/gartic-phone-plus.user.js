// ==UserScript==
// @name         Gartic Phone Plus
// @namespace    https://github.com/Prot1vn1kk
// @version      1.1.0
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
    hideHeader: false,
    showCursor: true,
  },
  reference: {
    engine: 'google',
    googleSafe: 'active',
    frameOpacity: 1,
    stickyEdges: true,
  },
  player: {
    autoplay: true,
    openOnDblClick: true,
    speed: 1,
  },
  ui: {
    accent: '#5bffb6',
    panelOpacity: 1,
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
    this.emit('attach');
  }

  detach() {
    this.attachToken = null;
    if (!this.active) return;
    this.active = false;
    this.cancelStroke();
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
    // offsetWidth не зависит от CSS-трансформаций (у экрана игры есть анимация появления со scale)
    this.dpr = window.devicePixelRatio || 1;
    this.cw = this.stage.offsetWidth; this.ch = this.stage.offsetHeight;
    this.viewCanvas.width = Math.max(1, round(this.cw * this.dpr));
    this.viewCanvas.height = Math.max(1, round(this.ch * this.dpr));
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
    const c = this.vctx, dpr = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.viewCanvas.width, this.viewCanvas.height);
    const m = this.matrix();
    c.setTransform(new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiply(m));
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
    this.current = { tool, style, raw: [ip], smooth: [ip], start: ip, end: ip, strokes: [], ids: [] };
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
    this.commit({ ids: cur.ids, strokes: cur.strokes });
  }

  cancelStroke() {
    if (!this.current) return;
    const cur = this.current;
    this.current = null;
    if (cur.tool === TOOL.PEN || cur.tool === TOOL.ERASER) this.commit({ ids: cur.ids, strokes: cur.strokes });
    this.render();
  }

  commit(group) {
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
    if (!(await confirmDialog('Очистить холст?', 'Все ваши штрихи этого хода будут отменены. Вернуть их будет нельзя.', 'Очистить'))) return;
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
.gpp-swgrid{display:grid;grid-template-columns:repeat(5,18px);justify-content:space-between;gap:5px 0;max-height:118px;overflow-y:auto;padding:2px 2px 2px 1px;margin:0 -2px 0 -1px}
.gpp-swgrid::-webkit-scrollbar{width:4px}.gpp-swgrid::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:4px}
.gpp-col .gpp-sw{width:18px;height:18px;border-radius:4px;border:1px solid rgb(67,17,31);box-shadow:0 0 0 1.5px #fff;cursor:pointer}
.gpp-col .gpp-sw:hover{transform:scale(1.12)}
.gpp-col .gpp-sw.sel{box-shadow:0 0 0 2.5px var(--gpp-accent)}
.gpp-recent{grid-template-columns:repeat(5,18px);max-height:none}
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
    this.palName = Store.get('palette.current', 'Gartic');
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
    this.c1 = h('span', { class: 'c1' }); this.c2 = h('span', { class: 'c2' });
    this.hex = h('input', { class: 'gpp-hex', maxlength: 7, spellcheck: 'false', title: 'HEX-код цвета' });
    this.hex.addEventListener('change', () => p.setColor(this.hex.value.startsWith('#') ? this.hex.value : '#' + this.hex.value));
    this.cp = new ColorPicker({ width: 111, height: 78 });
    this.cp.on('input', hex => p.setColor(hex, false));
    this.cp.on('commit', hex => p.pushRecent(hex));
    this.size = h('input', { type: 'range', min: 1, step: 1, title: 'Толщина кисти' });
    this.size.addEventListener('input', () => p.setThickness(+this.size.value));
    this.sizeVal = h('b');
    this.palSel = h('select', { title: 'Палитра' });
    this.palSel.addEventListener('change', () => { this.palName = this.palSel.value; Store.set('palette.current', this.palName); this.refresh(); });
    const file = h('input', { type: 'file', accept: '.aco,.gpl,.txt,.hex', style: { display: 'none' } });
    file.addEventListener('change', () => this.importPalette(file.files[0]).finally(() => (file.value = '')));
    this.palGrid = h('div', { class: 'gpp-swgrid' });
    this.recentGrid = h('div', { class: 'gpp-swgrid gpp-recent' });
    return this.stop(h('div', { class: 'gpp-col gpp-left gpp' },
      h('div', { class: 'gpp-colhead' },
        h('div', { class: 'gpp-pair', title: 'Основной / дополнительный цвет (ПКМ рисует дополнительным). Клик — поменять (X)', onclick: () => p.swapColors() }, this.c1, this.c2),
        this.hex),
      this.cp.el,
      h('div', { class: 'gpp-rangebox', title: 'Толщина кисти ([ и ])' }, this.size, this.sizeVal),
      h('div', { class: 'gpp-sep' }),
      h('div', { class: 'gpp-palbar' }, this.palSel,
        h('button', { title: 'Добавить текущий цвет в «Мои цвета»', html: ICON.plus, onclick: () => this.addToMine() }),
        h('button', { title: 'Импорт палитры (.aco, .gpl, .txt)', html: ICON.download, style: { transform: 'rotate(180deg)' }, onclick: () => file.click() }),
        file),
      this.palGrid,
      h('div', { class: 'gpp-sep' }),
      this.recentGrid));
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
    return { Gartic: this.gamePalette.length ? this.gamePalette : BUILTIN_PALETTES['Базовая'], ...BUILTIN_PALETTES, 'Гармония': this.harmony(), ...this.palettes };
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
    this.c1.style.background = p.color;
    this.c2.style.background = p.color2;
    if (document.activeElement !== this.hex) this.hex.value = p.color;
    if (!this.cp.dragging) this.cp.set(p.color);
    this.size.max = Settings.get('painter', 'maxThickness');
    this.size.value = p.thickness;
    this.sizeVal.textContent = p.thickness;
    const all = this.allPalettes();
    if (!all[this.palName]) this.palName = 'Gartic';
    this.palSel.replaceChildren(...Object.keys(all).map(n => h('option', { value: n, selected: n === this.palName }, n)));
    const removable = !!this.palettes[this.palName];
    this.palGrid.replaceChildren(...all[this.palName].map(c => this.swatch(c, removable)));
    if (!all[this.palName].length) this.palGrid.append(h('div', { style: { gridColumn: '1 / -1', opacity: 0.75 } }, 'Пусто: «+» добавит текущий цвет'));
    this.recentGrid.replaceChildren(...p.recent.slice(0, 10).map(c => this.swatch(c)));
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
   Поиск идёт через открытые API (Wikimedia Commons, Openverse). Google и Pinterest открываются
   в новой вкладке: картинку оттуда можно перетащить, вставить (Ctrl+V) или добавить по ссылке.   */

const REF_CSS = `
.gpp-ref .gpp-dialog-body{display:flex;flex-direction:column;gap:10px}
.gpp-ref-bar{display:flex;gap:6px}
.gpp-ref-bar .gpp-input{flex:1;min-width:0}
.gpp-ref-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:start;min-height:120px}
.gpp-ref-grid img{width:100%;height:96px;object-fit:cover;border-radius:8px;cursor:pointer;background:var(--gpp-field);display:block;box-shadow:0 0 0 1.6px var(--gpp-head-hi)}
.gpp-ref-grid img:hover{outline:2px solid var(--gpp-accent)}
.gpp-ref-drop{border:2px dashed var(--gpp-head-hi);border-radius:10px;padding:10px;text-align:center;color:var(--gpp-dim);font:12px var(--gpp-f-reg)}
.gpp-ref.dragover .gpp-ref-drop{border-color:var(--gpp-accent);color:#fff}
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
    this.modal = new GameModal({ title: '<b>GP+</b> Референсы', width: 720, height: 620, className: 'gpp-ref' });
    this.modal.on('open', () => { Painter.ui?.refresh(); setTimeout(() => this.q.focus(), 50); });
    this.modal.on('close', () => Painter.ui?.refresh());
    const b = this.modal.body;
    this.q = h('input', { class: 'gpp-input', placeholder: 'Что ищем? Например: cat, лошадь, Eiffel tower' });
    this.q.addEventListener('keydown', e => { if (e.key === 'Enter') this.search(true); });
    this.engine = UI.select(Settings.get('reference', 'engine') in REF_ENGINES ? Settings.get('reference', 'engine') : 'commons',
      Object.entries(REF_ENGINES).map(([k, v]) => [k, v.name]), v => { Settings.set('reference', 'engine', v); this.search(true); });
    this.grid = h('div', { class: 'gpp-ref-grid' });
    this.grid.addEventListener('scroll', () => { if (this.grid.scrollTop + this.grid.clientHeight > this.grid.scrollHeight - 80) this.search(false); });
    this.status = h('div', { class: 'gpp-note', style: { margin: 0 } });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    file.addEventListener('change', () => { [...file.files].forEach(f => this.openImage(URL.createObjectURL(f), f.name, false)); file.value = ''; });
    const url = h('input', { class: 'gpp-input', placeholder: 'Ссылка на картинку' });
    url.addEventListener('keydown', e => { if (e.key === 'Enter' && url.value.trim()) { this.openImage(url.value.trim()); url.value = ''; } });
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

  open() { this.modal.open(); }
  close() { this.modal.close(); }
  toggle() { this.modal.toggle(); }
  isOpen() { return !!this.modal?.isOpen; }

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
        const img = h('img', { src: it.thumb, loading: 'lazy', referrerpolicy: 'no-referrer', title: `${it.w}×${it.h}`, onclick: e => { this.openImage(it.full, q); if (!e.shiftKey) this.close(); } });
        this.grid.append(img);
      }
      this.status.textContent = this.grid.children.length ? `Найдено: ${this.grid.children.length}${more ? '+' : ''}. Клик — открыть поверх игры, Shift+клик — открыть и выбрать ещё.` : 'Ничего не найдено. Попробуйте запрос на английском.';
    } catch (e) {
      this.status.textContent = `${eng.name}: ${e.message}. Попробуйте другой источник.`;
    } finally { this.loading = false; }
  }

  bindDrop() {
    const el = this.modal.dialog;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      if (files.length) return files.forEach(f => this.openImage(URL.createObjectURL(f), f.name, false));
      const html = e.dataTransfer.getData('text/html');
      const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1] || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (src && /^(https?:|data:image)/.test(src.trim())) this.openImage(src.trim().replace(/&amp;/g, '&'));
    });
  }

  onPaste(e) {
    if (isTyping(e) || !(this.isOpen() || Painter.active)) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); this.openImage(URL.createObjectURL(item.getAsFile()), 'Из буфера', false); return; }
    const text = e.clipboardData?.getData('text');
    if (text && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(text.trim())) { e.preventDefault(); this.openImage(text.trim()); }
  }

  openImage(src, title = 'Референс', persist = true) {
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
    return h('div', {},
      h('div', { class: 'gpp-note' }, 'Клавиши работают во время своего хода рисования. ЛКМ по клавише — переназначить, ПКМ — удалить, «+» — добавить ещё одно сочетание. Esc — отменить запись.'),
      Hotkeys.view());
  }

  refTab() {
    return h('div', {},
      UI.sec('Окно референсов'),
      h('div', { class: 'gpp-note' }, 'Поиск картинок прямо в игре и плавающие окна с референсами поверх холста. Открыть: клавиша P во время рисования или кнопка ниже.'),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn primary', onclick: () => { this.modal.close(); Reference.open(); } }, 'Открыть референсы')),
      UI.sec('Окна с картинками'),
      UI.row('Прозрачность по умолчанию', null, UI.bind('reference', 'frameOpacity', 'slider', { min: 0.1, max: 1, step: 0.05 })),
      h('div', { class: 'gpp-note' }, 'В окне картинки: колесо — масштаб, перетаскивание — сдвиг, двойной клик — вписать. Кнопка-булавка делает окно «прозрачным для мыши»: можно рисовать сквозь него.'),
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn danger', onclick: () => { [...Reference.frames].forEach(f => f.win.hide()); toast('Окна референсов закрыты'); } }, 'Закрыть все окна')),
    );
  }

  playerTab() {
    return h('div', {},
      UI.sec('Плеер процесса рисования'),
      h('div', { class: 'gpp-note' }, 'В альбоме на каждом рисунке появляется кнопка ▶. Также работает двойной клик или средняя кнопка мыши по рисунку. Плеер умеет сохранять PNG и записывать видео WebM.'),
      UI.row('Автовоспроизведение', 'Запускать сразу после открытия', UI.bind('player', 'autoplay', 'switch')),
      UI.row('Открывать двойным кликом', null, UI.bind('player', 'openOnDblClick', 'switch')),
      UI.row('Скорость по умолчанию', null, UI.bind('player', 'speed', 'select', { items: [[0.5, '×0.5'], [1, '×1'], [2, '×2'], [4, '×4'], [8, '×8']] })),
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
      h('div', { class: 'gpp-note' }, 'Gartic Phone Plus 1.1. Весь код находится внутри этого файла: скрипт не подгружает внешний код, не собирает аналитику и не отправляет ваши данные на сторонние серверы. Сеть используется только для поиска референсов по вашему запросу.'),
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
  Painter.init();
  Reference.init();
  Timelapse.init();
  Menu.init();
  if (Net.state.screen === SCREEN.DRAW) Painter.scheduleAttach();
  if (W.__gpPlusDebug) W.__gpPlus = { Net, Painter, Hotkeys, Settings, Reference, Timelapse, Menu };
  console.log('[GP+] Gartic Phone Plus 1.1 загружен');
});

})();
