/* ── JAVIS 달력 — main.js v2 ──────────────────────────────────────
   Features: 음력(Intl) · 공휴일 · 메모(localStorage) · D-Day · 년월 선택기
──────────────────────────────────────────────────────────────────── */

/* ── Lunar date via Intl (no external lib) ──────────────────────── */
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
  '1-1':'신정','3-1':'삼일절','5-5':'어린이날',
  '6-6':'현충일','8-15':'광복절','10-3':'개천절',
  '10-9':'한글날','12-25':'크리스마스',
};

/* ── Lunar holidays (computed per year, cached) ─────────────────── */
const _lunarCache = {};
function buildLunarHolidays(year) {
  if (_lunarCache[year]) return _lunarCache[year];
  const result = {};
  const end = new Date(year + 1, 0, 1);
  for (let d = new Date(year, 0, 1); d < end; d.setDate(d.getDate() + 1)) {
    const { month, day } = getLunar(d);
    const key = `${d.getMonth() + 1}-${d.getDate()}`;
    if (month === 1  && day === 1)  result[key] = '설날';
    if (month === 1  && day === 2)  result[key] = '설날 연휴';
    if (month === 12 && day === 30) result[key] = '설날 전날';
    if (month === 8  && day === 14) result[key] = '추석 전날';
    if (month === 8  && day === 15) result[key] = '추석';
    if (month === 8  && day === 16) result[key] = '추석 연휴';
    if (month === 4  && day === 8)  result[key] = '부처님오신날';
  }
  _lunarCache[year] = result;
  return result;
}

function getHoliday(y, m1, d) {
  return SOLAR_HOLIDAYS[`${m1}-${d}`] || buildLunarHolidays(y)[`${m1}-${d}`] || null;
}

/* ── LocalStorage ───────────────────────────────────────────────── */
const MEMO_KEY = 'javis_cal_memos';
const DDAY_KEY = 'javis_cal_ddays';
const loadMemos = () => { try { return JSON.parse(localStorage.getItem(MEMO_KEY)||'{}'); } catch { return {}; } };
const saveMemos = o => { try { localStorage.setItem(MEMO_KEY, JSON.stringify(o)); } catch {} };
const loadDdays = () => { try { return JSON.parse(localStorage.getItem(DDAY_KEY)||'[]'); } catch { return []; } };
const saveDdays = a => { try { localStorage.setItem(DDAY_KEY, JSON.stringify(a)); } catch {} };
const dateKey   = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const escHtml   = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── State ──────────────────────────────────────────────────────── */
const today = new Date();
let viewYear  = today.getFullYear();
let viewMonth = today.getMonth();
let ymPickerYear = viewYear; // year shown in picker

/* ── DOM refs ───────────────────────────────────────────────────── */
const calGrid     = document.getElementById('calGrid');
const calTitleBtn = document.getElementById('calTitle');
const ymPicker    = document.getElementById('ymPicker');
const ymYearLabel = document.getElementById('ymYearLabel');
const ymMonths    = document.getElementById('ymMonths');

/* ── Calendar render ────────────────────────────────────────────── */
function renderCalendar() {
  const memos = loadMemos();
  const y = viewYear, m = viewMonth;

  calTitleBtn.textContent = `${y}년 ${m + 1}월 ▾`;

  const DOW = ['일','월','화','수','목','금','토'];
  let html = '';

  // DOW header row
  DOW.forEach((lbl, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    html += `<div class="cal-dow ${cls}">${lbl}</div>`;
  });

  const firstDay    = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();

  // Previous month tail
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i;
    html += buildCell(new Date(y, m - 1, d), true, {});
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    html += buildCell(new Date(y, m, d), false, memos);
  }
  // Next month head
  const filled = firstDay + daysInMonth;
  for (let d = 1; d <= 42 - filled; d++) {
    html += buildCell(new Date(y, m + 1, d), true, {});
  }

  calGrid.innerHTML = html;

  calGrid.querySelectorAll('.cal-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => openMemoModal(
      +cell.dataset.y, +cell.dataset.m, +cell.dataset.d
    ));
  });
}

