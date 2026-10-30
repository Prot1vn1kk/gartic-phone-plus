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
