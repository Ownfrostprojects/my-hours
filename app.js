'use strict';

// ---------- Data (stored on the phone with localStorage) ----------
const KEY = 'mishoras.v1';
let entries = [];
try { entries = JSON.parse(localStorage.getItem(KEY)) || []; } catch { entries = []; }
const save = () => localStorage.setItem(KEY, JSON.stringify(entries));
const active = () => entries.find(e => e.end == null);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Utilidades de tiempo ----------
const DAY = 86400000;
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = ts => { // semana empieza el lunes
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
const pad = n => String(n).padStart(2, '0');
const fmtDur = ms => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const fmtDec = ms => `${(ms / 3600000).toFixed(2)} h`;
// Hourly rate (USD), stored on the phone
const RATE_KEY = 'mishoras.rate';
const getRate = () => { try { return parseFloat(localStorage.getItem(RATE_KEY)) || 0; } catch { return 0; } };
const fmtMoney = ms => (ms / 3600000 * getRate()).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtHour = ts => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtDay = ts => new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const toLocalInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Milliseconds worked within [from, to) (handles shifts that cross midnight)
function workedIn(from, to, now = Date.now()) {
  let t = 0;
  for (const e of entries) {
    const s = Math.max(e.start, from), f = Math.min(e.end ?? now, to);
    if (f > s) t += f - s;
  }
  return t;
}

// ---------- Navigation ----------
let tab = 'hoy';
let weekStart = startOfWeek(Date.now());
const view = document.getElementById('view');

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  if (tab === 'semana') weekStart = startOfWeek(Date.now());
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  render();
});

function render() {
  if (tab === 'hoy') renderHoy();
  else if (tab === 'semana') renderSemana();
  else renderHistorial();
}

// ---------- Screen: Today ----------
function renderHoy() {
  const now = Date.now();
  const a = active();
  const today = startOfDay(now);
  const weekTotal = workedIn(startOfWeek(now), addDays(startOfWeek(now), 7));
  view.innerHTML = `
    <h1>My Hours</h1>
    <p class="sub">${fmtDay(now)}</p>
    <div class="card">
      <div class="status" id="status"></div>
      <div class="big-time" id="clock">00:00:00</div>
      <button class="punch ${a ? 'out' : 'in'}" id="punch">${a ? 'Check-out' : 'Check-in'}</button>
    </div>
    <div class="stats">
      <div class="stat"><small>Today</small><b id="todayTotal">${fmtDur(workedIn(today, today + DAY, now))}</b></div>
      <div class="stat"><small>This week</small><b id="weekTotal">${fmtDur(weekTotal)}</b></div>
    </div>
    <div class="manual">
      ${a
        ? '<button class="btn" id="manualOut">✏️ Manual check-out</button><button class="btn" id="editStart">🕐 Fix check-in time</button>'
        : '<button class="btn" id="manualIn">✏️ Manual check-in</button>'}
    </div>`;
  if (!a) document.getElementById('manualIn').onclick = () => openTimePicker('Manual check-in', 'Check-in time', Date.now(), ts => {
    if (ts > Date.now()) return 'Check-in can’t be in the future.';
    entries.push({ id: uid(), start: ts, end: null });
  });
  if (a) {
    document.getElementById('manualOut').onclick = () => openTimePicker('Manual check-out', 'Check-out time', Date.now(), ts => {
      if (ts <= a.start) return 'Check-out must be after check-in (' + fmtHour(a.start) + ').';
      if (ts > Date.now()) return 'Check-out can’t be in the future.';
      a.end = ts;
    });
    document.getElementById('editStart').onclick = () => openTimePicker('Fix check-in', 'Check-in time', a.start, ts => {
      if (ts > Date.now()) return 'Check-in can’t be in the future.';
      a.start = ts;
    });
  }
  document.getElementById('punch').onclick = () => {
    const t = Date.now();
    if (active()) active().end = t; else entries.push({ id: uid(), start: t, end: null });
    if (navigator.vibrate) navigator.vibrate(30);
    save(); renderHoy();
  };
  tick();
}

function tick() {
  if (tab !== 'hoy') return;
  const clock = document.getElementById('clock');
  if (!clock) return;
  const now = Date.now(), a = active(), today = startOfDay(now);
  clock.textContent = fmtClock(a ? now - a.start : 0);
  document.getElementById('status').textContent = a ? `Working since ${fmtHour(a.start)}` : 'Off the clock';
  document.getElementById('todayTotal').textContent = fmtDur(workedIn(today, today + DAY, now));
  const ws = startOfWeek(now);
  document.getElementById('weekTotal').textContent = fmtDur(workedIn(ws, addDays(ws, 7), now));
}
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

