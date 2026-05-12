// JAVIS 달력 — main.js
// 음력(Intl), 공휴일, 메모(localStorage), D-Day(localStorage)

// ── Storage keys ─────────────────────────────────────────────
const MEMO_KEY  = 'javis_cal_memos';   // { "2026-05-13": "text" }
const DDAY_KEY  = 'javis_cal_ddays';   // [{id, title, date, color}]

function loadMemos()  { try { return JSON.parse(localStorage.getItem(MEMO_KEY) || '{}'); } catch { return {}; } }
function saveMemos(m) { localStorage.setItem(MEMO_KEY, JSON.stringify(m)); }
function loadDdays()  { try { return JSON.parse(localStorage.getItem(DDAY_KEY) || '[]'); } catch { return []; } }
function saveDdays(d) { localStorage.setItem(DDAY_KEY, JSON.stringify(d)); }

// ── Lunar calendar (browser Intl, no lib) ───────────────────
const lunarFmt = new Intl.DateTimeFormat('ko-KR-u-ca-chinese', { month: 'numeric', day: 'numeric' });

function getLunar(date) {
  try {
    const parts = lunarFmt.formatToParts(date);
    const m = parseInt(parts.find(p => p.type === 'month')?.value ?? '0');
    const d = parseInt(parts.find(p => p.type === 'day')?.value ?? '0');
    return { month: m, day: d };
  } catch { return { month: 0, day: 0 }; }
}

function lunarStr(date) {
  const { month, day } = getLunar(date);
  if (!month) return '';
  return day === 1 ? `음 ${month}월` : `음 ${day}`;
}

// ── Solar holidays ────────────────────────────────────────────
const SOLAR_HOL = {
  '1-1':   '신정',
  '3-1':   '삼일절',
  '5-5':   '어린이날',
  '6-6':   '현충일',
  '8-15':  '광복절',
  '10-3':  '개천절',
  '10-9':  '한글날',
  '12-25': '크리스마스',
};

// ── Lunar holidays (computed per year) ───────────────────────
const lunarHolCache = {};

function buildLunarHols(year) {
  if (lunarHolCache[year]) return lunarHolCache[year];
  const result = {};
  const end = new Date(year + 1, 0, 1);
  for (let d = new Date(year, 0, 1); d < end; d.setDate(d.getDate() + 1)) {
    const { month, day } = getLunar(d);
    const key = `${d.getMonth() + 1}-${d.getDate()}`;
    // 설날: 음 1/1 + 전날(섣달그믐) + 다음날
    if (month === 1 && day === 1) {
      result[key] = '설날';
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      result[`${prev.getMonth()+1}-${prev.getDate()}`] = '설날 연휴';
      result[`${next.getMonth()+1}-${next.getDate()}`] = '설날 연휴';
    }
    // 추석: 음 8/15 + 전날 + 다음날
    if (month === 8 && day === 15) {
      result[key] = '추석';
      const prev = new Date(d); prev.setDate(prev.getDate() - 1);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      result[`${prev.getMonth()+1}-${prev.getDate()}`] = '추석 연휴';
      result[`${next.getMonth()+1}-${next.getDate()}`] = '추석 연휴';
    }
    // 부처님오신날: 음 4/8
    if (month === 4 && day === 8) result[key] = '부처님오신날';
  }
  lunarHolCache[year] = result;
  return result;
}

// ── State ─────────────────────────────────────────────────────
const today = new Date();
let viewYear  = today.getFullYear();
let viewMonth = today.getMonth(); // 0-based

// ── DOM refs ──────────────────────────────────────────────────
const calTitle   = document.getElementById('calTitle');
const calGrid    = document.getElementById('calGrid');
const ddayList   = document.getElementById('ddayList');
const memoModal  = document.getElementById('memoModal');
const memoDateEl = document.getElementById('memoDate');
const memoLunar  = document.getElementById('memoLunar');
const memoText   = document.getElementById('memoText');
const ddayModal  = document.getElementById('ddayModal');
const ddayModalTitle = document.getElementById('ddayModalTitle');
const ddayTitleInput = document.getElementById('ddayTitleInput');
const ddayDateInput  = document.getElementById('ddayDateInput');
const ddayColorInput = document.getElementById('ddayColor');
const ddayDeleteBtn  = document.getElementById('ddayDeleteItem');

