/* ── JAVIS 달력 — main.js ─────────────────────────────────────────
   ES Module · No external dependencies
   Features: Lunar dates · Korean holidays · Memo (localStorage) · D-Day
──────────────────────────────────────────────────────────────────── */

/* ── Lunar date via Intl ────────────────────────────────────────── */
function getLunar(date) {
  try {
    const parts = new Intl.DateTimeFormat('ko-KR-u-ca-chinese', {
      month: 'numeric', day: 'numeric'
    }).formatToParts(date);
    const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '0');
    const day   = parseInt(parts.find(p => p.type === 'day')?.value   ?? '0');
    return { month, day };
  } catch {
    return { month: 0, day: 0 };
  }
}

/* ── Solar fixed holidays ───────────────────────────────────────── */
const SOLAR_HOLIDAYS = {
  '1-1':   '신정',
  '3-1':   '삼일절',
  '5-5':   '어린이날',
  '6-6':   '현충일',
  '8-15':  '광복절',
  '10-3':  '개천절',
  '10-9':  '한글날',
  '12-25': '크리스마스',
};

/* ── Lunar holidays (built per year) ───────────────────────────── */
const _lunarHolidayCache = {};

function buildLunarHolidays(year) {
  if (_lunarHolidayCache[year]) return _lunarHolidayCache[year];
  const result = {};
  const end = new Date(year + 1, 0, 1);
  for (let d = new Date(year, 0, 1); d < end; d.setDate(d.getDate() + 1)) {
    const { month, day } = getLunar(d);
    const key = `${d.getMonth() + 1}-${d.getDate()}`;

    // 설날: lunar 1/1 and ±1 day
    if (month === 1 && day === 1)  result[key] = '설날';
    if (month === 1 && day === 2)  result[key] = '설날 연휴';
    // day 0 of lunar 1/1 is the previous solar day
    if (month === 12 && day === 30) result[key] = '설날 전날';
    if (month === 1  && day === 29) {
      // edge: some years have no day 30 in 12월
      const tomorrow = new Date(d); tomorrow.setDate(tomorrow.getDate() + 1);
      const { month: nm, day: nd } = getLunar(tomorrow);
      if (nm === 1 && nd === 1) result[key] = '설날 전날';
    }

    // 추석: lunar 8/15 and ±1 day
    if (month === 8 && day === 14) result[key] = '추석 전날';
    if (month === 8 && day === 15) result[key] = '추석';
    if (month === 8 && day === 16) result[key] = '추석 연휴';

    // 부처님오신날: lunar 4/8
    if (month === 4 && day === 8)  result[key] = '부처님오신날';
  }
  _lunarHolidayCache[year] = result;
  return result;
}

/* ── Get all holidays for a given date key "M-D" ───────────────── */
function getHoliday(year, month1, day) {
  const key = `${month1}-${day}`;
  return SOLAR_HOLIDAYS[key] || buildLunarHolidays(year)[key] || null;
}

/* ── LocalStorage helpers ───────────────────────────────────────── */
const MEMO_KEY  = 'javis_cal_memos';
const DDAY_KEY  = 'javis_cal_ddays';

function loadMemos() {
  try { return JSON.parse(localStorage.getItem(MEMO_KEY) || '{}'); } catch { return {}; }
}
function saveMemos(obj) {
  try { localStorage.setItem(MEMO_KEY, JSON.stringify(obj)); } catch {}
}
function loadDdays() {
  try { return JSON.parse(localStorage.getItem(DDAY_KEY) || '[]'); } catch { return []; }
}
function saveDdays(arr) {
  try { localStorage.setItem(DDAY_KEY, JSON.stringify(arr)); } catch {}
}
function dateKey(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ── State ──────────────────────────────────────────────────────── */
const today = new Date();
let viewYear  = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed

/* ── Calendar render ────────────────────────────────────────────── */
function renderCalendar() {
  const grid  = document.getElementById('calGrid');
  const title = document.getElementById('calTitle');
  if (!grid || !title) return;

  const memos = loadMemos();
  const y = viewYear, m = viewMonth;

  // Title: "2026년 5월"
  title.textContent = `${y}년 ${m + 1}월`;

  // Build grid HTML
  const DOW_LABELS = ['일','월','화','수','목','금','토'];
  let html = '';

  // Header row
  DOW_LABELS.forEach((lbl, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    html += `<div class="cal-dow ${cls}">${lbl}</div>`;
  });

  // First day of month and total days
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();

  // Pre-fill from previous month
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i;
    html += buildCell(y, m, d, true);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    html += buildCell(y, m + 1, d, false, memos);
  }

  // Post-fill to complete 6 rows (42 cells)
  const filled = firstDay + daysInMonth;
  const remaining = 42 - filled;
  for (let d = 1; d <= remaining; d++) {
    html += buildCell(y, m + 2, d, true);
  }

  grid.innerHTML = html;

  // Add click listeners
  grid.querySelectorAll('.cal-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => openMemoModal(
      parseInt(cell.dataset.y),
      parseInt(cell.dataset.m),
      parseInt(cell.dataset.d)
    ));
  });
}