// ---------- Screen: Week ----------
function renderSemana() {
  const now = Date.now();
  const days = [...Array(7)].map((_, i) => {
    const s = addDays(weekStart, i);
    return { s, ms: workedIn(s, addDays(s, 1), now) };
  });
  const total = days.reduce((x, d) => x + d.ms, 0);
  const worked = days.filter(d => d.ms > 0);
  const avg = worked.length ? total / worked.length : 0;
  const max = Math.max(...days.map(d => d.ms), 1);
  const isCurrent = weekStart === startOfWeek(now);
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  view.innerHTML = `
    <h1>Weekly summary</h1>
    <div class="weeknav">
      <button id="prev">‹</button>
      <div class="label">${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}${isCurrent ? '<br><small style="color:var(--muted)">This week</small>' : ''}</div>
      <button id="next" ${isCurrent ? 'disabled style="opacity:.3"' : ''}>›</button>
    </div>
    <div class="card">
      <div class="bars">
        ${days.map((d, i) => `<div class="bar ${d.ms ? '' : 'zero'}">
          <em>${d.ms ? (d.ms / 3600000).toFixed(1) : ''}</em>
          <i style="height:${Math.max(d.ms / max * 100, 1.5)}%"></i>
          <span>${names[i]}</span></div>`).join('')}
      </div>
    </div>
    <div class="stats">
      <div class="stat"><small>Total</small><b>${fmtDur(total)}</b></div>
      <div class="stat"><small>Days worked</small><b>${worked.length}</b></div>
      <div class="stat"><small>Daily average</small><b>${fmtDur(avg)}</b></div>
      <div class="stat"><small>Longest day</small><b>${fmtDur(Math.max(...days.map(d => d.ms)))}</b></div>
      ${getRate() ? `<div class="stat" style="grid-column:1/-1"><small>Total earned</small><b style="color:var(--green)">${fmtMoney(total)}</b></div>` : ''}
    </div>
    <div style="margin-top:14px"><button class="btn" id="share" style="width:100%">Share summary</button></div>`;

  document.getElementById('prev').onclick = () => { weekStart = addDays(weekStart, -7); renderSemana(); };
  const next = document.getElementById('next');
  if (!isCurrent) next.onclick = () => { weekStart = addDays(weekStart, 7); renderSemana(); };
  document.getElementById('share').onclick = () => {
    const lines = days.map(d => `${new Date(d.s).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}: ${d.ms ? fmtDur(d.ms) : '—'}`);
    const text = `Summary ${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}\n${lines.join('\n')}\nTotal: ${fmtDur(total)}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => alert('Summary copied'));
  };
}

// ---------- Screen: History ----------
function renderHistorial() {
  const list = [...entries].sort((a, b) => b.start - a.start);
  let html = `<h1>History</h1>
    <div class="card row" style="margin:12px 0 0;padding:12px 16px">
      <label for="rate" style="color:var(--muted)">Hourly rate (USD)</label>
      <input id="rate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" value="${getRate() || ''}"
        style="width:110px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:1rem;text-align:right">
    </div>
    <div class="row" style="margin:12px 0 4px;gap:8px">
      <button class="btn primary" id="add" style="flex:1">+ Add entry</button>
      <button class="btn" id="csv">Export CSV</button>
    </div>`;
  if (!list.length) html += '<div class="empty">No entries yet.<br>Make your first check-in on “Today”.</div>';
  let lastDay = null, lastWeek = null;
  // Summary at the end of each week (Monday to Sunday)
  const weekSummary = ws => {
    const t = workedIn(ws, addDays(ws, 7));
    return `<div class="week-total"><span>Week ${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}</span>
      <span>${fmtDec(t)}${getRate() ? ' · ' + fmtMoney(t) : ''}</span></div>`;
  };
  for (const e of list) {
    const day = startOfDay(e.start);
    const wk = startOfWeek(e.start);
    if (lastWeek !== null && wk !== lastWeek) html += weekSummary(lastWeek);
    lastWeek = wk;
    if (day !== lastDay) {
      const dayTotal = workedIn(day, day + DAY);
      html += `<div class="day-head"><span>${fmtDay(day)}</span><span>${fmtDec(dayTotal)}${getRate() ? ' · <b style="color:var(--green)">' + fmtMoney(dayTotal) + '</b>' : ''}</span></div>`;
      lastDay = day;
    }
    html += `<div class="entry" data-id="${e.id}">
      <div class="t">${fmtHour(e.start)} → ${e.end ? fmtHour(e.end) : '<span class="live">in progress</span>'}</div>
      <div class="d">${e.end ? fmtDec(e.end - e.start) : ''}</div></div>`;
  }
  if (lastWeek !== null) html += weekSummary(lastWeek);
  view.innerHTML = html;
  document.getElementById('rate').onchange = ev => {
    const v = Math.max(0, parseFloat(ev.target.value) || 0);
    try { localStorage.setItem(RATE_KEY, String(v)); } catch {}
    renderHistorial();
  };
  document.getElementById('add').onclick = () => openEditor(null);
  document.getElementById('csv').onclick = exportCSV;
  view.querySelectorAll('.entry').forEach(el => el.onclick = () => openEditor(el.dataset.id));
}

function exportCSV() {
  const rows = [['date', 'check-in', 'check-out', 'hours']];
  [...entries].sort((a, b) => a.start - b.start).forEach(e => {
    const d = new Date(e.start);
    rows.push([`${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`, fmtHour(e.start),
      e.end ? fmtHour(e.end) : '', e.end ? ((e.end - e.start) / 3600000).toFixed(2) : '']);
  });
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'my-hours.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Single time picker (manual check-in / check-out) ----------
// apply(ts) returns an error message, or nothing if all is well.
function openTimePicker(title, label, defaultTs, apply) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="sheet">
    <h2>${title}</h2>
    <label>${label}</label><input type="datetime-local" id="fTime" value="${toLocalInput(defaultTs)}">
    <div class="err" id="err"></div>
    <div class="actions">
      <button class="btn" id="cancel">Cancel</button>
      <button class="btn primary" id="ok">Save</button>
    </div></div>`;
  m.classList.remove('hidden');
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m.onclick = ev => { if (ev.target === m) close(); };
  document.getElementById('cancel').onclick = close;
  document.getElementById('ok').onclick = () => {
    const ts = new Date(document.getElementById('fTime').value).getTime();
    if (isNaN(ts)) return document.getElementById('err').textContent = 'Enter the date and time.';
    const msg = apply(ts);
    if (msg) return document.getElementById('err').textContent = msg;
    save(); close(); render();
  };
}

// ---------- Editor (add / edit / delete) ----------
function openEditor(id) {
  const e = id ? entries.find(x => x.id === id) : null;
  const m = document.getElementById('modal');
  const now = Date.now();
  m.innerHTML = `<div class="sheet">
    <h2>${e ? 'Edit entry' : 'New entry'}</h2>
    <label>Check-in</label><input type="datetime-local" id="fStart" value="${toLocalInput(e ? e.start : now - 3600000)}">
    <label>Check-out ${e && !e.end ? '(in progress: leave empty)' : ''}</label>
    <input type="datetime-local" id="fEnd" value="${e ? (e.end ? toLocalInput(e.end) : '') : toLocalInput(now)}">
    <div class="err" id="err"></div>
    <div class="actions">
      ${e ? '<button class="btn danger" id="del">Delete</button>' : ''}
      <button class="btn" id="cancel">Cancel</button>
      <button class="btn primary" id="ok">Save</button>
    </div></div>`;
  m.classList.remove('hidden');
  const close = () => { m.classList.add('hidden'); m.innerHTML = ''; };
  m.onclick = ev => { if (ev.target === m) close(); };
  document.getElementById('cancel').onclick = close;
  // In-app confirmation (confirm() can be blocked in the installed app)
  if (e) {
    const del = document.getElementById('del');
    del.onclick = () => {
      m.innerHTML = `<div class="sheet">
        <h2>Delete this entry?</h2>
        <p class="sub" style="text-transform:none">${fmtHour(e.start)} → ${e.end ? fmtHour(e.end) : 'in progress'} · this can’t be undone.</p>
        <div class="actions">
          <button class="btn" id="noDel">Cancel</button>
          <button class="btn danger" id="yesDel" style="background:var(--red);color:#fff;border:0;font-weight:700">Delete</button>
        </div></div>`;
      document.getElementById('noDel').onclick = close;
      document.getElementById('yesDel').onclick = () => {
        entries = entries.filter(x => x.id !== id);
        save(); close(); render();
      };
    };
  }
  document.getElementById('ok').onclick = () => {
    const s = new Date(document.getElementById('fStart').value).getTime();
    const fe = document.getElementById('fEnd').value;
    const f = fe ? new Date(fe).getTime() : null;
    const err = document.getElementById('err');
    if (isNaN(s)) return err.textContent = 'Enter the check-in time.';
    if (f == null && !(e && !e.end)) return err.textContent = 'Enter the check-out time.';
    if (f != null && f <= s) return err.textContent = 'Check-out must be after check-in.';
    if (f == null && entries.some(x => x.end == null && x.id !== id)) return err.textContent = 'There is already a shift in progress.';
    if (e) { e.start = s; e.end = f; } else entries.push({ id: uid(), start: s, end: f });
    save(); close(); render();
  };
}

// ---------- Service worker (offline mode) ----------
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
