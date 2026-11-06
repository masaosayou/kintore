'use strict';

const STORAGE_KEY = 'kintore-menus-v1';
const MAX_NAME_LENGTH = 50;
const MAX_WEIGHT_LENGTH = 10;
const MAX_VOLUME_LENGTH = 30;

// 表示順は月曜始まり。index は Date#getDay() の値。
const DAYS = [
  { id: 'mon', label: '月', index: 1 },
  { id: 'tue', label: '火', index: 2 },
  { id: 'wed', label: '水', index: 3 },
  { id: 'thu', label: '木', index: 4 },
  { id: 'fri', label: '金', index: 5 },
  { id: 'sat', label: '土', index: 6 },
  { id: 'sun', label: '日', index: 0 },
];

const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chevron: '<svg class="day-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg>',
};

// ドラッグ中に指が画面の上下端へ近づいたら自動でスクロールする
const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_SPEED = 6;
const DRAG_START_DISTANCE = 10;

const app = document.getElementById('app');
const state = loadMenus();
let saveFailed = false;

function emptyMenus() {
  return Object.fromEntries(DAYS.map((day) => [day.id, []]));
}

function loadMenus() {
  const menus = emptyMenus();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    for (const day of DAYS) {
      if (!Array.isArray(saved?.[day.id])) continue;
      menus[day.id] = saved[day.id].filter(
        (menu) => typeof menu?.id === 'string' && typeof menu?.name === 'string'
      );
    }
  } catch {
    // 保存データが読めない場合は空の状態で始める
  }
  return menus;
}

function saveMenus() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function header(title, backHref) {
  const inner = el('div', { className: 'header-inner' });
  if (backHref) {
    inner.append(el('a', {
      className: 'back',
      href: backHref,
      innerHTML: ICONS.back,
      ariaLabel: '曜日の選択に戻る',
    }));
  }
  inner.append(el('h1', { className: 'title', textContent: title }));
  return el('header', { className: 'header' }, inner);
}

function renderTop() {
  const todayIndex = new Date().getDay();
  const items = DAYS.map((day) => {
    const count = state[day.id].length;
    const isToday = day.index === todayIndex;
    const name = el('span', { className: 'day-name', textContent: `${day.label}曜日` });
    if (isToday) name.append(el('span', { className: 'badge', textContent: '今日' }));

    const link = el('a', {
      className: `day${isToday ? ' day-today' : ''}`,
      href: `#/day/${day.id}`,
    },
    el('span', { className: 'day-mark', textContent: day.label, ariaHidden: 'true' }),
    name,
    el('span', { className: 'day-count', textContent: count ? `${count}種目` : '未登録' }));
    link.insertAdjacentHTML('beforeend', ICONS.chevron);
    return el('li', {}, link);
  });

  const main = el('main', { className: 'content' });
  // iPhoneのSafariとホーム画面のアプリではデータが共有されない
  if (navigator.standalone === false) {
    main.append(el('p', {
      className: 'hint',
      textContent: 'ホーム画面に追加してから登録してください。Safariとホーム画面のアプリでは、データが別々に保存されます。',
    }));
  }
  main.append(
    el('p', { className: 'lead', textContent: '曜日を選んでください' }),
    el('ul', { className: 'days' }, ...items)
  );

  app.replaceChildren(header('筋トレメニュー'), main);
  document.title = '筋トレメニュー';
}

function saveErrorBanner() {
  return el('p', {
    className: 'error',
    role: 'alert',
    textContent: '保存できませんでした。この内容はアプリを閉じると消える可能性があります。',
  });
}

// 再描画しない入力欄でも、保存の失敗と回復をその場で表示に反映する
function syncSaveError() {
  const banner = app.querySelector('.error');
  if (saveFailed && !banner) {
    app.querySelector('main').prepend(saveErrorBanner());
  } else if (!saveFailed && banner) {
    banner.remove();
  }
}

function currentDraft() {
  return app.querySelector('.add-input')?.value ?? '';
}