function buildCell(y, m1raw, d, otherMonth, memos = {}) {
  // Resolve actual year/month for overflow
  let actualDate = new Date(y, m1raw - 1, d);
  const ay = actualDate.getFullYear();
  const am = actualDate.getMonth() + 1;
  const ad = actualDate.getDate();

  const isToday = (ay === today.getFullYear() && am === today.getMonth() + 1 && ad === today.getDate());
  const key = dateKey(ay, am, ad);
  const hasMemo = !!memos[key];
  const holiday = otherMonth ? null : getHoliday(ay, am, ad);

  // Column index: (firstDay + d-1) % 7 — but easier to compute weekday
  const dow = actualDate.getDay(); // 0=Sun, 6=Sat
  const isSun = dow === 0;
  const isSat = dow === 6;

  const { month: lm, day: ld } = otherMonth ? { month: 0, day: 0 } : getLunar(actualDate);
  const lunarStr = lm && ld ? `${lm}/${ld}` : '';

  const classes = [
    'cal-cell',
    otherMonth ? 'other-month' : '',
    isToday    ? 'today'       : '',
    holiday    ? 'holiday'     : '',
    isSun      ? 'col-sun'     : '',
    isSat      ? 'col-sat'     : '',
  ].filter(Boolean).join(' ');

  return `<div class="${classes}" data-y="${ay}" data-m="${am}" data-d="${ad}">
    <span class="cell-solar">${ad}</span>
    ${lunarStr ? `<span class="cell-lunar">${lunarStr}</span>` : ''}
    ${holiday  ? `<span class="cell-holiday-name">${holiday}</span>` : ''}
    ${hasMemo  ? '<span class="cell-memo-dot"></span>' : ''}
  </div>`;
}

/* ── Memo modal ─────────────────────────────────────────────────── */
let _memoTarget = null; // { y, m, d, key }

function openMemoModal(y, m, d) {
  _memoTarget = { y, m, d, key: dateKey(y, m, d) };
  const memos = loadMemos();
  document.getElementById('memoDate').textContent =
    `${y}년 ${m}월 ${d}일 메모`;
  document.getElementById('memoText').value = memos[_memoTarget.key] || '';
  document.getElementById('memoModal').hidden = false;
  document.getElementById('memoText').focus();
}

function closeMemoModal() {
  document.getElementById('memoModal').hidden = true;
  _memoTarget = null;
}

function saveMemo() {
  if (!_memoTarget) return;
  const text = document.getElementById('memoText').value.trim();
  const memos = loadMemos();
  if (text) memos[_memoTarget.key] = text;
  else delete memos[_memoTarget.key];
  saveMemos(memos);
  closeMemoModal();
  renderCalendar();
}

function deleteMemo() {
  if (!_memoTarget) return;
  const memos = loadMemos();
  delete memos[_memoTarget.key];
  saveMemos(memos);
  closeMemoModal();
  renderCalendar();
}