// ── Helpers ───────────────────────────────────────────────────
function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function todayKey() { return dateKey(today.getFullYear(), today.getMonth(), today.getDate()); }

function getHoliday(y, m1, d) {
  // m1 = 1-based month
  const solarKey = `${m1}-${d}`;
  if (SOLAR_HOL[solarKey]) return SOLAR_HOL[solarKey];
  const lunarHols = buildLunarHols(y);
  return lunarHols[solarKey] ?? null;
}

// ── Calendar render ───────────────────────────────────────────
function renderCalendar() {
  const memos = loadMemos();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

  calTitle.textContent = `${viewYear}년 ${viewMonth + 1}월`;
  calGrid.innerHTML = '';

  // Total cells: 6 rows × 7 cols = 42
  for (let i = 0; i < 42; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';

    let cellDate, isOther = false;
    if (i < firstDay) {
      // Previous month
      const d = daysInPrev - firstDay + 1 + i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cellDate = new Date(y, m, d);
      isOther = true;
      cell.classList.add('other-month');
    } else if (i - firstDay < daysInMonth) {
      cellDate = new Date(viewYear, viewMonth, i - firstDay + 1);
    } else {
      // Next month
      const d = i - firstDay - daysInMonth + 1;
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      cellDate = new Date(y, m, d);
      isOther = true;
      cell.classList.add('other-month');
    }

    const dow = cellDate.getDay();
    if (dow === 0) cell.classList.add('sun-col');
    if (dow === 6) cell.classList.add('sat-col');

    const cy = cellDate.getFullYear();
    const cm = cellDate.getMonth(); // 0-based
    const cd = cellDate.getDate();
    const key = dateKey(cy, cm, cd);

    if (key === todayKey()) cell.classList.add('today');

    // Holiday
    const hol = getHoliday(cy, cm + 1, cd);
    if (hol) cell.classList.add('holiday');

    // Solar date
    const solar = document.createElement('div');
    solar.className = 'cell-solar';
    solar.textContent = cd;
    cell.appendChild(solar);

    // Lunar
    const lunar = document.createElement('div');
    lunar.className = 'cell-lunar';
    lunar.textContent = lunarStr(cellDate);
    cell.appendChild(lunar);

    // Holiday name
    if (hol) {
      const holEl = document.createElement('div');
      holEl.className = 'cell-holiday-name';
      holEl.textContent = hol;
      cell.appendChild(holEl);
    }

    // Memo dot
    if (memos[key]) {
      const dot = document.createElement('div');
      dot.className = 'memo-dot';
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => openMemoModal(cellDate, key));
    calGrid.appendChild(cell);
  }
}

// ── Memo modal ────────────────────────────────────────────────
let activeMemoKey = null;

function openMemoModal(date, key) {
  activeMemoKey = key;
  const memos = loadMemos();
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  memoDateEl.textContent = `${y}년 ${m+1}월 ${d}일 (${['일','월','화','수','목','금','토'][date.getDay()]})`;
  const lun = getLunar(date);
  memoLunar.textContent = lun.month ? `음력 ${lun.month}월 ${lun.day}일` : '';
  memoText.value = memos[key] ?? '';
  memoModal.hidden = false;
  memoText.focus();
}

document.getElementById('memoSave').addEventListener('click', () => {
  if (!activeMemoKey) return;
  const memos = loadMemos();
  const txt = memoText.value.trim();
  if (txt) memos[activeMemoKey] = txt;
  else delete memos[activeMemoKey];
  saveMemos(memos);
  memoModal.hidden = true;
  renderCalendar();
});

