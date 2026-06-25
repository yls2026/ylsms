/**
 * ATTENDANCE PAGE LOGIC
 */

let attendanceRows = [];

onLayoutReady(initAttendancePage);

async function initAttendancePage() {
  document.getElementById('pageTitle').textContent = 'Attendance';
  document.getElementById('attendanceYearPill').textContent = new Date().getFullYear();

  document.getElementById('attendanceSearch').addEventListener('input', debounce(renderAttendanceTable, 200));
  document.getElementById('btnExportAttendance').addEventListener('click', exportAttendanceCsv);

  await loadAttendance();
}

window.addEventListener('ylsms:authchanged', () => {
  if (document.getElementById('attendanceBody')) renderAttendanceTable();
});

async function loadAttendance() {
  try {
    attendanceRows = await Api.fetchAttendance();
    renderAttendanceTable();
  } catch (err) {
    showAlert(document.getElementById('attendanceAlert'), 'Could not load attendance: ' + err.message);
  }
}

/** Index (0 = Jan … 11 = Dec) of the current real-world month. */
function currentMonthIndex() {
  return new Date().getMonth();
}

function isFutureMonth(monthAbbrev) {
  return MONTHS_FULL.indexOf(monthAbbrev) > currentMonthIndex();
}

function renderAttendanceTable() {
  const body = document.getElementById('attendanceBody');
  const empty = document.getElementById('attendanceEmpty');
  const footer = document.getElementById('attendanceFooter');
  const q = document.getElementById('attendanceSearch').value.trim().toLowerCase();
  const curMonth = currentMonthIndex();

  const rows = attendanceRows.filter(r =>
    !q || String(r.ID).toLowerCase().includes(q) || String(r.Name).toLowerCase().includes(q)
  );

  if (!rows.length) {
    body.innerHTML = '';
    if (footer) footer.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  body.innerHTML = rows.map(r => {
    const elapsedMonths = MONTHS_FULL.slice(0, curMonth + 1);
    const presentCount = elapsedMonths.filter(m => attendanceStatus(r[m]) === 'Present').length;
    const rate = elapsedMonths.length ? Math.round((presentCount / elapsedMonths.length) * 100) : 0;

    const monthCells = MONTHS_FULL.map((m, idx) => {
      if (idx > curMonth) {
        // Upcoming month — always shown blank and locked, regardless of
        // any leftover value, since attendance can't be taken yet.
        return `<td class="text-center attendance-future-cell" title="Upcoming month">—</td>`;
      }
      const status = attendanceStatus(r[m]);
      return `
        <td class="text-center">
          <select class="attendance-select ${attendanceStatusClass(status)}" data-prev="${status === 'Empty' ? '' : status}" ${isAdmin() ? '' : 'disabled'}
            onchange="toggleAttendance('${escapeHtml(r.ID)}', '${m}', this.value, this)">
            <option value="Present" ${status === 'Present' ? 'selected' : ''}>✅ Present</option>
            <option value="Absent" ${status === 'Absent' ? 'selected' : ''}>❎ Absent</option>
            <option value="" ${status === 'Empty' ? 'selected' : ''}>Empty</option>
          </select>
        </td>`;
    }).join('');

    return `
      <tr>
        <td class="cell-sticky" style="left:0;"><span class="pill pill-maroon">${escapeHtml(r.ID)}</span></td>
        <td class="cell-sticky fw-semibold" style="left:140px;">${escapeHtml(r.Name)}</td>
        ${monthCells}
        <td class="text-center"><span class="pill ${rate >= 75 ? 'pill-paid' : rate >= 40 ? 'pill-gold' : 'pill-pending'}">${rate}%</span></td>
      </tr>`;
  }).join('');

  renderAttendanceFooter(rows, curMonth);
}

/**
 * Month-end summary footer: for every month that has already happened,
 * shows how many of the (currently filtered) members were marked Present
 * and what percentage of the group that is. Upcoming months show "—".
 */
function renderAttendanceFooter(rows, curMonth) {
  const footer = document.getElementById('attendanceFooter');
  if (!footer) return;

  const totalCells = MONTHS_FULL.map((m, idx) => {
    if (idx > curMonth) return `<td class="text-center attendance-future-cell">—</td>`;
    const count = rows.filter(r => attendanceStatus(r[m]) === 'Present').length;
    return `<td class="text-center">${count} / ${rows.length}</td>`;
  }).join('');

  const percentCells = MONTHS_FULL.map((m, idx) => {
    if (idx > curMonth) return `<td class="text-center attendance-future-cell">—</td>`;
    const count = rows.filter(r => attendanceStatus(r[m]) === 'Present').length;
    const pct = rows.length ? Math.round((count / rows.length) * 100) : 0;
    return `<td class="text-center">${pct}%</td>`;
  }).join('');

  footer.innerHTML = `
    <tr class="attendance-footer-row">
      <td class="cell-sticky attendance-footer-label" colspan="2" style="left:0;">Total Present</td>
      ${totalCells}
      <td></td>
    </tr>
    <tr class="attendance-footer-row">
      <td class="cell-sticky attendance-footer-label" colspan="2" style="left:0;">Attendance %</td>
      ${percentCells}
      <td></td>
    </tr>`;
}

async function toggleAttendance(id, month, value, selectEl) {
  const previousValue = selectEl.dataset.prev || '';
  if (!isAdmin()) {
    selectEl.value = previousValue;
    showToast('Please log in as Admin to mark attendance.', 'warning');
    return;
  }
  const statusEl = document.getElementById('attendanceSaveStatus');
  selectEl.disabled = true;
  selectEl.classList.remove('is-present', 'is-absent', 'is-empty');
  try {
    await Api.saveAttendance(id, month, value);
    const row = attendanceRows.find(r => r.ID === id);
    if (row) row[month] = value;
    selectEl.dataset.prev = value;
    selectEl.classList.add(attendanceStatusClass(attendanceStatus(value)));
    statusEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved';
    setTimeout(() => { statusEl.innerHTML = ''; }, 1500);
    // re-render so the Rate column and month-end totals reflect the change
    renderAttendanceTable();
  } catch (err) {
    selectEl.value = previousValue;
    selectEl.classList.add(attendanceStatusClass(attendanceStatus(previousValue)));
    showToast('Could not save attendance: ' + err.message, 'danger');
  } finally {
    selectEl.disabled = false;
  }
}

function exportAttendanceCsv() {
  const curMonth = currentMonthIndex();
  const elapsedMonths = MONTHS_FULL.slice(0, curMonth + 1);
  const header = ['ID', 'Name', ...MONTHS_FULL, 'Rate %'];
  const rows = attendanceRows.map(r => {
    const presentCount = elapsedMonths.filter(m => attendanceStatus(r[m]) === 'Present').length;
    const rate = elapsedMonths.length ? Math.round((presentCount / elapsedMonths.length) * 100) : 0;
    const monthValues = MONTHS_FULL.map((m, idx) => idx > curMonth ? '' : attendanceStatus(r[m]).replace('Empty', ''));
    return [r.ID, r.Name, ...monthValues, rate];
  });
  const csv = arrayToCsv([header, ...rows]);
  downloadBlob(csv, `attendance-${new Date().getFullYear()}.csv`, 'text/csv');
  showToast('Attendance report exported.', 'success');
}