function buildCell(date, otherMonth, memos) {
  const ay  = date.getFullYear();
  const am  = date.getMonth() + 1;   // 1-based
  const ad  = date.getDate();
  const dow = date.getDay();

  const isToday   = (ay === today.getFullYear() && am === today.getMonth()+1 && ad === today.getDate());
  const key       = dateKey(ay, am, ad);
  const hasMemo   = !otherMonth && !!memos[key];
  const holiday   = otherMonth ? null : getHoliday(ay, am, ad);

  const { month: lm, day: ld } = otherMonth ? {month:0,day:0} : getLunar(date);
  // Show "음 N월" on the 1st of lunar month, else just the day number
  let lunarStr = '';
  if (lm && ld) lunarStr = ld === 1 ? `음${lm}월` : `음${ld}`;

  const cls = [
    'cal-cell',
    otherMonth ? 'other-month' : '',
    isToday    ? 'today'       : '',
    holiday    ? 'holiday'     : '',
    dow === 0  ? 'col-sun'     : '',
    dow === 6  ? 'col-sat'     : '',
  ].filter(Boolean).join(' ');

  return `<div class="${cls}" data-y="${ay}" data-m="${am}" data-d="${ad}">
    <span class="cell-solar">${ad}</span>
    ${lunarStr ? `<span class="cell-lunar">${lunarStr}</span>` : ''}
    ${holiday  ? `<span class="cell-holiday-name">${holiday}</span>`  : ''}
    ${hasMemo  ? '<span class="cell-memo-dot"></span>' : ''}
  </div>`;
}

/* ── Year/Month picker ──────────────────────────────────────────── */
function renderYmPicker() {
  ymYearLabel.textContent = `${ymPickerYear}년`;
  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  ymMonths.innerHTML = MONTHS.map((lbl, i) => {
    const active = (ymPickerYear === viewYear && i === viewMonth) ? ' active' : '';
    return `<button class="ym-month-btn${active}" data-m="${i}">${lbl}</button>`;
  }).join('');

  ymMonths.querySelectorAll('.ym-month-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewYear  = ymPickerYear;
      viewMonth = +btn.dataset.m;
      closeYmPicker();
      renderCalendar();
    });
  });
}

function openYmPicker() {
  ymPickerYear = viewYear;
  ymPicker.hidden = false;
  calTitleBtn.classList.add('open');
  renderYmPicker();
}
function closeYmPicker() {
  ymPicker.hidden = true;
  calTitleBtn.classList.remove('open');
}
function toggleYmPicker() {
  ymPicker.hidden ? openYmPicker() : closeYmPicker();
}

/* ── Memo modal ─────────────────────────────────────────────────── */
let _memo = null;

function openMemoModal(y, m, d) {
  _memo = { y, m, d, key: dateKey(y, m, d) };
  const memos = loadMemos();
  const date  = new Date(y, m - 1, d);
  const DOW   = ['일','월','화','수','목','금','토'];
  document.getElementById('memoDate').textContent =
    `${y}년 ${m}월 ${d}일 (${DOW[date.getDay()]})`;
  const { month: lm, day: ld } = getLunar(date);
  document.getElementById('memoLunar').textContent =
    lm ? `음력 ${lm}월 ${ld}일` : '';
  document.getElementById('memoText').value = memos[_memo.key] || '';
  document.getElementById('memoModal').hidden = false;
  document.getElementById('memoText').focus();
}
function closeMemoModal() {
  document.getElementById('memoModal').hidden = true;
  _memo = null;
}
function saveMemo() {
  if (!_memo) return;
  const text = document.getElementById('memoText').value.trim();
  const memos = loadMemos();
  if (text) memos[_memo.key] = text; else delete memos[_memo.key];
  saveMemos(memos);
  closeMemoModal();
  renderCalendar();
}
function deleteMemo() {
  if (!_memo) return;
  const memos = loadMemos();
  delete memos[_memo.key];
  saveMemos(memos);
  closeMemoModal();
  renderCalendar();
}

/* ── D-Day render ───────────────────────────────────────────────── */
function renderDdays() {
  const container = document.getElementById('ddayList');
  if (!container) return;
  const ddays = loadDdays();
  if (!ddays.length) {
    container.innerHTML = '<div class="dday-empty">D-Day 이벤트가 없습니다.<br>＋ 버튼으로 추가하세요.</div>';
    return;
  }
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const sorted  = [...ddays].sort((a, b) =>
    Math.abs(new Date(a.date).getTime() - todayMs) - Math.abs(new Date(b.date).getTime() - todayMs)
  );
  container.innerHTML = sorted.map(item => {
    const diff = Math.round((new Date(item.date+'T00:00:00').getTime() - todayMs) / 86400000);
    let countStr, countClass;
    if (diff === 0)    { countStr='D-Day!';              countClass='dday-today';  }
    else if (diff > 0) { countStr=`D-${diff}`;           countClass='dday-future'; }
    else               { countStr=`+${-diff}일 지남`;    countClass='dday-past';   }
    return `<div class="dday-card" data-id="${item.id}" style="border-left-color:${item.color||'#7c3aed'}">
      <div class="dday-card__title">${escHtml(item.title)}</div>
      <div class="dday-card__date">${item.date.replace(/-/g,'.')}</div>
      <div class="dday-card__count ${countClass}">${countStr}</div>
    </div>`;
  }).join('');
  container.querySelectorAll('.dday-card').forEach(card =>
    card.addEventListener('click', () => openDdayModal(card.dataset.id))
  );
}