function renderDay(day, { focusInput = false, draft = '', notice = '', editingId = null } = {}) {
  const menus = state[day.id];
  const isEditing = editingId !== null;
  const input = el('input', {
    className: 'add-input',
    type: 'text',
    placeholder: '例：ベンチプレス',
    maxLength: MAX_NAME_LENGTH,
    enterKeyHint: 'next',
    autocomplete: 'off',
    ariaLabel: 'メニュー名',
    value: draft,
    disabled: isEditing,
  });

  const form = el('form', { className: 'add-form' },
    input,
    el('button', { className: 'add-button', type: 'submit', textContent: '追加', disabled: isEditing }));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.value = '';
      input.focus();
      return;
    }
    menus.push({ id: newId(), name });
    saveMenus();
    // 続けて追加するとキーボードの裏に行が隠れるので、入力欄のそばで知らせる
    renderDay(day, { focusInput: true, notice: `「${name}」を追加しました（${menus.length}種目）` });
  });

  const main = el('main', { className: 'content' });
  if (saveFailed) main.append(saveErrorBanner());
  main.append(form);
  if (notice) main.append(el('p', { className: 'notice', role: 'status', textContent: notice }));

  if (menus.length) {
    main.append(el('ul', { className: 'menus' },
      ...menus.map((menu, index) => menuRow(day, menu, index, editingId))));
  } else {
    main.append(el('p', { className: 'empty', textContent: 'まだメニューがありません' }));
  }

  // 修正中は戻るリンクも隠し、保存かキャンセルを選んでもらう
  app.replaceChildren(header(`${day.label}曜日のメニュー`, isEditing ? null : '#/'), main);
  document.title = `${day.label}曜日のメニュー`;
  if (focusInput) input.focus();
  app.querySelector('.edit-input')?.focus();
}

function menuNumber(index) {
  return el('span', { className: 'menu-number', textContent: String(index + 1) });
}

function menuField(menu, { key, label, unit, inputMode, placeholder, maxLength, disabled }) {
  const input = el('input', {
    className: 'field-input',
    type: 'text',
    inputMode,
    placeholder,
    maxLength,
    disabled,
    enterKeyHint: 'done',
    autocomplete: 'off',
    value: menu[key] ?? '',
  });
  // 描き直しで入力中の欄が消えないよう、再描画せずに保存だけ行う
  input.addEventListener('input', () => {
    menu[key] = input.value;
    saveMenus();
    syncSaveError();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) input.blur();
  });

  const box = el('span', { className: 'field-box' }, input);
  if (unit) box.append(el('span', { className: 'field-unit', textContent: unit }));
  return el('label', { className: 'field' }, el('span', { className: 'field-label', textContent: label }), box);
}

function menuFields(menu, disabled) {
  return el('div', { className: 'menu-fields' },
    menuField(menu, {
      key: 'weight',
      label: 'ウェイト',
      unit: 'kg',
      inputMode: 'decimal',
      placeholder: '0',
      maxLength: MAX_WEIGHT_LENGTH,
      disabled,
    }),
    menuField(menu, {
      key: 'volume',
      label: 'ボリューム',
      inputMode: 'text',
      placeholder: '10回×3セット',
      maxLength: MAX_VOLUME_LENGTH,
      disabled,
    }));
}

function menuRow(day, menu, index, editingId) {
  if (menu.id === editingId) return editRow(day, menu, index);

  const name = el('span', { className: 'menu-name', textContent: menu.name });
  // 修正中は他の行を操作できないようにして、入力中の内容を失わないようにする
  if (editingId !== null) {
    return el('li', { className: 'menu menu-locked' }, menuNumber(index), name, menuFields(menu, true));
  }

  const handle = el('button', {
    className: 'menu-action handle',
    type: 'button',
    innerHTML: ICONS.grip,
    ariaLabel: `${menu.name}を並び替え`,
  });
  const editButton = el('button', {
    className: 'menu-action edit',
    type: 'button',
    innerHTML: ICONS.pencil,
    ariaLabel: `${menu.name}を修正`,
  });
  const deleteButton = el('button', {
    className: 'menu-action delete',
    type: 'button',
    innerHTML: ICONS.trash,
    ariaLabel: `${menu.name}を削除`,
  });

  editButton.addEventListener('click', () => {
    renderDay(day, { draft: currentDraft(), editingId: menu.id });
  });
  deleteButton.addEventListener('click', () => {
    if (!window.confirm(`「${menu.name}」を削除しますか？`)) return;
    state[day.id] = state[day.id].filter((item) => item.id !== menu.id);
    saveMenus();
    renderDay(day, { draft: currentDraft() });
  });

  const row = el('li', { className: 'menu' },
    handle, menuNumber(index), name, editButton, deleteButton, menuFields(menu, false));
  handle.addEventListener('pointerdown', (event) => startDrag(event, day, row, handle));
  // touch-action が効かない場合でも、つまみの操作で画面がスクロールしないようにする
  handle.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  return row;
}

function editRow(day, menu, index) {
  const draft = currentDraft();
  const input = el('input', {
    className: 'edit-input',
    type: 'text',
    value: menu.name,
    maxLength: MAX_NAME_LENGTH,
    enterKeyHint: 'done',
    autocomplete: 'off',
    ariaLabel: 'メニュー名を修正',
  });
  const cancel = el('button', { className: 'edit-cancel', type: 'button', textContent: '取消' });
  cancel.addEventListener('click', () => renderDay(day, { draft }));

  const form = el('form', { className: 'edit-form' },
    input,
    el('div', { className: 'edit-buttons' },
      cancel,
      el('button', { className: 'add-button', type: 'submit', textContent: '保存' })));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.value = '';
      input.focus();
      return;
    }
    menu.name = name;
    saveMenus();
    renderDay(day, { draft });
  });

  return el('li', { className: 'menu menu-editing' }, menuNumber(index), form, menuFields(menu, true));
}