/* ── D-Day render ───────────────────────────────────────────────── */
function renderDdays() {
  const container = document.getElementById('ddayList');
  if (!container) return;
  const ddays = loadDdays();

  if (ddays.length === 0) {
    container.innerHTML = '<div class="dday-empty">D-Day 이벤트가 없습니다.<br>＋ 버튼으로 추가하세요.</div>';
    return;
  }

  // Sort by absolute distance from today
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const sorted = [...ddays].sort((a, b) => {
    const da = Math.abs(new Date(a.date).getTime() - todayMs);
    const db = Math.abs(new Date(b.date).getTime() - todayMs);
    return da - db;
  });

  container.innerHTML = sorted.map(item => {
    const target = new Date(item.date + 'T00:00:00');
    const diff = Math.round((target.getTime() - todayMs) / 86400000);

    let countStr, countClass;
    if (diff === 0)       { countStr = 'D-Day!';   countClass = 'dday-today'; }
    else if (diff > 0)    { countStr = `D-${diff}`; countClass = 'dday-future'; }
    else                  { countStr = `+${Math.abs(diff)}일 지남`; countClass = 'dday-past'; }

    const displayDate = item.date.replace(/-/g, '.');

    return `<div class="dday-card" data-id="${item.id}"
        style="border-left-color: ${item.color || '#7c3aed'}">
      <div class="dday-card__title">${escHtml(item.title)}</div>
      <div class="dday-card__date">${displayDate}</div>
      <div class="dday-card__count ${countClass}">${countStr}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('.dday-card').forEach(card => {
    card.addEventListener('click', () => openDdayModal(card.dataset.id));
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── D-Day modal ────────────────────────────────────────────────── */
let _ddayEditId = null;

function openDdayModal(editId = null) {
  _ddayEditId = editId;
  const modal = document.getElementById('ddayModal');
  const titleEl = document.getElementById('ddayModalTitle');
  const deleteBtn = document.getElementById('ddayDeleteItem');

  if (editId) {
    const item = loadDdays().find(d => d.id === editId);
    if (!item) return;
    titleEl.textContent = 'D-Day 수정';
    document.getElementById('ddayTitleInput').value = item.title;
    document.getElementById('ddayDateInput').value  = item.date;
    document.getElementById('ddayColor').value      = item.color || '#7c3aed';
    deleteBtn.hidden = false;
  } else {
    titleEl.textContent = 'D-Day 추가';
    document.getElementById('ddayTitleInput').value = '';
    document.getElementById('ddayDateInput').value  = '';
    document.getElementById('ddayColor').value      = '#7c3aed';
    deleteBtn.hidden = true;
  }
  modal.hidden = false;
  document.getElementById('ddayTitleInput').focus();
}

function closeDdayModal() {
  document.getElementById('ddayModal').hidden = true;
  _ddayEditId = null;
}

function saveDday() {
  const title = document.getElementById('ddayTitleInput').value.trim();
  const date  = document.getElementById('ddayDateInput').value;
  const color = document.getElementById('ddayColor').value;

  if (!title || !date) {
    alert('제목과 날짜를 모두 입력해주세요.');
    return;
  }

  const ddays = loadDdays();
  if (_ddayEditId) {
    const idx = ddays.findIndex(d => d.id === _ddayEditId);
    if (idx !== -1) ddays[idx] = { ...ddays[idx], title, date, color };
  } else {
    ddays.push({ id: crypto.randomUUID(), title, date, color });
  }
  saveDdays(ddays);
  closeDdayModal();
  renderDdays();
}

function deleteDday() {
  if (!_ddayEditId) return;
  const ddays = loadDdays().filter(d => d.id !== _ddayEditId);
  saveDdays(ddays);
  closeDdayModal();
  renderDdays();
}

/* ── Event wiring ───────────────────────────────────────────────── */
function wireEvents() {
  // Calendar nav
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  // Memo modal
  document.getElementById('memoSave')?.addEventListener('click', saveMemo);
  document.getElementById('memoDelete')?.addEventListener('click', deleteMemo);
  document.getElementById('memoClose')?.addEventListener('click', closeMemoModal);
  document.getElementById('memoModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMemoModal();
  });

  // D-Day modal
  document.getElementById('addDday')?.addEventListener('click', () => openDdayModal());
  document.getElementById('ddaySave')?.addEventListener('click', saveDday);
  document.getElementById('ddayDeleteItem')?.addEventListener('click', deleteDday);
  document.getElementById('ddayClose')?.addEventListener('click', closeDdayModal);
  document.getElementById('ddayModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDdayModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMemoModal();
      closeDdayModal();
    }
    if (e.key === 'ArrowLeft'  && !e.target.matches('input,textarea')) {
      document.getElementById('prevMonth')?.click();
    }
    if (e.key === 'ArrowRight' && !e.target.matches('input,textarea')) {
      document.getElementById('nextMonth')?.click();
    }
  });
}

/* ── Init ───────────────────────────────────────────────────────── */
wireEvents();
renderCalendar();
renderDdays();