/* ── D-Day modal ────────────────────────────────────────────────── */
let _ddayId = null;
function openDdayModal(editId = null) {
  _ddayId = editId;
  const del = document.getElementById('ddayDeleteItem');
  document.getElementById('ddayModalTitle').textContent = editId ? 'D-Day 수정' : 'D-Day 추가';
  if (editId) {
    const item = loadDdays().find(d => d.id === editId);
    if (!item) return;
    document.getElementById('ddayTitleInput').value = item.title;
    document.getElementById('ddayDateInput').value  = item.date;
    document.getElementById('ddayColor').value      = item.color || '#7c3aed';
    del.hidden = false;
  } else {
    document.getElementById('ddayTitleInput').value = '';
    document.getElementById('ddayDateInput').value  = '';
    document.getElementById('ddayColor').value      = '#7c3aed';
    del.hidden = true;
  }
  document.getElementById('ddayModal').hidden = false;
  document.getElementById('ddayTitleInput').focus();
}
function closeDdayModal() {
  document.getElementById('ddayModal').hidden = true;
  _ddayId = null;
}
function saveDday() {
  const title = document.getElementById('ddayTitleInput').value.trim();
  const date  = document.getElementById('ddayDateInput').value;
  const color = document.getElementById('ddayColor').value;
  if (!title || !date) { alert('제목과 날짜를 입력해주세요.'); return; }
  const ddays = loadDdays();
  if (_ddayId) {
    const idx = ddays.findIndex(d => d.id === _ddayId);
    if (idx !== -1) ddays[idx] = { ...ddays[idx], title, date, color };
  } else {
    ddays.push({ id: crypto.randomUUID(), title, date, color });
  }
  saveDdays(ddays);
  closeDdayModal();
  renderDdays();
}
function deleteDday() {
  if (!_ddayId) return;
  saveDdays(loadDdays().filter(d => d.id !== _ddayId));
  closeDdayModal();
  renderDdays();
}

/* ── Event wiring ───────────────────────────────────────────────── */
// Calendar nav
document.getElementById('prevMonth').addEventListener('click', () => {
  closeYmPicker();
  viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  closeYmPicker();
  viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
document.getElementById('todayBtn').addEventListener('click', () => {
  closeYmPicker();
  viewYear = today.getFullYear(); viewMonth = today.getMonth();
  renderCalendar();
});

// Year/month picker
calTitleBtn.addEventListener('click', toggleYmPicker);
document.getElementById('ymPrevYear').addEventListener('click', () => {
  ymPickerYear--; renderYmPicker();
});
document.getElementById('ymNextYear').addEventListener('click', () => {
  ymPickerYear++; renderYmPicker();
});
document.addEventListener('click', e => {
  if (!ymPicker.hidden &&
      !ymPicker.contains(e.target) &&
      e.target !== calTitleBtn) closeYmPicker();
});

// Memo modal
document.getElementById('memoSave').addEventListener('click', saveMemo);
document.getElementById('memoDelete').addEventListener('click', deleteMemo);
document.getElementById('memoClose').addEventListener('click', closeMemoModal);
document.getElementById('memoModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeMemoModal();
});

// D-Day modal
document.getElementById('addDday').addEventListener('click', () => openDdayModal());
document.getElementById('ddaySave').addEventListener('click', saveDday);
document.getElementById('ddayDeleteItem').addEventListener('click', deleteDday);
document.getElementById('ddayClose').addEventListener('click', closeDdayModal);
document.getElementById('ddayModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDdayModal();
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMemoModal(); closeDdayModal(); closeYmPicker(); }
  if (!e.target.matches('input,textarea')) {
    if (e.key === 'ArrowLeft')  document.getElementById('prevMonth').click();
    if (e.key === 'ArrowRight') document.getElementById('nextMonth').click();
  }
});

/* ── Init ───────────────────────────────────────────────────────── */
renderCalendar();
renderDdays();
