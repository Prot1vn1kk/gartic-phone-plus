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
