/* ───────────────────────────── Главное меню ───────────────────────────── */

const Menu = new (class {
  init() {
    this.fab = h('button', { class: 'gpp-fab gpp', title: 'Gartic Phone Plus', onclick: () => this.toggle() }, h('i', {}, '+'), 'GP+');
    document.body.append(this.fab);
    this.win = new Win({ id: 'menu', title: '<b>Gartic Phone Plus</b> 1.0', width: 440, height: 560, x: window.innerWidth - 470, y: window.innerHeight - 640, resizable: true });
    this.win.body.style.padding = '0';
    this.tabsEl = h('div', { class: 'gpp-tabs' });
    this.content = h('div', { class: 'gpp-win-body' });
    this.win.body.style.display = 'flex';
    this.win.body.style.flexDirection = 'column';
    this.win.body.append(this.tabsEl, this.content);
    this.tabs = [
      ['Рисование', () => this.painterTab()],
      ['Клавиши', () => this.keysTab()],
      ['Референсы', () => this.refTab()],
      ['Таймлапс', () => this.playerTab()],
      ['Общее', () => this.generalTab()],
    ];
    this.current = Store.get('menu.tab', 0);
    this.renderTabs();
  }

  toggle() { this.win.toggle(); if (this.win.visible) this.open(this.current); }

  renderTabs() {
    this.tabsEl.replaceChildren(...this.tabs.map(([name], i) => h('button', { class: 'gpp-tab' + (i === this.current ? ' on' : ''), onclick: () => this.open(i) }, name)));
  }

  open(i) {
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
      UI.row('Панель «Студия» в начале хода', 'Цвет, палитры, кисть, симметрия и вид. Клавиша H', B('studioOpen', 'switch')),
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
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn', onclick: () => { Settings.reset('painter'); this.open(this.current); toast('Настройки рисования сброшены'); } }, 'Сбросить раздел')),
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
      h('div', { class: 'gpp-btns' }, h('button', { class: 'gpp-btn primary', onclick: () => Reference.win.show() }, 'Открыть референсы')),
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
        this.open(this.current);
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
          Object.keys(DEFAULTS).forEach(k => Settings.reset(k)); Hotkeys.resetAll(); applyTheme(); this.open(this.current); toast('Сброшено');
        } }, 'Сбросить всё')),
      UI.sec('О скрипте'),
      h('div', { class: 'gpp-note' }, 'Gartic Phone Plus 1.0. Весь код находится внутри этого файла: скрипт не подгружает внешний код, не собирает аналитику и не отправляет ваши данные на сторонние серверы. Сеть используется только для поиска референсов по вашему запросу.'),
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
  if (W.__gpPlusDebug) W.__gpPlus = { Net, Painter, Hotkeys, Settings, Reference, Timelapse };
  console.log('[GP+] Gartic Phone Plus 1.0 загружен');
});

})();
