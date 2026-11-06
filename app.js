'use strict';

const STORAGE_KEY = 'kintore-menus-v1';
const MAX_NAME_LENGTH = 50;

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
};

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

function renderDay(day, { focusInput = false, draft = '', notice = '' } = {}) {
  const menus = state[day.id];
  const input = el('input', {
    className: 'add-input',
    type: 'text',
    placeholder: '例：ベンチプレス',
    maxLength: MAX_NAME_LENGTH,
    enterKeyHint: 'next',
    autocomplete: 'off',
    ariaLabel: 'メニュー名',
    value: draft,
  });

  const form = el('form', { className: 'add-form' },
    input,
    el('button', { className: 'add-button', type: 'submit', textContent: '追加' }));

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
  if (saveFailed) {
    main.append(el('p', {
      className: 'error',
      role: 'alert',
      textContent: '保存できませんでした。この内容はアプリを閉じると消える可能性があります。',
    }));
  }
  main.append(form);
  if (notice) main.append(el('p', { className: 'notice', role: 'status', textContent: notice }));

  if (menus.length) {
    main.append(el('ul', { className: 'menus' }, ...menus.map((menu) => menuRow(day, menu))));
  } else {
    main.append(el('p', { className: 'empty', textContent: 'まだメニューがありません' }));
  }

  app.replaceChildren(header(`${day.label}曜日のメニュー`, '#/'), main);
  document.title = `${day.label}曜日のメニュー`;
  if (focusInput) input.focus();
}

function menuRow(day, menu) {
  const button = el('button', {
    className: 'delete',
    type: 'button',
    innerHTML: ICONS.trash,
    ariaLabel: `${menu.name}を削除`,
  });
  button.addEventListener('click', () => {
    if (!window.confirm(`「${menu.name}」を削除しますか？`)) return;
    state[day.id] = state[day.id].filter((item) => item.id !== menu.id);
    saveMenus();
    renderDay(day, { draft: app.querySelector('.add-input').value });
  });
  return el('li', { className: 'menu' },
    el('span', { className: 'menu-name', textContent: menu.name }),
    button);
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