document.getElementById('memoDelete').addEventListener('click', () => {
  if (!activeMemoKey) return;
  const memos = loadMemos();
  delete memos[activeMemoKey];
  saveMemos(memos);
  memoModal.hidden = true;
  renderCalendar();
});

document.getElementById('memoClose').addEventListener('click', () => { memoModal.hidden = true; });

memoModal.addEventListener('click', e => { if (e.target === memoModal) memoModal.hidden = true; });

// ── D-Day panel ───────────────────────────────────────────────
function renderDdays() {
  const ddays = loadDdays();
  if (!ddays.length) {
    ddayList.innerHTML = '<div class="dday-empty">D-Day를 추가해 보세요!</div>';
    return;
  }
  ddayList.innerHTML = '';
  ddays.forEach(dd => {
    const target = new Date(dd.date + 'T00:00:00');
    const diff = Math.round((target - new Date(todayKey() + 'T00:00:00')) / 86400000);
    let countStr, countClass = '';
    if (diff > 0) { countStr = `D-${diff}`; }
    else if (diff === 0) { countStr = 'D-Day!'; countClass = 'today-mark'; }
    else { countStr = `+${Math.abs(diff)}일 지남`; countClass = 'past'; }

    const card = document.createElement('div');
    card.className = 'dday-card';
    card.style.borderLeftColor = dd.color ?? '#7c3aed';
    card.innerHTML = `
      <div class="dday-card-title">${dd.title}</div>
      <div class="dday-card-date">${dd.date.replace(/-/g,'.')}</div>
      <div class="dday-card-count ${countClass}">${countStr}</div>
    `;
    card.addEventListener('click', () => openDdayModal(dd));
    ddayList.appendChild(card);
  });
}

// ── D-Day modal ───────────────────────────────────────────────
let activeDdayId = null;

function openDdayModal(dd = null) {
  if (dd) {
    activeDdayId = dd.id;
    ddayModalTitle.textContent = 'D-Day 수정';
    ddayTitleInput.value = dd.title;
    ddayDateInput.value  = dd.date;
    ddayColorInput.value = dd.color ?? '#7c3aed';
    ddayDeleteBtn.hidden = false;
  } else {
    activeDdayId = null;
    ddayModalTitle.textContent = 'D-Day 추가';
    ddayTitleInput.value = '';
    ddayDateInput.value  = todayKey();
    ddayColorInput.value = '#7c3aed';
    ddayDeleteBtn.hidden = true;
  }
  ddayModal.hidden = false;
  ddayTitleInput.focus();
}

document.getElementById('addDday').addEventListener('click', () => openDdayModal());

document.getElementById('ddaySave').addEventListener('click', () => {
  const title = ddayTitleInput.value.trim();
  const date  = ddayDateInput.value;
  const color = ddayColorInput.value;
  if (!title || !date) return;
  const ddays = loadDdays();
  if (activeDdayId) {
    const idx = ddays.findIndex(d => d.id === activeDdayId);
    if (idx !== -1) ddays[idx] = { id: activeDdayId, title, date, color };
  } else {
    ddays.push({ id: Date.now().toString(36), title, date, color });
  }
  saveDdays(ddays);
  ddayModal.hidden = true;
  renderDdays();
});

document.getElementById('ddayDeleteItem').addEventListener('click', () => {
  if (!activeDdayId) return;
  const ddays = loadDdays().filter(d => d.id !== activeDdayId);
  saveDdays(ddays);
  ddayModal.hidden = true;
  renderDdays();
});

document.getElementById('ddayClose').addEventListener('click', () => { ddayModal.hidden = true; });
ddayModal.addEventListener('click', e => { if (e.target === ddayModal) ddayModal.hidden = true; });

// ── Nav buttons ───────────────────────────────────────────────
document.getElementById('prevMonth').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
document.getElementById('todayBtn').addEventListener('click', () => {
  viewYear  = today.getFullYear();
  viewMonth = today.getMonth();
  renderCalendar();
});

// ── Init ──────────────────────────────────────────────────────
renderCalendar();
renderDdays();
