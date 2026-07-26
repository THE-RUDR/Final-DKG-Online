/**
 * DKG Online - Core Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const TEACHER_PASSWORD = 'DKGONLINE';
  const TEACHER_SESSION_KEY = 'dkg_teacher_unlocked';

  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // App State
  const state = {
    currentView: 'dashboard',
    teacherId: 'T-101',
    theme: localStorage.getItem('dkg_theme') || 'dark',
    todayDate: getLocalDateString(),
    
    // Attendance Flow State
    attendance: {
      step: 1,
      classId: null,
      className: '',
      divisionId: null,
      divisionName: '',
      roster: {} // studentId -> 'P' or 'A'
    },

    // History Flow State
    history: {
      step: 1,
      date: getLocalDateString(),
      classId: null,
      className: '',
      divisionId: null,
      divisionName: ''
    },

    // Reports State
    reports: {
      classId: 'C-9',
      divisionId: 'D-9A',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1 // 1-indexed
    }
  };

  // DOM Elements Cache
  const els = {
    // Views
    views: {
      dashboard: document.getElementById('view-dashboard'),
      attendance: document.getElementById('view-attendance'),
      history: document.getElementById('view-history'),
      reports: document.getElementById('view-reports'),
      manage: document.getElementById('view-manage')
    },
    // Nav
    navItems: document.querySelectorAll('.nav-item'),
    
    // Header & Global
    teacherLoginOverlay: document.getElementById('teacher-login-overlay'),
    teacherLoginForm: document.getElementById('teacher-login-form'),
    teacherPassword: document.getElementById('teacher-password'),
    teacherLoginError: document.getElementById('teacher-login-error'),
    todayDateText: document.getElementById('today-date-text'),
    themeToggle: document.getElementById('theme-toggle'),
    toastContainer: document.getElementById('toast-container'),
    successOverlay: document.getElementById('success-overlay'),
    
    // Dashboard metrics
    dashTotalStudents: document.getElementById('dash-total-students'),
    dashAttendancePct: document.getElementById('dash-attendance-pct'),
    dashAbsenceAlerts: document.getElementById('dash-absence-alerts'),
    chartSvg: document.getElementById('weekly-chart-svg'),
    
    // Attendance view containers
    stepIndicator: document.getElementById('attendance-step-indicator'),
    stepTitle: document.getElementById('attendance-step-title'),
    classSelection: document.getElementById('attendance-class-selection'),
    divisionSelection: document.getElementById('attendance-division-selection'),
    studentRoster: document.getElementById('attendance-student-roster'),
    
    // History view containers
    historyDateInput: document.getElementById('history-date-input'),
    historyFlowContainer: document.getElementById('history-flow-container'),
    
    // Reports view containers
    reportsClassSelect: document.getElementById('reports-class-select'),
    reportsDivSelect: document.getElementById('reports-div-select'),
    reportsContainer: document.getElementById('reports-container'),

    // Get Attendance Button
    btnGetAttendance: document.getElementById('btn-get-attendance'),
    
    // Success Overlay Elements
    successChartContainer: document.getElementById('success-chart-container'),
    btnCloseSuccess: document.getElementById('btn-close-success')
  };

  // Initialize App
  function init() {
    applyTeacherLock();

    // Apply saved theme
    const mockup = document.querySelector('.phone-mockup');
    if (state.theme === 'light') {
      if (mockup) mockup.classList.add('light-mode');
      if (els.themeToggle) els.themeToggle.checked = true;
    } else {
      if (mockup) mockup.classList.remove('light-mode');
      if (els.themeToggle) els.themeToggle.checked = false;
    }

    // Set teacher details
    const teacher = window.db.getTeacher(state.teacherId);
    
    // Set today's date text
    if (els.todayDateText) {
      const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
      els.todayDateText.textContent = new Date(state.todayDate).toLocaleDateString('en-US', options);
    }

    // Set default date in input
    if (els.historyDateInput) els.historyDateInput.value = state.history.date;

    // Populate dropdowns
    populateDropdowns();

    // Bind Event Listeners
    bindEvents();
    startMidnightAttendanceReset();

    window.addEventListener('dkg-db-updated', () => {
      populateDropdowns();
      switchView(state.currentView);
    });

    // Initial View Render
    switchView('dashboard');
  }

  function isTeacherUnlocked() {
    return sessionStorage.getItem(TEACHER_SESSION_KEY) === 'true';
  }

  function applyTeacherLock() {
    if (!els.teacherLoginOverlay) return;
    const unlocked = isTeacherUnlocked();
    els.teacherLoginOverlay.classList.toggle('hidden', unlocked);
    document.body.classList.toggle('teacher-locked', !unlocked);
    if (!unlocked) setTimeout(() => els.teacherPassword?.focus(), 50);
  }

  function updateTodayText() {
    if (!els.todayDateText) return;
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    els.todayDateText.textContent = new Date(state.todayDate).toLocaleDateString('en-US', options);
  }

  function resetAttendanceForNewDay(newDate) {
    state.todayDate = newDate;
    state.attendance.step = 1;
    state.attendance.classId = null;
    state.attendance.className = '';
    state.attendance.divisionId = null;
    state.attendance.divisionName = '';
    state.attendance.roster = {};
    updateTodayText();
    populateDropdowns();
    switchView(state.currentView);
    showToast('New Day Started', 'Attendance status reset for today.', false);
  }

  function checkMidnightAttendanceReset() {
    const currentDate = getLocalDateString();
    if (currentDate !== state.todayDate) {
      resetAttendanceForNewDay(currentDate);
    }
  }

  function startMidnightAttendanceReset() {
    checkMidnightAttendanceReset();
    setInterval(checkMidnightAttendanceReset, 30000);
    window.addEventListener('focus', checkMidnightAttendanceReset);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkMidnightAttendanceReset();
    });
  }

  // Populate classes and divisions in dropdowns
  function populateDropdowns() {
    const classes = window.db.getClasses();
    
    // Clear & Populate Reports Class Dropdown
    if (els.reportsClassSelect) {
      els.reportsClassSelect.innerHTML = classes.map(c => `<option value="${c.Class_ID}">${c.Name}</option>`).join('');
      updateReportsDivOptions();
    }
  }

  function updateReportsDivOptions() {
    const classId = els.reportsClassSelect.value;
    const divs = window.db.getDivisions(classId);
    if (els.reportsDivSelect) {
      els.reportsDivSelect.innerHTML = divs.map(d => `<option value="${d.Division_ID}">${d.Name}</option>`).join('');
    }
  }

  // Navigation / Routing
  function switchView(viewName) {
    state.currentView = viewName;
    
    // Update Nav Bar UI
    els.navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Views Visibility
    Object.keys(els.views).forEach(key => {
      if (key === viewName) {
        els.views[key].classList.add('active');
      } else {
        els.views[key].classList.remove('active');
      }
    });

    // Specific View Renderers
    if (viewName === 'dashboard') {
      renderDashboard();
    } else if (viewName === 'attendance') {
      // If returning to attendance, keep current step or reset
      renderAttendanceFlow();
    } else if (viewName === 'history') {
      renderHistoryFlow();
    } else if (viewName === 'reports') {
      renderReportsView();
    } else if (viewName === 'manage') {
      manageRefresh();
    }
  }

  // Render Dashboard
  function renderDashboard() {
    const stats = window.db.getDashboardStats(state.teacherId, state.todayDate);
    
    // Update Metrics
    if (els.dashTotalStudents) els.dashTotalStudents.textContent = stats.totalStudents;
    if (els.dashAttendancePct) els.dashAttendancePct.textContent = `${stats.attendancePercentage}%`;
    if (els.dashAbsenceAlerts) els.dashAbsenceAlerts.textContent = stats.absentCount;

    // Draw Analytics Graph
    drawWeeklyChart();
  }

  function getAttendanceStatus(classId, divisionId, dateStr = state.todayDate) {
    const students = window.db.getStudents(classId, divisionId);
    const roster = window.db.getAttendanceForDate(dateStr, classId, divisionId);
    const marked = Object.keys(roster).length;
    const present = Object.values(roster).filter(status => status === 'P').length;
    const absent = Object.values(roster).filter(status => status === 'A').length;

    return {
      roster,
      submitted: students.length > 0 && marked > 0,
      total: students.length,
      marked,
      present,
      absent
    };
  }

  function getClassSubmitStatus(classId) {
    const divisions = window.db.getDivisions(classId);
    const activeDivisions = divisions.filter(d => window.db.getStudents(classId, d.Division_ID).length > 0);
    const submitted = activeDivisions.filter(d => getAttendanceStatus(classId, d.Division_ID).submitted).length;
    return {
      total: activeDivisions.length,
      submitted,
      allSubmitted: activeDivisions.length > 0 && submitted === activeDivisions.length
    };
  }

  // Custom SVG Bar Chart Drawing
  function drawWeeklyChart() {
    const data = window.db.getWeeklyAnalytics(state.teacherId);
    if (!els.chartSvg || data.length === 0) return;

    const width = 360;
    const height = 130;
    const paddingLeft = 20;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 15;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Clear previous elements except gradient defs
    const defs = els.chartSvg.querySelector('defs')?.outerHTML || '';
    els.chartSvg.innerHTML = defs;

    // Draw 75% target line
    const targetY = height - paddingBottom - (75 / 100) * chartHeight;
    const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    targetLine.setAttribute('x1', paddingLeft);
    targetLine.setAttribute('y1', targetY);
    targetLine.setAttribute('x2', width - paddingRight);
    targetLine.setAttribute('y2', targetY);
    targetLine.setAttribute('stroke', 'rgba(255, 204, 0, 0.25)');
    targetLine.setAttribute('stroke-dasharray', '4,4');
    targetLine.setAttribute('stroke-width', '1');
    els.chartSvg.appendChild(targetLine);

    // Target label text
    const targetLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    targetLabel.setAttribute('x', width - paddingRight - 5);
    targetLabel.setAttribute('y', targetY - 4);
    targetLabel.setAttribute('fill', 'var(--accent-yellow)');
    targetLabel.setAttribute('font-size', '7px');
    targetLabel.setAttribute('font-weight', '700');
    targetLabel.setAttribute('text-anchor', 'end');
    targetLabel.textContent = `TARGET 75%`;
    els.chartSvg.appendChild(targetLabel);

    const barCount = data.length;
    const stepX = chartWidth / barCount;
    const barWidth = 22;

    data.forEach((d, i) => {
      const barHeight = (d.percentage / 100) * chartHeight;
      const x = paddingLeft + i * stepX + (stepX - barWidth) / 2;
      const y = height - paddingBottom - barHeight;

      // Draw Bar Rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', Math.max(barHeight, 4)); // At least 4px height for rounded top
      rect.setAttribute('rx', 4);
      rect.setAttribute('ry', 4);
      rect.setAttribute('fill', 'url(#chart-gradient)');
      rect.setAttribute('stroke', 'var(--accent-yellow)');
      rect.setAttribute('stroke-width', '1.5');
      rect.style.cursor = 'pointer';
      rect.style.transition = 'filter 0.2s';
      
      // Hover effects
      rect.addEventListener('mouseenter', () => {
        rect.style.filter = 'brightness(1.2) drop-shadow(0px 0px 4px rgba(255,204,0,0.6))';
        showToast(`Analytics Info`, `${d.day} Attendance: ${d.percentage}%`, false);
      });
      rect.addEventListener('mouseleave', () => {
        rect.style.filter = 'none';
      });

      els.chartSvg.appendChild(rect);

      // Percentage label text above the bar
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + barWidth / 2);
      label.setAttribute('y', y - 6);
      label.setAttribute('fill', 'var(--color-text-primary)');
      label.setAttribute('font-size', '9px');
      label.setAttribute('font-weight', '700');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = `${d.percentage}%`;
      els.chartSvg.appendChild(label);

      // Day label text below the bar (inside the SVG for perfect centering)
      const dayLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dayLabel.setAttribute('x', x + barWidth / 2);
      dayLabel.setAttribute('y', height - paddingBottom + 12);
      dayLabel.setAttribute('fill', 'var(--color-text-secondary)');
      dayLabel.setAttribute('font-size', '9px');
      dayLabel.setAttribute('font-weight', '700');
      dayLabel.setAttribute('text-anchor', 'middle');
      dayLabel.textContent = d.day;
      els.chartSvg.appendChild(dayLabel);
    });

    // Clear HTML labels container since SVG handles them now
    const labelsContainer = document.querySelector('.chart-x-labels');
    if (labelsContainer) {
      labelsContainer.innerHTML = '';
    }
  }

  // Attendance 3-step Flow Logic
  function renderAttendanceFlow() {
    // Step Indicator Updates
    const dots = els.stepIndicator.querySelectorAll('.step-dot');
    dots.forEach((dot, idx) => {
      if (idx + 1 <= state.attendance.step) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Hide all steps first
    els.classSelection.style.display = 'none';
    els.divisionSelection.style.display = 'none';
    els.studentRoster.style.display = 'none';

    if (state.attendance.step === 1) {
      els.stepTitle.textContent = 'Select Class';
      els.classSelection.style.display = 'grid';
      renderClassGrid();
    } else if (state.attendance.step === 2) {
      els.stepTitle.textContent = `${state.attendance.className} Divisions`;
      els.divisionSelection.style.display = 'grid';
      renderDivisionGrid();
    } else if (state.attendance.step === 3) {
      els.stepTitle.textContent = `${state.attendance.className} - ${state.attendance.divisionName}`;
      els.studentRoster.style.display = 'flex';
      renderStudentRoster();
    }
  }

  // Step 1: Render Class Selection Grid
  function renderClassGrid() {
    const classes = window.db.getClasses();
    
    els.classSelection.innerHTML = classes.map(c => {
      const divs = window.db.getDivisions(c.Class_ID);
      const totalStudents = divs.reduce((sum, d) => sum + window.db.getStudents(c.Class_ID, d.Division_ID).length, 0);
      const submitStatus = getClassSubmitStatus(c.Class_ID);
      
      return `
        <div class="class-tile" data-id="${c.Class_ID}" data-name="${c.Name}">
          <div class="class-tile-info">
            <h3>${c.Name}</h3>
            <p>${totalStudents} Students Managed</p>
            <div class="submit-status-chip ${submitStatus.allSubmitted ? 'submitted' : 'pending'}">
              <i data-lucide="${submitStatus.allSubmitted ? 'check-circle-2' : 'clock'}"></i>
              ${submitStatus.submitted}/${submitStatus.total || 0} Submitted Today
            </div>
          </div>
          <div class="class-tile-arrow">
            <i data-lucide="chevron-right"></i>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach click events
    els.classSelection.querySelectorAll('.class-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        state.attendance.classId = tile.getAttribute('data-id');
        state.attendance.className = tile.getAttribute('data-name');
        state.attendance.step = 2;
        renderAttendanceFlow();
      });
    });
  }

  // Step 2: Render Division Selection Grid
  function renderDivisionGrid() {
    const divisions = window.db.getDivisions(state.attendance.classId);

    function divisionTeacherName(division) {
      return division?.DivisionTeacherName || division?.Division_Teacher_Name || division?.TeacherName || 'Teacher Not Assigned';
    }

    els.divisionSelection.innerHTML = `
      <div class="btn-secondary" id="btn-back-to-classes" style="grid-column: span 2; justify-content: center; padding: 10px; font-size: 12px; margin-bottom: 8px;">
        <i data-lucide="arrow-left"></i> Back to Classes
      </div>
    ` + divisions.map(d => {
      const studentCount = window.db.getStudents(state.attendance.classId, d.Division_ID).length;
      const submitStatus = getAttendanceStatus(state.attendance.classId, d.Division_ID);
      return `
        <div class="division-tile" data-id="${d.Division_ID}" data-name="${d.Name}">
          <div class="div-letter">${d.Name}</div>
          <div class="div-desc">${studentCount} Students</div>
          <div class="division-teacher-name">Teacher: ${divisionTeacherName(d)}</div>
          <div class="submit-status-chip ${submitStatus.submitted ? 'submitted' : 'pending'}">
            <i data-lucide="${submitStatus.submitted ? 'check-circle-2' : 'clock'}"></i>
            ${submitStatus.submitted ? 'Submitted' : 'Pending'}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind back button
    document.getElementById('btn-back-to-classes').addEventListener('click', () => {
      state.attendance.step = 1;
      renderAttendanceFlow();
    });

    // Attach click events to divisions
    els.divisionSelection.querySelectorAll('.division-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        state.attendance.divisionId = tile.getAttribute('data-id');
        state.attendance.divisionName = tile.getAttribute('data-name');
        
        // Load today's saved attendance for editing, otherwise start with all absent.
        const students = window.db.getStudents(state.attendance.classId, state.attendance.divisionId);
        const savedRoster = window.db.getAttendanceForDate(state.todayDate, state.attendance.classId, state.attendance.divisionId);
        state.attendance.roster = {};
        students.forEach(s => {
          state.attendance.roster[s.Student_ID] = savedRoster[s.Student_ID] || 'A';
        });

        state.attendance.step = 3;
        renderAttendanceFlow();
      });
    });
  }

  // Step 3: Render Student Roll Call List
  function renderStudentRoster() {
    const students = window.db.getStudents(state.attendance.classId, state.attendance.divisionId);
    const submitStatus = getAttendanceStatus(state.attendance.classId, state.attendance.divisionId);
    const submitLabel = submitStatus.submitted ? 'Update Attendance' : 'Submit Attendance';

    let html = `
      <div class="btn-secondary" id="btn-back-to-divisions" style="margin-bottom: 8px; justify-content: center; width: 100%;">
        <i data-lucide="arrow-left"></i> Back to Divisions
      </div>
      <div class="attendance-submit-card ${submitStatus.submitted ? 'submitted' : 'pending'}">
        <div>
          <div class="attendance-submit-title">${submitStatus.submitted ? 'Submitted Today' : 'Pending Today'}</div>
          <div class="attendance-submit-copy">
            ${submitStatus.submitted
              ? `${submitStatus.present} Present | ${submitStatus.absent} Absent. You can edit and update it.`
              : 'Mark students and submit today attendance.'}
          </div>
        </div>
        <div class="attendance-submit-icon">
          <i data-lucide="${submitStatus.submitted ? 'check-circle-2' : 'clock'}"></i>
        </div>
      </div>
      <div class="roster-header">
        <span>Roll & Student Name</span>
        <span>Status</span>
      </div>
      <div class="roster-list">
    `;

    html += students.map(s => {
      const status = state.attendance.roster[s.Student_ID] || 'A';
      const isPresent = status === 'P';
      
      let btnClass = isPresent ? 'present' : '';
      let iconName = 'check';

      return `
        <div class="student-row" data-student-id="${s.Student_ID}">
          <div class="student-row-left">
            <div class="roll-badge">${s.Roll_No}</div>
            <div class="student-details">
              <div class="student-name">${s.Name}</div>
              <div class="student-phone">${s.Parent_Contact}</div>
            </div>
          </div>
          <button class="attendance-toggle-btn ${btnClass}" data-student-id="${s.Student_ID}">
            <i data-lucide="${iconName}"></i>
          </button>
        </div>
      `;
    }).join('');

    html += `
      </div>
      <div class="submit-footer" style="margin-top: 10px;">
        <button class="btn-primary" id="btn-submit-attendance" style="width: 100%;">
          <i data-lucide="${submitStatus.submitted ? 'refresh-cw' : 'check-circle-2'}"></i> ${submitLabel}
        </button>
      </div>
    `;

    els.studentRoster.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();

    // Bind Back Button
    document.getElementById('btn-back-to-divisions').addEventListener('click', () => {
      state.attendance.step = 2;
      renderAttendanceFlow();
    });

    // Toggle Attendance Status (Instant Single click toggle)
    els.studentRoster.querySelectorAll('.attendance-toggle-btn').forEach(btn => {
      const studentId = btn.getAttribute('data-student-id');

      btn.addEventListener('click', () => {
        // Toggle between Absent ('A' - empty) and Present ('P' - checkmark)
        if (state.attendance.roster[studentId] === 'P') {
          state.attendance.roster[studentId] = 'A';
          btn.className = 'attendance-toggle-btn';
        } else {
          state.attendance.roster[studentId] = 'P';
          btn.className = 'attendance-toggle-btn present';
        }
        if (window.lucide) window.lucide.createIcons();
      });
    });

    // Submit Attendance Button
    document.getElementById('btn-submit-attendance').addEventListener('click', () => {
      submitAttendanceFlow();
    });
  }

  // Handle Attendance Submission
  function submitAttendanceFlow() {
    const finalRoster = {};
    let presentCount = 0;
    let absentCount = 0;
    const students = window.db.getStudents(state.attendance.classId, state.attendance.divisionId);
    const totalCount = students.length;
    const previousRoster = window.db.getAttendanceForDate(state.todayDate, state.attendance.classId, state.attendance.divisionId);
    const isEdit = Object.keys(previousRoster).length > 0;

    if (isEdit && !window.confirm('Today attendance is already submitted. Do you want to update it?')) {
      return;
    }

    students.forEach(s => {
      const status = state.attendance.roster[s.Student_ID] || 'A';
      finalRoster[s.Student_ID] = status;
      if (status === 'P') {
        presentCount++;
      } else {
        absentCount++;
      }
    });

    const result = window.db.saveAttendance(
      state.todayDate,
      state.attendance.classId,
      state.attendance.divisionId,
      finalRoster,
      state.teacherId,
      true // Always saved
    );

    if (result.success) {
      // Calculate percentages for the live graph
      const presentPct = Math.round((presentCount / totalCount) * 100);
      const absentPct = 100 - presentPct;

      // Render the live graph inside the success overlay
      if (els.successChartContainer) {
        els.successChartContainer.innerHTML = `
          <div style="font-size: 13px; font-weight: 700; color: var(--color-text-secondary); text-align: center; margin-bottom: 4px;">
            ${state.attendance.className} - ${state.attendance.divisionName}
          </div>
          
          <!-- Stacked Bar Chart -->
          <div style="height: 24px; width: 100%; background: rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; display: flex; border: 1px solid rgba(255,255,255,0.02);">
            <div style="height: 100%; width: ${presentPct}%; background: var(--color-present); display: flex; align-items: center; justify-content: center; color: #000; font-size: 10px; font-weight: 800; transition: width 0.5s ease;">
              ${presentPct > 15 ? presentPct + '%' : ''}
            </div>
            <div style="height: 100%; width: ${absentPct}%; background: var(--color-absent); display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 10px; font-weight: 800; transition: width 0.5s ease;">
              ${absentPct > 15 ? absentPct + '%' : ''}
            </div>
          </div>
          
          <!-- Stats Cards -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; margin-top: 5px;">
            <div class="premium-card" style="padding: 12px; text-align: center; background: rgba(0, 230, 118, 0.05); border-color: rgba(0, 230, 118, 0.15); margin: 0; transform: none; box-shadow: none;">
              <div style="font-size: 9px; text-transform: uppercase; color: var(--color-present); font-weight: 700;">Present</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--color-present); margin-top: 2px; font-family: var(--font-title);">${presentCount}</div>
            </div>
            <div class="premium-card" style="padding: 12px; text-align: center; background: rgba(255, 59, 48, 0.05); border-color: rgba(255, 59, 48, 0.15); margin: 0; transform: none; box-shadow: none;">
              <div style="font-size: 9px; text-transform: uppercase; color: var(--color-absent); font-weight: 700;">Absent</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--color-absent); margin-top: 2px; font-family: var(--font-title);">${absentCount}</div>
            </div>
          </div>
        `;
      }

      // Show Success Fullscreen Overlay (containing the graph)
      const titleEl = els.successOverlay?.querySelector('.success-title');
      const subtitleEl = els.successOverlay?.querySelector('.success-subtitle');
      if (titleEl) titleEl.textContent = isEdit ? 'Attendance Updated!' : 'Attendance Logged!';
      if (subtitleEl) subtitleEl.textContent = isEdit ? 'Today presenty updated successfully.' : 'Roster submitted and saved successfully.';
      if (els.successOverlay) {
        els.successOverlay.classList.add('active');
      }

      // Reset attendance flow state
      state.attendance.step = 1;
      state.attendance.classId = null;
      state.attendance.divisionId = null;
      state.attendance.roster = {};
    }
  }

  // Render History Drill-Down & Report (No Names, Just Numbers!)
  function renderHistoryFlow() {
    if (!els.historyFlowContainer) return;

    const dateStr = state.history.date;
    const step = state.history.step;
    
    let html = '';

    if (step === 1) {
      // Step 1: Render Classes Grid
      const classes = window.db.getClasses();
      html = `
        <div style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">
          Select Class to view report:
        </div>
        <div class="classes-grid">
      `;
      html += classes.map(c => {
        return `
          <div class="class-tile history-class-tile" data-id="${c.Class_ID}" data-name="${c.Name}">
            <div class="class-tile-info">
              <h3>${c.Name}</h3>
              <p>View historical statistics</p>
            </div>
            <div class="class-tile-arrow">
              <i data-lucide="chevron-right"></i>
            </div>
          </div>
        `;
      }).join('');
      html += `</div>`;

      els.historyFlowContainer.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();

      // Click event
      els.historyFlowContainer.querySelectorAll('.history-class-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          state.history.classId = tile.getAttribute('data-id');
          state.history.className = tile.getAttribute('data-name');
          state.history.step = 2;
          renderHistoryFlow();
        });
      });

    } else if (step === 2) {
      // Step 2: Render Divisions Grid
      const divisions = window.db.getDivisions(state.history.classId);
      html = `
        <div class="btn-secondary" id="btn-history-back-classes" style="justify-content: center; width: 100%;">
          <i data-lucide="arrow-left"></i> Back to Classes
        </div>
        <div style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-top: 8px;">
          Select Division for ${state.history.className}:
        </div>
        <div class="divisions-grid">
      `;
      html += divisions.map(d => {
        return `
          <div class="division-tile history-div-tile" data-id="${d.Division_ID}" data-name="${d.Name}">
            <div class="div-letter">${d.Name}</div>
            <div class="div-desc">View Report</div>
          </div>
        `;
      }).join('');
      html += `</div>`;

      els.historyFlowContainer.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();

      // Back button
      document.getElementById('btn-history-back-classes').addEventListener('click', () => {
        state.history.step = 1;
        renderHistoryFlow();
      });

      // Click event
      els.historyFlowContainer.querySelectorAll('.history-div-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          state.history.divisionId = tile.getAttribute('data-id');
          state.history.divisionName = tile.getAttribute('data-name');
          state.history.step = 3;
          renderHistoryFlow();
        });
      });

    } else if (step === 3) {
      // Step 3: Render Report (No Names, Just Numbers!)
      const classId = state.history.classId;
      const divisionId = state.history.divisionId;
      
      const students = window.db.getStudents(classId, divisionId);
      const total = students.length;
      
      const logs = window.db.getAttendanceForDate(dateStr, classId, divisionId);
      const hasLogs = Object.keys(logs).length > 0;
      
      let presentCount = 0;
      let absentCount = 0;
      
      if (hasLogs) {
        students.forEach(s => {
          const status = logs[s.Student_ID] || 'P';
          if (status === 'P') presentCount++;
          else if (status === 'A') absentCount++;
        });
      }

      const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

      // Format date for display
      const displayDate = new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
      });

      html = `
        <div class="btn-secondary" id="btn-history-back-divs" style="justify-content: center; width: 100%; margin-bottom: 8px;">
          <i data-lucide="arrow-left"></i> Back to Divisions
        </div>
        
        <div class="premium-card" style="border: var(--border-glow); box-shadow: var(--glow-shadow); display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Header info -->
          <div style="display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--accent-yellow); text-transform: uppercase;">
              Attendance Summary Report
            </div>
            <div style="font-family: var(--font-title); font-size: 18px; font-weight: 700; color: var(--color-text-primary);">
              ${state.history.className} - ${state.history.divisionName}
            </div>
            <div style="font-size: 12px; color: var(--color-text-secondary);">
              Date: ${displayDate}
            </div>
          </div>
      `;

      if (!hasLogs) {
        html += `
          <div style="background: rgba(255, 59, 48, 0.08); border: 1px dashed rgba(255, 59, 48, 0.3); border-radius: 12px; padding: 14px; font-size: 12px; color: var(--color-absent); text-align: center; font-weight: 600;">
            <i data-lucide="alert-circle" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i> No attendance recorded for this date.
          </div>
          
          <div class="metrics-grid">
            <div class="premium-card metric-card-small" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-text-secondary);">Total Students</span>
              <span style="font-size: 24px; font-weight: 700; color: var(--color-text-primary); margin-top: 4px;">${total}</span>
            </div>
            <div class="premium-card metric-card-small" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-text-secondary);">Present</span>
              <span style="font-size: 24px; font-weight: 700; color: var(--color-text-secondary); margin-top: 4px;">-</span>
            </div>
            <div class="premium-card metric-card-small" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); grid-column: span 2;">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-text-secondary);">Absent</span>
              <span style="font-size: 24px; font-weight: 700; color: var(--color-text-secondary); margin-top: 4px;">-</span>
            </div>
          </div>
        `;
      } else {
        html += `
          <!-- Large Stats Grid (Just numbers!) -->
          <div class="metrics-grid">
            
            <div class="premium-card metric-card-small" style="background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.06);">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-text-secondary); font-weight: 700;">Total Students</span>
              <span style="font-size: 32px; font-weight: 800; color: var(--color-text-primary); margin-top: 4px; font-family: var(--font-title);">${total}</span>
            </div>

            <div class="premium-card metric-card-small" style="background: rgba(0, 230, 118, 0.04); border-color: rgba(0, 230, 118, 0.15);">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-present); font-weight: 700;">Present</span>
              <span style="font-size: 32px; font-weight: 800; color: var(--color-present); margin-top: 4px; font-family: var(--font-title);">${presentCount}</span>
            </div>

            <div class="premium-card metric-card-small alert" style="background: rgba(255, 59, 48, 0.04); border-color: rgba(255, 59, 48, 0.15); grid-column: span 2;">
              <span style="font-size: 10px; text-transform: uppercase; color: var(--color-absent); font-weight: 700;">Absent</span>
              <span style="font-size: 32px; font-weight: 800; color: var(--color-absent); margin-top: 4px; font-family: var(--font-title);">${absentCount}</span>
            </div>
          </div>

          <!-- Progress Bar & Rate -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
              <span style="color: var(--color-text-secondary);">Attendance Rate</span>
              <span style="color: var(--accent-yellow);">${attendanceRate}%</span>
            </div>
            <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.02);">
              <div style="height: 100%; width: ${attendanceRate}%; background: var(--gradient-yellow); border-radius: 4px; box-shadow: 0 0 8px rgba(255, 204, 0, 0.5);"></div>
            </div>
          </div>
        `;
      }

      html += `</div>`;

      els.historyFlowContainer.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();

      // Back button
      document.getElementById('btn-history-back-divs').addEventListener('click', () => {
        state.history.step = 2;
        renderHistoryFlow();
      });
    }
  }

  // Render Reports (Now: Today's Reports showing absent students)
  function renderReportsView() {
    const classId = els.reportsClassSelect.value;
    const divisionId = els.reportsDivSelect.value;
    
    if (!classId || !divisionId) {
      els.reportsContainer.innerHTML = `<div style="text-align: center; color: var(--color-text-secondary); padding: 40px 0;">Please select a class and division.</div>`;
      return;
    }
    
    // Get all students of this class and division
    const students = window.db.getStudents(classId, divisionId);
    
    // Get today's attendance statuses
    const todayStatuses = window.db.getAttendanceForDate(state.todayDate, classId, divisionId);
    const hasLog = Object.keys(todayStatuses).length > 0;

    let html = '';

    if (!hasLog) {
      // Attendance not taken today
      html = `
        <div style="text-align: center; color: var(--color-text-secondary); padding: 45px 15px;">
          <div style="background: rgba(255,204,0,0.05); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; border: 1px solid rgba(255,204,0,0.15);">
            <i data-lucide="clipboard-signature" style="color: var(--accent-yellow); width: 22px; height: 22px;"></i>
          </div>
          <div style="font-weight: 700; color: var(--color-text-primary); font-size: 14px; margin-bottom: 4px;">Attendance Not Logged</div>
          <p style="font-size: 12px; max-width: 240px; margin: 0 auto; line-height: 1.4;">Attendance has not been submitted for this class today. Go to the Attendance tab to take roll call.</p>
        </div>
      `;
      els.reportsContainer.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Filter absent students today
    const absentees = students.filter(s => todayStatuses[s.Student_ID] === 'A');

    if (absentees.length === 0) {
      // Perfect Attendance!
      html = `
        <div style="text-align: center; color: var(--color-text-secondary); padding: 45px 15px;">
          <div style="background: rgba(0,230,118,0.05); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; border: 1px solid rgba(0,230,118,0.15);">
            <i data-lucide="sparkles" style="color: var(--color-present); width: 22px; height: 22px;"></i>
          </div>
          <div style="font-weight: 700; color: var(--color-present); font-size: 14px; margin-bottom: 4px;">Perfect Attendance!</div>
          <p style="font-size: 12px; max-width: 240px; margin: 0 auto; line-height: 1.4;">All students in this class were marked Present today. </p>
        </div>
      `;
      els.reportsContainer.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // List the absent students
    html = `
      <div style="margin-bottom: 12px; font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
        Absent Students Today (${absentees.length})
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    html += absentees.map(student => {
      return `
        <div class="report-row" style="border-left: 3.5px solid var(--color-absent); padding-left: 12px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 12px; border-radius: 8px; border: var(--border-dim); border-left: 3.5px solid var(--color-absent);">
          <div class="report-student-info" style="display: flex; flex-direction: column; gap: 3px;">
            <div class="report-student-name" style="font-weight: 700; color: var(--color-text-primary); font-size: 13.5px;">${student.Name}</div>
            <div class="report-student-stats" style="color: var(--color-text-secondary); font-size: 11px;">
              Roll: ${student.Roll_No} - Parent Contact: ${student.Parent_Contact}
            </div>
          </div>
          <div style="background: rgba(255,59,48,0.1); color: var(--color-absent); font-weight: 800; font-size: 9px; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
            ABSENT
          </div>
        </div>
      `;
    }).join('');

    html += `</div>`;

    els.reportsContainer.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  // Toast Alerts System
  function showToast(title, message, isError = false) {
    if (!els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    
    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${isError ? 'alert-triangle' : 'info'}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    els.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    // Auto remove after 5 seconds (matching CSS fadeout)
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // Fullscreen Success Overlay
  function showSuccessOverlay(title, subtitle, duration = 2000) {
    if (!els.successOverlay) return;

    const titleEl = els.successOverlay.querySelector('.success-title');
    const subtitleEl = els.successOverlay.querySelector('.success-subtitle');
    
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;

    els.successOverlay.classList.add('active');

    setTimeout(() => {
      els.successOverlay.classList.remove('active');
    }, duration);
  }

  // Bind UI Events
  function bindEvents() {
    els.teacherLoginForm?.addEventListener('submit', event => {
      event.preventDefault();
      const password = (els.teacherPassword?.value || '').trim().toUpperCase();
      if (password === TEACHER_PASSWORD) {
        sessionStorage.setItem(TEACHER_SESSION_KEY, 'true');
        if (els.teacherPassword) els.teacherPassword.value = '';
        if (els.teacherLoginError) els.teacherLoginError.textContent = '';
        applyTeacherLock();
        return;
      }
      if (els.teacherLoginError) els.teacherLoginError.textContent = 'Wrong password. Please try again.';
    });

    // Nav view switching
    els.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        switchView(view);
      });
    });

    // Theme Toggle (Light/Dark Mode)
    if (els.themeToggle) {
      els.themeToggle.addEventListener('change', (e) => {
        const mockup = document.querySelector('.phone-mockup');
        if (e.target.checked) {
          mockup.classList.add('light-mode');
          state.theme = 'light';
          localStorage.setItem('dkg_theme', 'light');
          showToast("Theme Changed", "Light Mode enabled (Yellow-White).", false);
        } else {
          mockup.classList.remove('light-mode');
          state.theme = 'dark';
          localStorage.setItem('dkg_theme', 'dark');
          showToast("Theme Changed", "Dark Mode enabled (Polished Black).", false);
        }
        // Redraw the chart to update colors
        if (state.currentView === 'dashboard') {
          drawWeeklyChart();
        }
      });
    }

    // Get Attendance Button Click Handler
    if (els.btnGetAttendance) {
      els.btnGetAttendance.addEventListener('click', () => {
        switchView('attendance');
      });
    }

    // Success Graph Overlay Close Handler
    if (els.btnCloseSuccess) {
      els.btnCloseSuccess.addEventListener('click', () => {
        if (els.successOverlay) {
          els.successOverlay.classList.remove('active');
        }
        switchView('dashboard');
      });
    }

    // History Date Input Change Event
    if (els.historyDateInput) {
      els.historyDateInput.addEventListener('change', (e) => {
        state.history.date = e.target.value;
        renderHistoryFlow();
      });
    }

    // Reports Filters Change Events
    if (els.reportsClassSelect) {
      els.reportsClassSelect.addEventListener('change', () => {
        updateReportsDivOptions();
        renderReportsView();
      });
    }
    if (els.reportsDivSelect) {
      els.reportsDivSelect.addEventListener('change', () => renderReportsView());
    }
    // Manage event bindings
    document.querySelectorAll('.manage-accordion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const panel = document.getElementById(`panel-${target}`);
        const isActive = btn.classList.contains('active');
        
        // Close all other panels first to keep UI neat
        document.querySelectorAll('.manage-accordion-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.manage-accordion-content').forEach(p => p.classList.remove('active'));
        
        if (!isActive) {
          btn.classList.add('active');
          if (panel) panel.classList.add('active');
        }
      });
    });

    // Add Student
    const btnAddStudent = document.getElementById('btn-add-student');
    if (btnAddStudent) {
      btnAddStudent.addEventListener('click', () => {
        const classId = document.getElementById('manage-student-class').value;
        const divId   = document.getElementById('manage-student-division').value;
        const name    = document.getElementById('manage-student-name').value;
        const roll    = document.getElementById('manage-student-roll').value;
        const contact = document.getElementById('manage-student-contact').value;
        const result  = window.db.addStudent(classId, divId, name, roll, contact);
        if (result.success) {
          showToast('Student Added', `${name.trim()} added successfully.`, false);
          document.getElementById('manage-student-name').value = '';
          document.getElementById('manage-student-roll').value = '';
          document.getElementById('manage-student-contact').value = '';
          manageRefresh();
        } else {
          showToast('Error', result.error, true);
        }
      });
    }

    // Class dropdown populates division dropdown
    const manageStudentClass = document.getElementById('manage-student-class');
    const manageStudentDiv   = document.getElementById('manage-student-division');
    
    if (manageStudentClass) {
      manageStudentClass.addEventListener('change', () => {
        const divSel = document.getElementById('manage-student-division');
        const classId = manageStudentClass.value;
        if (!classId) {
          divSel.innerHTML = `<option value="">Select Division</option>`;
          renderManageStudents();
          return;
        }
        const divs = window.db.getDivisions(classId);
        divSel.innerHTML = `<option value="">Select Division</option>` +
          divs.map(d => `<option value="${d.Division_ID}">${d.Name}</option>`).join('');
        renderManageStudents();
      });
    }

    if (manageStudentDiv) {
      manageStudentDiv.addEventListener('change', () => {
        renderManageStudents();
      });
    }

    const manageStudentSearch = document.getElementById('manage-student-search');
    if (manageStudentSearch) {
      manageStudentSearch.addEventListener('input', () => renderManageStudents());
    }

    // Add Class
    const btnAddClass = document.getElementById('btn-add-class');
    if (btnAddClass) {
      btnAddClass.addEventListener('click', () => {
        const name = document.getElementById('manage-class-name').value;
        const result = window.db.addClass(name);
        if (result.success) {
          showToast('Class Added', `${name.trim()} added successfully.`, false);
          document.getElementById('manage-class-name').value = '';
          manageRefresh();
        } else {
          showToast('Error', result.error, true);
        }
      });
    }

    // Add Division
    const btnAddDivision = document.getElementById('btn-add-division');
    if (btnAddDivision) {
      btnAddDivision.addEventListener('click', () => {
        const classId = document.getElementById('manage-div-class').value;
        const name    = document.getElementById('manage-div-name').value;
        const result  = window.db.addDivision(classId, name);
        if (result.success) {
          showToast('Division Added', `${name.trim()} added successfully.`, false);
          document.getElementById('manage-div-name').value = '';
          manageRefresh();
        } else {
          showToast('Error', result.error, true);
        }
      });
    }
  }
  // Manage helper functions
  // switchView() and bindEvents() can call them.

  function manageRefresh() {
    populateManageDropdowns();
    renderManageStudents();
    renderManageClasses();
    renderManageDivisions();
  }

  function populateManageDropdowns() {
    const classes = window.db.getClasses();
    const classOptions = `<option value="">Select Class</option>` +
      classes.map(c => `<option value="${c.Class_ID}">${c.Name}</option>`).join('');

    const selStudentClass = document.getElementById('manage-student-class');
    const selDivClass     = document.getElementById('manage-div-class');

    if (selStudentClass) selStudentClass.innerHTML = classOptions;
    if (selDivClass)     selDivClass.innerHTML     = classOptions;

    // Reset division dropdown
    const divSel = document.getElementById('manage-student-division');
    if (divSel) divSel.innerHTML = `<option value="">Select Division</option>`;
  }

  function renderManageStudents() {
    const list = document.getElementById('manage-list-students');
    if (!list) return;
    
    const classSelect = document.getElementById('manage-student-class');
    const divSelect   = document.getElementById('manage-student-division');
    const searchInput = document.getElementById('manage-student-search');
    const classId     = classSelect ? classSelect.value : '';
    const divisionId  = divSelect ? divSelect.value : '';
    const searchTerm  = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const classes  = window.db.getClasses();
    const allDivs  = window.db.getAllDivisions();
    let students   = window.db.getAllStudents ? window.db.getAllStudents() : [];

    if (classId) {
      students = students.filter(s => s.Class_ID === classId);
    }

    if (divisionId) {
      students = students.filter(s => s.Division_ID === divisionId);
    }

    if (searchTerm) {
      students = students.filter(s => {
        const cls = classes.find(c => c.Class_ID === s.Class_ID);
        const div = allDivs.find(d => d.Division_ID === s.Division_ID);
        const text = `${s.Name} ${s.Roll_No} ${s.Parent_Contact} ${cls ? cls.Name : s.Class_ID} ${div ? div.Name : s.Division_ID}`.toLowerCase();
        return text.includes(searchTerm);
      });
    }

    if (students.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--color-text-secondary);padding:20px;font-size:13px;">No students found.</p>`;
      return;
    }

    list.innerHTML = students
      .sort((a, b) => {
        const classCompare = a.Class_ID.localeCompare(b.Class_ID);
        if (classCompare !== 0) return classCompare;
        const divCompare = a.Division_ID.localeCompare(b.Division_ID);
        if (divCompare !== 0) return divCompare;
        return a.Roll_No.localeCompare(b.Roll_No, undefined, { numeric: true });
      })
      .map(s => {
        const cls = classes.find(c => c.Class_ID === s.Class_ID);
        const div = allDivs.find(d => d.Division_ID === s.Division_ID);
        return `
          <div class="manage-list-item">
            <div class="manage-item-info">
              <div class="manage-item-name">${s.Roll_No}. ${s.Name}</div>
              <div class="manage-item-sub">${cls ? cls.Name : s.Class_ID} - ${div ? div.Name : s.Division_ID} - ${s.Parent_Contact}</div>
            </div>
            <button class="manage-item-delete" data-id="${s.Student_ID}" data-type="student">
              <i data-lucide="trash-2"></i>
            </button>
          </div>`;
      }).join('');

    if (window.lucide) window.lucide.createIcons();
    attachDeleteHandlers(list);
  }

  function renderManageClasses() {
    const list = document.getElementById('manage-list-classes');
    if (!list) return;
    const classes = window.db.getClasses();

    if (classes.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--color-text-secondary);padding:20px;font-size:13px;">No classes yet.</p>`;
      return;
    }

    list.innerHTML = classes.map(c => `
      <div class="manage-list-item">
        <div class="manage-item-info">
          <div class="manage-item-name">${c.Name}</div>
          <div class="manage-item-sub">ID: ${c.Class_ID}</div>
        </div>
        <button class="manage-item-delete" data-id="${c.Class_ID}" data-type="class">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`).join('');

    if (window.lucide) window.lucide.createIcons();
    attachDeleteHandlers(list);
  }

  function renderManageDivisions() {
    const list = document.getElementById('manage-list-divisions');
    if (!list) return;
    const allDivs = window.db.getAllDivisions();
    const classes = window.db.getClasses();

    if (allDivs.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--color-text-secondary);padding:20px;font-size:13px;">No divisions yet.</p>`;
      return;
    }

    list.innerHTML = allDivs.map(d => {
      const cls = classes.find(c => c.Class_ID === d.Class_ID);
      return `
        <div class="manage-list-item">
          <div class="manage-item-info">
            <div class="manage-item-name">${d.Name}</div>
            <div class="manage-item-sub">${cls ? cls.Name : d.Class_ID}</div>
          </div>
          <button class="manage-item-delete" data-id="${d.Division_ID}" data-type="division">
            <i data-lucide="trash-2"></i>
          </button>
        </div>`;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    attachDeleteHandlers(list);
  }

  function attachDeleteHandlers(list) {
    list.querySelectorAll('.manage-item-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');

        if (type === 'student') {
          const s = window.db.getAllStudents().find(x => x.Student_ID === id);
          if (s) {
            window.db.removeStudent(id);
            showToast('Removed', `${s.Name} removed.`, false);
            manageRefresh();
          }
        } else if (type === 'class') {
          const c = window.db.getClasses().find(x => x.Class_ID === id);
          if (c) {
            window.db.removeClass(id);
            showToast('Removed', `${c.Name} and all its data removed.`, false);
            manageRefresh();
          }
        } else if (type === 'division') {
          const d = window.db.getAllDivisions().find(x => x.Division_ID === id);
          if (d) {
            window.db.removeDivision(id);
            showToast('Removed', `${d.Name} and its students removed.`, false);
            manageRefresh();
          }
        }
      });
    });
  }

  // Run initialization
  init();
});