function startDrag(event, day, row, handle) {
  const list = row.parentElement;
  if (event.button !== 0 || list.classList.contains('is-dragging')) return;
  event.preventDefault();

  const rows = [...list.children];
  const from = rows.indexOf(row);
  const centers = rows.map((item) => {
    const rect = item.getBoundingClientRect();
    return rect.top + window.scrollY + rect.height / 2;
  });
  const rowRect = row.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const minOffset = listRect.top - rowRect.top;
  const maxOffset = listRect.bottom - rowRect.bottom;
  const startPageY = event.clientY + window.scrollY;
  const startY = event.clientY;
  const draft = currentDraft();
  const notice = app.querySelector('.notice')?.textContent ?? '';
  const listeners = new AbortController();
  let pointerY = startY;
  let target = from;
  let frame = 0;

  function update() {
    const offset = Math.min(maxOffset, Math.max(minOffset, pointerY + window.scrollY - startPageY));
    // 背の高い行でも端まで動かせるよう、中心ではなく進行方向の端で判定する
    const draggedTop = centers[from] + offset - rowRect.height / 2;
    const draggedBottom = draggedTop + rowRect.height;
    target = from;
    rows.forEach((item, index) => {
      if (index === from) return;
      let shift = 0;
      if (index < from && draggedTop < centers[index]) {
        shift = rowRect.height;
        target -= 1;
      } else if (index > from && draggedBottom > centers[index]) {
        shift = -rowRect.height;
        target += 1;
      }
      item.style.transform = shift ? `translateY(${shift}px)` : '';
    });
    row.style.transform = `translateY(${offset}px)`;

    const order = rows.filter((item) => item !== row);
    order.splice(target, 0, row);
    order.forEach((item, index) => {
      item.querySelector('.menu-number').textContent = String(index + 1);
    });
  }

  function autoScroll() {
    const top = app.querySelector('.header').getBoundingClientRect().bottom + AUTO_SCROLL_EDGE;
    const viewport = window.visualViewport;
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const bottom = viewportBottom - AUTO_SCROLL_EDGE;
    // 押さえているだけでは動かさない。端へ向かって指を動かしたときだけスクロールする
    const movedUp = pointerY < startY - DRAG_START_DISTANCE;
    const movedDown = pointerY > startY + DRAG_START_DISTANCE;
    const speed = movedUp && pointerY < top ? -AUTO_SCROLL_SPEED
      : movedDown && pointerY > bottom ? AUTO_SCROLL_SPEED : 0;
    if (speed) {
      window.scrollBy(0, speed);
      update();
    }
    frame = requestAnimationFrame(autoScroll);
  }

  function finish(commit) {
    cancelAnimationFrame(frame);
    listeners.abort();
    if (!commit || target === from) {
      // 順番が変わらないときは描き直さず、入力欄のフォーカスや表示位置を保つ
      rows.forEach((item, index) => {
        item.style.transform = '';
        item.querySelector('.menu-number').textContent = String(index + 1);
      });
      row.classList.remove('dragging');
      list.classList.remove('is-dragging');
      return;
    }
    const menus = state[day.id];
    menus.splice(target, 0, ...menus.splice(from, 1));
    saveMenus();
    renderDay(day, { draft, notice });
  }

  const { signal } = listeners;
  handle.setPointerCapture(event.pointerId);
  handle.addEventListener('pointermove', (moveEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    pointerY = moveEvent.clientY;
    update();
  }, { signal });
  handle.addEventListener('pointerup', (upEvent) => {
    if (upEvent.pointerId === event.pointerId) finish(true);
  }, { signal });
  handle.addEventListener('pointercancel', (cancelEvent) => {
    if (cancelEvent.pointerId === event.pointerId) finish(false);
  }, { signal });

  list.classList.add('is-dragging');
  row.classList.add('dragging');
  frame = requestAnimationFrame(autoScroll);
}

function route() {
  const match = location.hash.match(/^#\/day\/(\w+)$/);
  const day = match && DAYS.find((item) => item.id === match[1]);
  if (day) {
    renderDay(day);
  } else {
    renderTop();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
// 日付をまたいで開きっぱなしでも「今日」の表示を合わせる
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !location.hash.startsWith('#/day/')) renderTop();
});
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
navigator.storage?.persist?.().catch(() => {});
