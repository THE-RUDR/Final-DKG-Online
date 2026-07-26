(function () {
  const ADMIN_PASSWORD = 'DKGONLINE';
  const ADMIN_SESSION_KEY = 'dkg-admin-unlocked';

  const els = {
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('admin-login-form'),
    adminPassword: document.getElementById('admin-password'),
    loginError: document.getElementById('login-error'),
    logoutBtn: document.getElementById('btn-admin-logout'),
    pageTitle: document.getElementById('admin-page-title'),
    sideNavItems: Array.from(document.querySelectorAll('.side-nav-item')),
    adminViews: Array.from(document.querySelectorAll('.admin-view')),
    exportTodayBtn: document.getElementById('btn-export-today'),
    exportYearBtn: document.getElementById('btn-export-year'),
    exportMonthBtn: document.getElementById('btn-export-month'),
    backupBtn: document.getElementById('btn-backup-data'),
    printBtn: document.getElementById('btn-print-report'),
    syncText: document.getElementById('admin-sync-text'),
    date: document.getElementById('admin-date'),
    month: document.getElementById('admin-month'),
    year: document.getElementById('admin-year'),
    filterClass: document.getElementById('filter-class'),
    filterDivision: document.getElementById('filter-division'),
    totalStudents: document.getElementById('metric-total-students'),
    presentToday: document.getElementById('metric-present-today'),
    absentToday: document.getElementById('metric-absent-today'),
    presentRate: document.getElementById('metric-present-rate'),
    absentRate: document.getElementById('metric-absent-rate'),
    classes: document.getElementById('metric-classes'),
    divisions: document.getElementById('metric-divisions'),
    classSummary: document.getElementById('class-summary-list'),
    todayDonut: document.getElementById('today-donut'),
    todayDonutLabel: document.getElementById('today-donut-label'),
    todayChartPill: document.getElementById('today-chart-pill'),
    weeklyBars: document.getElementById('weekly-bars'),
    annualBars: document.getElementById('annual-bars'),
    notSubmittedCount: document.getElementById('not-submitted-count'),
    notSubmittedList: document.getElementById('not-submitted-list'),
    absentListCount: document.getElementById('absent-list-count'),
    absentStudentsList: document.getElementById('absent-students-list'),
    classBrowserEyebrow: document.getElementById('class-browser-eyebrow'),
    classBrowserTitle: document.getElementById('class-browser-title'),
    classBrowserSubtitle: document.getElementById('class-browser-subtitle'),
    classBrowserList: document.getElementById('class-browser-list'),
    classBrowserBack: document.getElementById('btn-class-browser-back'),
    monthlyReportTable: document.getElementById('monthly-report-table'),
    recordsTable: document.getElementById('records-table')
  };

  const state = {
    data: { classes: [], divisions: [], students: [], teachers: [], attendanceLogs: [] },
    selectedDate: todayString(),
    selectedMonth: monthString(),
    selectedYear: new Date().getFullYear(),
    activeView: 'home',
    classBrowser: { step: 'classes', classId: null, divisionId: null },
    lastUpdatedAt: 0,
    isLoading: false
  };

  function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function monthString() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function apiUrl(path) {
    return window.dkgApiUrl ? window.dkgApiUrl(path) : path;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function percentage(present, total) {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }

  function safeFileDate(value) {
    return String(value || todayString()).replace(/[^0-9-]/g, '');
  }

  function logsForDate(dateStr) {
    return state.data.attendanceLogs.filter(log => log.Date === dateStr);
  }

  function getClassName(classId) {
    return state.data.classes.find(item => item.Class_ID === classId)?.Name || 'Unknown Class';
  }

  function getDivisionName(divisionId) {
    return state.data.divisions.find(item => item.Division_ID === divisionId)?.Name || 'Unknown Division';
  }

  function getTeacherName(teacherId) {
    return state.data.teachers?.find(item => item.Teacher_ID === teacherId)?.Name || '';
  }

  function divisionTeacherName(divisionId) {
    const division = state.data.divisions.find(item => item.Division_ID === divisionId);
    if (division?.DivisionTeacherName || division?.Division_Teacher_Name || division?.TeacherName) {
      return division.DivisionTeacherName || division.Division_Teacher_Name || division.TeacherName;
    }
    const latestLog = state.data.attendanceLogs
      .filter(log => log.Division_ID === divisionId && log.Marked_By_Teacher_ID)
      .sort((a, b) => String(b.Date).localeCompare(String(a.Date)))[0];
    const teacherName = getTeacherName(latestLog?.Marked_By_Teacher_ID);
    return teacherName || 'Teacher Not Assigned';
  }

  async function saveSharedData() {
    const updatedAt = Date.now();
    const payload = {
      success: true,
      updatedAt,
      data: state.data
    };

    const response = await fetch(apiUrl('/api/shared-db'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Could not save teacher name.');
    }
    state.lastUpdatedAt = Number(result.updatedAt || updatedAt);
    return result;
  }

  async function saveDivisionTeacherName(divisionId, teacherName) {
    const division = state.data.divisions.find(item => item.Division_ID === divisionId);
    if (!division) return;
    division.DivisionTeacherName = teacherName.trim();
    division.Division_Teacher_Name = teacherName.trim();
    try {
      await saveSharedData();
      els.syncText.textContent = 'Division teacher updated. Live sync sent to all users.';
      renderClassesBrowser();
      if (window.lucide) window.lucide.createIcons();
    } catch (error) {
      window.alert(error.message || 'Teacher name not saved.');
    }
  }

  function classStats(classId, dateStr) {
    const students = state.data.students.filter(student => student.Class_ID === classId);
    const logs = state.data.attendanceLogs.filter(log => log.Class_ID === classId && log.Date === dateStr);
    const present = logs.filter(log => log.Status === 'P').length;
    const absent = logs.filter(log => log.Status === 'A').length;
    return { totalStudents: students.length, marked: present + absent, present, absent, rate: percentage(present, present + absent) };
  }

  function divisionStats(divisionId, dateStr) {
    const students = state.data.students.filter(student => student.Division_ID === divisionId);
    const logs = state.data.attendanceLogs.filter(log => log.Division_ID === divisionId && log.Date === dateStr);
    const present = logs.filter(log => log.Status === 'P').length;
    const absent = logs.filter(log => log.Status === 'A').length;
    return { totalStudents: students.length, marked: present + absent, present, absent, rate: percentage(present, present + absent) };
  }

  function getStudent(studentId) {
    return state.data.students.find(student => student.Student_ID === studentId);
  }

  function studentRoll(student) {
    return student?.Roll_No || student?.RollNo || student?.rollNumber || '-';
  }

  function parentMobile(student) {
    return student?.Parent_Contact || student?.ParentMobile || student?.Parent_Mobile || student?.Mobile || student?.Parent_WhatsApp || student?.Whatsapp || '-';
  }

  function applyAdminLock() {
    const unlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    document.body.classList.toggle('admin-locked', !unlocked);
    els.loginOverlay?.classList.toggle('active', !unlocked);
    if (!unlocked) {
      setTimeout(() => els.adminPassword?.focus(), 100);
    }
  }

  function isTeacherNameInputActive() {
    return document.activeElement?.classList?.contains('teacher-name-input');
  }

  async function loadSharedData() {
    if (state.isLoading || isTeacherNameInputActive()) return;
    state.isLoading = true;
    try {
      const response = await fetch(apiUrl('/api/shared-db?t=' + Date.now()), { cache: 'no-store' });
      if (!response.ok) throw new Error('Shared data not available');
      const payload = await response.json();
      state.lastUpdatedAt = Number(payload.updatedAt || Date.now());
      state.data = payload.data || state.data;
      updateFilters();
      render();
      els.syncText.textContent = 'Live data connected. Last sync: ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      els.syncText.textContent = 'Backend not connected. Start server to see live app data.';
      render();
    } finally {
      state.isLoading = false;
    }
  }

  function updateFilters() {
    const currentClass = els.filterClass.value;
    const currentDivision = els.filterDivision.value;
    const years = Array.from(new Set(state.data.attendanceLogs.map(log => Number(String(log.Date).slice(0, 4))).filter(Boolean)));
    if (!years.includes(new Date().getFullYear())) years.push(new Date().getFullYear());
    years.sort((a, b) => b - a);

    els.year.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    els.year.value = String(state.selectedYear);

    els.filterClass.innerHTML = '<option value="all">All Classes</option>' + state.data.classes
      .map(cls => `<option value="${escapeHtml(cls.Class_ID)}">${escapeHtml(cls.Name)}</option>`)
      .join('');
    els.filterClass.value = state.data.classes.some(cls => cls.Class_ID === currentClass) ? currentClass : 'all';

    const classId = els.filterClass.value;
    const divisions = classId === 'all'
      ? state.data.divisions
      : state.data.divisions.filter(div => div.Class_ID === classId);
    els.filterDivision.innerHTML = '<option value="all">All Divisions</option>' + divisions
      .map(div => `<option value="${escapeHtml(div.Division_ID)}">${escapeHtml(getClassName(div.Class_ID))} - ${escapeHtml(div.Name)}</option>`)
      .join('');
    els.filterDivision.value = divisions.some(div => div.Division_ID === currentDivision) ? currentDivision : 'all';
  }

  function renderMetrics() {
    const todayLogs = logsForDate(state.selectedDate);
    const present = todayLogs.filter(log => log.Status === 'P').length;
    const absent = todayLogs.filter(log => log.Status === 'A').length;
    const marked = present + absent;
    const presentPct = percentage(present, marked);
    const absentPct = marked > 0 ? 100 - presentPct : 0;

    if (els.totalStudents) els.totalStudents.textContent = state.data.students.length;
    if (els.presentToday) els.presentToday.textContent = present;
    if (els.absentToday) els.absentToday.textContent = absent;
    if (els.presentRate) els.presentRate.textContent = `${presentPct}% present`;
    if (els.absentRate) els.absentRate.textContent = `${absentPct}% absent`;
    if (els.classes) els.classes.textContent = state.data.classes.length;
    if (els.divisions) els.divisions.textContent = `${state.data.divisions.length} divisions`;

    const circumference = 427;
    if (els.todayDonut) els.todayDonut.style.strokeDashoffset = String(circumference - (circumference * presentPct / 100));
    if (els.todayDonutLabel) els.todayDonutLabel.textContent = `${presentPct}%`;
    if (els.todayChartPill) els.todayChartPill.textContent = `${presentPct}%`;
  }

  function renderClassSummary() {
    if (!els.classSummary) return;
    if (state.data.classes.length === 0) {
      els.classSummary.innerHTML = '<div class="empty-state">No class data found yet. Add classes/students from teacher app.</div>';
      return;
    }

    els.classSummary.innerHTML = state.data.classes.map(cls => {
      const stats = classStats(cls.Class_ID, state.selectedDate);
      const divisions = state.data.divisions.filter(div => div.Class_ID === cls.Class_ID).length;
      return `
        <div class="class-row">
          <div>
            <h3>${escapeHtml(cls.Name)}</h3>
            <p>${divisions} divisions | ${stats.totalStudents} students | ${stats.marked} marked today</p>
          </div>
          <div class="mini-stats">
            <div class="mini-stat"><strong>${stats.present}</strong><span>Present</span></div>
            <div class="mini-stat"><strong>${stats.absent}</strong><span>Absent</span></div>
            <div class="mini-stat"><strong>${stats.rate}%</strong><span>Rate</span></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function notSubmittedRows() {
    const rows = [];
    const divisionsWithStudents = state.data.divisions.filter(div =>
      state.data.students.some(student => student.Division_ID === div.Division_ID)
    );

    for (const division of divisionsWithStudents) {
      const stats = divisionStats(division.Division_ID, state.selectedDate);
      if (stats.totalStudents > 0 && stats.marked === 0) {
        rows.push({
          className: getClassName(division.Class_ID),
          divisionName: division.Name,
          students: stats.totalStudents
        });
      }
    }
    return rows.sort((a, b) => `${a.className} ${a.divisionName}`.localeCompare(`${b.className} ${b.divisionName}`));
  }

  function renderNotSubmitted() {
    const rows = notSubmittedRows();
    els.notSubmittedCount.textContent = rows.length;

    if (rows.length === 0) {
      els.notSubmittedList.innerHTML = '<div class="empty-state">All class/division attendance is submitted for this date.</div>';
      return;
    }

    els.notSubmittedList.innerHTML = rows.map(row => `
      <div class="compact-row">
        <div>
          <strong>${escapeHtml(row.className)} / ${escapeHtml(row.divisionName)}</strong>
          <span>${row.students} students waiting for attendance</span>
        </div>
        <div class="status-chip missing">Missing</div>
      </div>
    `).join('');
  }

  function absentStudentRows() {
    return logsForDate(state.selectedDate)
      .filter(log => log.Status === 'A')
      .map(log => {
        const student = getStudent(log.Student_ID);
        return {
          studentId: log.Student_ID,
          name: student?.Name || log.Student_Name || 'Unknown Student',
          roll: studentRoll(student),
          mobile: parentMobile(student),
          classId: log.Class_ID || student?.Class_ID,
          divisionId: log.Division_ID || student?.Division_ID,
          className: getClassName(log.Class_ID || student?.Class_ID),
          divisionName: getDivisionName(log.Division_ID || student?.Division_ID),
          student
        };
      })
      .sort((a, b) => `${a.className} ${a.divisionName} ${a.name}`.localeCompare(`${b.className} ${b.divisionName} ${b.name}`));
  }

  function renderAbsentStudents() {
    const rows = absentStudentRows();
    els.absentListCount.textContent = rows.length;
    if (rows.length === 0) {
      els.absentStudentsList.innerHTML = '<div class="empty-state">No absent students found for this date.</div>';
      return;
    }

    els.absentStudentsList.innerHTML = rows.map(row => `
      <div class="compact-row">
        <div>
          <strong>${escapeHtml(row.name)} <small>Roll ${escapeHtml(row.roll)}</small></strong>
          <span>${escapeHtml(row.className)} / ${escapeHtml(row.divisionName)} | Parent Contact: ${escapeHtml(row.mobile)}</span>
        </div>
        <div class="status-chip absent">Absent</div>
      </div>
    `).join('');
  }

  function studentTodayStatus(student) {
    const log = logsForDate(state.selectedDate).find(item => item.Student_ID === student.Student_ID);
    if (!log) return { label: 'Not Marked', className: 'pending' };
    if (log.Status === 'P') return { label: 'Present', className: 'present' };
    if (log.Status === 'A') return { label: 'Absent', className: 'absent' };
    return { label: 'Not Marked', className: 'pending' };
  }

  function renderClassesBrowser() {
    if (!els.classBrowserList) return;

    const browser = state.classBrowser;
    const selectedClass = state.data.classes.find(cls => cls.Class_ID === browser.classId);
    const selectedDivision = state.data.divisions.find(div => div.Division_ID === browser.divisionId);
    els.classBrowserBack?.classList.toggle('active', browser.step !== 'classes');

    if (browser.step === 'classes') {
      if (els.classBrowserEyebrow) els.classBrowserEyebrow.textContent = 'Classes';
      if (els.classBrowserTitle) els.classBrowserTitle.textContent = 'Classes';
      if (els.classBrowserSubtitle) els.classBrowserSubtitle.textContent = 'Open a class to add/change teacher names for each division.';

      if (state.data.classes.length === 0) {
        els.classBrowserList.innerHTML = '<div class="empty-state">No classes found. Add classes from teacher app.</div>';
        return;
      }

      els.classBrowserList.innerHTML = `<div class="class-browser-grid">${state.data.classes.map(cls => {
        const stats = classStats(cls.Class_ID, state.selectedDate);
        const divisions = state.data.divisions.filter(div => div.Class_ID === cls.Class_ID).length;
        return `
          <button class="browser-card class-browser-card" type="button" data-class-id="${escapeHtml(cls.Class_ID)}">
            <div class="browser-card-head">
              <div>
                <h3 class="browser-title">${escapeHtml(cls.Name)}</h3>
                <div class="browser-sub">${divisions} divisions available. Open to manage division teachers.</div>
              </div>
              <i data-lucide="chevron-right"></i>
            </div>
            <div class="browser-stats">
              <div class="browser-stat"><strong>${stats.totalStudents}</strong><span>Students</span></div>
              <div class="browser-stat"><strong>${divisions}</strong><span>Divisions</span></div>
              <div class="browser-stat"><strong>${stats.present}</strong><span>Present</span></div>
              <div class="browser-stat"><strong>${stats.absent}</strong><span>Absent</span></div>
            </div>
          </button>
        `;
      }).join('')}</div>`;

      els.classBrowserList.querySelectorAll('.class-browser-card').forEach(card => {
        card.addEventListener('click', () => {
          state.classBrowser = { step: 'divisions', classId: card.getAttribute('data-class-id'), divisionId: null };
          renderClassesBrowser();
          if (window.lucide) window.lucide.createIcons();
        });
      });
      return;
    }

    if (browser.step === 'divisions') {
      const divisions = state.data.divisions.filter(div => div.Class_ID === browser.classId);
      if (els.classBrowserEyebrow) els.classBrowserEyebrow.textContent = 'Divisions';
      if (els.classBrowserTitle) els.classBrowserTitle.textContent = selectedClass?.Name || 'Class';
      if (els.classBrowserSubtitle) els.classBrowserSubtitle.textContent = 'Add or change teacher name for each division, then open students list.';

      if (divisions.length === 0) {
        els.classBrowserList.innerHTML = '<div class="empty-state">No divisions found for this class.</div>';
        return;
      }

      els.classBrowserList.innerHTML = `<div class="class-browser-grid">${divisions.map(div => {
        const stats = divisionStats(div.Division_ID, state.selectedDate);
        const teacherName = divisionTeacherName(div.Division_ID);
        return `
          <div class="browser-card division-browser-card" data-division-id="${escapeHtml(div.Division_ID)}">
            <div class="browser-card-head">
              <div>
                <h3 class="browser-title">${escapeHtml(div.Name)}</h3>
                <div class="browser-sub">Teacher: ${escapeHtml(teacherName)}</div>
              </div>
              <button class="icon-action open-division-btn" type="button" data-division-id="${escapeHtml(div.Division_ID)}" title="Open division">
                <i data-lucide="chevron-right"></i>
              </button>
            </div>
            <div class="teacher-edit-row">
              <input class="teacher-name-input" data-division-id="${escapeHtml(div.Division_ID)}" type="text" value="${escapeHtml(teacherName === 'Teacher Not Assigned' ? '' : teacherName)}" placeholder="Enter division teacher name">
              <button class="save-teacher-btn" data-division-id="${escapeHtml(div.Division_ID)}" type="button">
                <i data-lucide="save"></i>
                <span>Save</span>
              </button>
            </div>
            <div class="browser-stats">
              <div class="browser-stat"><strong>${stats.totalStudents}</strong><span>Students</span></div>
              <div class="browser-stat"><strong>${stats.present}</strong><span>Present</span></div>
              <div class="browser-stat"><strong>${stats.absent}</strong><span>Absent</span></div>
              <div class="browser-stat"><strong>${stats.rate}%</strong><span>Rate</span></div>
            </div>
          </div>
        `;
      }).join('')}</div>`;

      els.classBrowserList.querySelectorAll('.open-division-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.classBrowser = { step: 'students', classId: browser.classId, divisionId: btn.getAttribute('data-division-id') };
          renderClassesBrowser();
          if (window.lucide) window.lucide.createIcons();
        });
      });
      els.classBrowserList.querySelectorAll('.save-teacher-btn').forEach(btn => {
        const saveCurrentTeacher = () => {
          const divisionId = btn.getAttribute('data-division-id');
          const input = Array.from(els.classBrowserList.querySelectorAll('.teacher-name-input'))
            .find(item => item.getAttribute('data-division-id') === divisionId);
          saveDivisionTeacherName(divisionId, input?.value || '');
        };
        btn.addEventListener('pointerdown', event => {
          event.preventDefault();
          saveCurrentTeacher();
        });
        btn.addEventListener('click', event => {
          event.preventDefault();
        });
      });
      return;
    }

    const students = state.data.students
      .filter(student => student.Class_ID === browser.classId && student.Division_ID === browser.divisionId)
      .sort((a, b) => Number(studentRoll(a)) - Number(studentRoll(b)) || String(a.Name).localeCompare(String(b.Name)));

    if (els.classBrowserEyebrow) els.classBrowserEyebrow.textContent = 'Students';
    if (els.classBrowserTitle) els.classBrowserTitle.textContent = `${selectedClass?.Name || 'Class'} / ${selectedDivision?.Name || 'Division'}`;
    if (els.classBrowserSubtitle) els.classBrowserSubtitle.textContent = `Teacher: ${divisionTeacherName(browser.divisionId)} | Today status for ${formatDate(state.selectedDate)}`;

    if (students.length === 0) {
      els.classBrowserList.innerHTML = '<div class="empty-state">No students found in this division.</div>';
      return;
    }

    els.classBrowserList.innerHTML = `
      <div class="student-status-list">
        ${students.map(student => {
          const status = studentTodayStatus(student);
          return `
            <div class="student-status-row">
              <div>
                <strong>${escapeHtml(studentRoll(student))}. ${escapeHtml(student.Name)}</strong>
                <span>Parent Contact: ${escapeHtml(parentMobile(student))}</span>
              </div>
              <div class="attendance-mark ${status.className}">${status.label}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function dailyRate(dateStr) {
    const logs = logsForDate(dateStr);
    const present = logs.filter(log => log.Status === 'P').length;
    return percentage(present, logs.length);
  }

  function renderWeeklyChart() {
    if (!els.weeklyBars) return;
    const days = [];
    for (let index = 6; index >= 0; index--) {
      const date = new Date(state.selectedDate + 'T00:00:00');
      date.setDate(date.getDate() - index);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({
        label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        value: dailyRate(dateStr)
      });
    }
    const width = 720;
    const height = 270;
    const padX = 42;
    const padY = 34;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const points = days.map((item, index) => {
      const x = padX + (plotW * index / Math.max(days.length - 1, 1));
      const y = padY + plotH - (plotH * item.value / 100);
      return { ...item, x, y };
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const area = `${path} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    els.weeklyBars.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly attendance line graph">
        <line class="line-axis" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
        <line class="line-axis" x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}"></line>
        <path class="line-area" d="${area}"></path>
        <path class="line-path" d="${path}"></path>
        ${points.map(point => `
          <circle class="line-dot" cx="${point.x}" cy="${point.y}" r="6"></circle>
          <text class="line-value" x="${point.x}" y="${Math.max(point.y - 14, 16)}" text-anchor="middle">${point.value}%</text>
          <text class="line-label" x="${point.x}" y="${height - 8}" text-anchor="middle">${escapeHtml(point.label)}</text>
        `).join('')}
      </svg>
    `;
  }

  function monthRate(monthIndex) {
    const prefix = `${state.selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const logs = state.data.attendanceLogs.filter(log => String(log.Date).startsWith(prefix));
    const present = logs.filter(log => log.Status === 'P').length;
    return percentage(present, logs.length);
  }

  function renderAnnualChart() {
    if (!els.annualBars) return;
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    els.annualBars.innerHTML = labels.map((label, index) => barItem(label, monthRate(index))).join('');
  }

  function barItem(label, value) {
    return `
      <div class="bar-item">
        <div class="bar-value">${value}%</div>
        <div class="bar-track"><div class="bar-fill" style="height:${value}%"></div></div>
        <div class="bar-label">${escapeHtml(label)}</div>
      </div>
    `;
  }

  function filteredLogs() {
    const classId = els.filterClass.value;
    const divisionId = els.filterDivision.value;
    return state.data.attendanceLogs.filter(log => {
      if (Number(String(log.Date).slice(0, 4)) !== state.selectedYear) return false;
      if (classId !== 'all' && log.Class_ID !== classId) return false;
      if (divisionId !== 'all' && log.Division_ID !== divisionId) return false;
      return true;
    });
  }

  function renderRecords() {
    const groups = new Map();
    for (const log of filteredLogs()) {
      const key = `${log.Date}|${log.Class_ID}|${log.Division_ID}`;
      if (!groups.has(key)) {
        groups.set(key, { date: log.Date, classId: log.Class_ID, divisionId: log.Division_ID, present: 0, absent: 0 });
      }
      const group = groups.get(key);
      if (log.Status === 'P') group.present += 1;
      if (log.Status === 'A') group.absent += 1;
    }

    const rows = Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
    if (rows.length === 0) {
      els.recordsTable.innerHTML = '<div class="empty-state">No yearly attendance records found for this filter.</div>';
      return;
    }

    els.recordsTable.innerHTML = `
      <div class="record-row header">
        <span>Date</span><span>Class / Division</span><span>Present</span><span>Absent</span><span>Total</span><span>Rate</span>
      </div>
      ${rows.map(row => {
        const total = row.present + row.absent;
        return `
          <div class="record-row">
            <span>${formatDate(row.date)}</span>
            <span>${escapeHtml(getClassName(row.classId))} / ${escapeHtml(getDivisionName(row.divisionId))}</span>
            <span>${row.present}</span>
            <span>${row.absent}</span>
            <span>${total}</span>
            <span>${percentage(row.present, total)}%</span>
          </div>
        `;
      }).join('')}
    `;
  }

  function groupedRecordRows() {
    const groups = new Map();
    for (const log of filteredLogs()) {
      const key = `${log.Date}|${log.Class_ID}|${log.Division_ID}`;
      if (!groups.has(key)) {
        groups.set(key, { date: log.Date, classId: log.Class_ID, divisionId: log.Division_ID, present: 0, absent: 0 });
      }
      const group = groups.get(key);
      if (log.Status === 'P') group.present += 1;
      if (log.Status === 'A') group.absent += 1;
    }
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  function monthlyReportRows() {
    const classId = els.filterClass.value;
    const divisionId = els.filterDivision.value;
    const divisions = state.data.divisions.filter(div => {
      if (classId !== 'all' && div.Class_ID !== classId) return false;
      if (divisionId !== 'all' && div.Division_ID !== divisionId) return false;
      return state.data.students.some(student => student.Division_ID === div.Division_ID);
    });

    return divisions.map(division => {
      const logs = state.data.attendanceLogs.filter(log =>
        String(log.Date).startsWith(state.selectedMonth) &&
        log.Division_ID === division.Division_ID
      );
      const present = logs.filter(log => log.Status === 'P').length;
      const absent = logs.filter(log => log.Status === 'A').length;
      const total = present + absent;
      const days = new Set(logs.map(log => log.Date)).size;
      const students = state.data.students.filter(student => student.Division_ID === division.Division_ID).length;
      return {
        className: getClassName(division.Class_ID),
        divisionName: division.Name,
        students,
        days,
        present,
        absent,
        total,
        rate: percentage(present, total)
      };
    }).sort((a, b) => `${a.className} ${a.divisionName}`.localeCompare(`${b.className} ${b.divisionName}`));
  }

  function renderMonthlyReport() {
    const rows = monthlyReportRows();
    if (!els.monthlyReportTable) return;

    if (rows.length === 0) {
      els.monthlyReportTable.innerHTML = '<div class="empty-state">No students found for this monthly filter.</div>';
      return;
    }

    els.monthlyReportTable.innerHTML = `
      <div class="record-row monthly header">
        <span>Class / Division</span><span>Students</span><span>Days</span><span>Present</span><span>Absent</span><span>Rate</span>
      </div>
      ${rows.map(row => `
        <div class="record-row monthly">
          <span>${escapeHtml(row.className)} / ${escapeHtml(row.divisionName)}</span>
          <span>${row.students}</span>
          <span>${row.days}</span>
          <span>${row.present}</span>
          <span>${row.absent}</span>
          <span>${row.rate}%</span>
        </div>
      `).join('')}
    `;
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function exportTodayCsv() {
    const rows = [['Date', 'Class', 'Division', 'Students', 'Present', 'Absent', 'Marked', 'Present Rate', 'Status']];
    const divisionsWithStudents = state.data.divisions.filter(div =>
      state.data.students.some(student => student.Division_ID === div.Division_ID)
    );

    for (const division of divisionsWithStudents) {
      const stats = divisionStats(division.Division_ID, state.selectedDate);
      rows.push([
        state.selectedDate,
        getClassName(division.Class_ID),
        division.Name,
        stats.totalStudents,
        stats.present,
        stats.absent,
        stats.marked,
        `${stats.rate}%`,
        stats.marked > 0 ? 'Submitted' : 'Not Submitted'
      ]);
    }

    if (rows.length === 1) rows.push([state.selectedDate, 'No data', '-', 0, 0, 0, 0, '0%', 'No students']);
    downloadCsv(`dkg-today-report-${safeFileDate(state.selectedDate)}.csv`, rows);
  }

  function exportYearCsv() {
    const rows = [['Date', 'Class', 'Division', 'Present', 'Absent', 'Total', 'Present Rate']];
    for (const row of groupedRecordRows()) {
      const total = row.present + row.absent;
      rows.push([
        row.date,
        getClassName(row.classId),
        getDivisionName(row.divisionId),
        row.present,
        row.absent,
        total,
        `${percentage(row.present, total)}%`
      ]);
    }

    if (rows.length === 1) rows.push([state.selectedYear, 'No records', '-', 0, 0, 0, '0%']);
    downloadCsv(`dkg-year-report-${state.selectedYear}.csv`, rows);
  }

  function exportMonthCsv() {
    const rows = [['Month', 'Class', 'Division', 'Students', 'Marked Days', 'Present', 'Absent', 'Total', 'Present Rate']];
    for (const row of monthlyReportRows()) {
      rows.push([
        state.selectedMonth,
        row.className,
        row.divisionName,
        row.students,
        row.days,
        row.present,
        row.absent,
        row.total,
        `${row.rate}%`
      ]);
    }

    if (rows.length === 1) rows.push([state.selectedMonth, 'No data', '-', 0, 0, 0, 0, 0, '0%']);
    downloadCsv(`dkg-monthly-report-${safeFileDate(state.selectedMonth)}.csv`, rows);
  }

  function downloadBackup() {
    const payload = {
      app: 'DKG Online',
      exportedAt: new Date().toISOString(),
      data: state.data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dkg-online-full-backup-${safeFileDate(todayString())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function setAdminView(viewName) {
    state.activeView = viewName;
    els.sideNavItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-admin-view') === viewName);
    });
    els.adminViews.forEach(view => {
      view.classList.toggle('active', view.id === `admin-view-${viewName}`);
    });
    const titles = {
      home: 'Home',
      classes: 'Classes',
      alerts: 'Alerts',
      records: 'Records'
    };
    if (els.pageTitle) els.pageTitle.textContent = titles[viewName] || 'Admin';
    if (window.lucide) window.lucide.createIcons();
  }

  function render() {
    renderMetrics();
    renderNotSubmitted();
    renderAbsentStudents();
    renderClassSummary();
    renderClassesBrowser();
    renderWeeklyChart();
    renderAnnualChart();
    renderRecords();
    renderMonthlyReport();
    if (window.lucide) window.lucide.createIcons();
  }

  function bindEvents() {
    applyAdminLock();
    els.loginForm?.addEventListener('submit', event => {
      event.preventDefault();
      if ((els.adminPassword?.value || '').trim() === ADMIN_PASSWORD) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        if (els.adminPassword) els.adminPassword.value = '';
        if (els.loginError) els.loginError.textContent = '';
        applyAdminLock();
        return;
      }
      if (els.loginError) els.loginError.textContent = 'Wrong password. Please try again.';
    });
    els.logoutBtn?.addEventListener('click', () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      applyAdminLock();
    });
    els.exportTodayBtn?.addEventListener('click', exportTodayCsv);
    els.exportYearBtn?.addEventListener('click', exportYearCsv);
    els.exportMonthBtn?.addEventListener('click', exportMonthCsv);
    els.backupBtn?.addEventListener('click', downloadBackup);
    els.printBtn?.addEventListener('click', () => window.print());
    els.sideNavItems.forEach(item => {
      item.addEventListener('click', () => setAdminView(item.getAttribute('data-admin-view') || 'home'));
    });
    els.classBrowserBack?.addEventListener('click', () => {
      if (state.classBrowser.step === 'students') {
        state.classBrowser = { step: 'divisions', classId: state.classBrowser.classId, divisionId: null };
      } else if (state.classBrowser.step === 'divisions') {
        state.classBrowser = { step: 'classes', classId: null, divisionId: null };
      }
      renderClassesBrowser();
      if (window.lucide) window.lucide.createIcons();
    });

    els.date.value = state.selectedDate;
    if (els.month) els.month.value = state.selectedMonth;
    els.date.addEventListener('change', () => {
      state.selectedDate = els.date.value || todayString();
      render();
    });
    els.month?.addEventListener('change', () => {
      state.selectedMonth = els.month.value || monthString();
      renderMonthlyReport();
    });
    els.year.addEventListener('change', () => {
      state.selectedYear = Number(els.year.value || new Date().getFullYear());
      render();
    });
    els.filterClass.addEventListener('change', () => {
      updateFilters();
      render();
    });
    els.filterDivision.addEventListener('change', render);

    if (window.EventSource) {
      try {
        const events = new EventSource(apiUrl('/api/events'));
        events.addEventListener('connected', () => {
          els.syncText.textContent = 'Live update channel connected.';
        });
        events.addEventListener('shared-db-updated', event => {
          try {
            const payload = JSON.parse(event.data || '{}');
            const updatedAt = Number(payload.updatedAt || 0);
            if (!updatedAt || updatedAt >= state.lastUpdatedAt) loadSharedData();
          } catch (_) {
            loadSharedData();
          }
        });
        events.onerror = () => {
          els.syncText.textContent = 'Live channel reconnecting. Backup sync is active.';
        };
      } catch (_) {
        els.syncText.textContent = 'Backup sync is active.';
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadSharedData();
    });
    window.addEventListener('focus', loadSharedData);
  }

  bindEvents();
  loadSharedData();
  setInterval(loadSharedData, 2000);
})();
