/**
 * DKG Online - Local Database & Storage Layer
 */

const DB_KEYS = {
  TEACHERS: 'dkg_teachers',
  CLASSES: 'dkg_classes',
  DIVISIONS: 'dkg_divisions',
  STUDENTS: 'dkg_students',
  ATTENDANCE_LOGS: 'dkg_attendance_logs',
  OFFLINE_QUEUE: 'dkg_offline_queue',
  SHARED_UPDATED_AT: 'dkg_shared_updated_at'
};

// Seed Data
const DEFAULT_TEACHER = {
  Teacher_ID: 'T-101',
  Name: 'Dr. Andrew Ng',
  Email: 'andrew.ng@dkg.edu',
  Assigned_Classes: ['C-9', 'C-10', 'C-11']
};

const DEFAULT_CLASSES = [
  { Class_ID: 'C-9', Name: 'Class 9' },
  { Class_ID: 'C-10', Name: 'Class 10' },
  { Class_ID: 'C-11', Name: 'Class 11' }
];

const DEFAULT_DIVISIONS = [
  { Division_ID: 'D-9A', Class_ID: 'C-9', Name: 'Div A' },
  { Division_ID: 'D-9B', Class_ID: 'C-9', Name: 'Div B' },
  { Division_ID: 'D-10A', Class_ID: 'C-10', Name: 'Div A' },
  { Division_ID: 'D-10B', Class_ID: 'C-10', Name: 'Div B' },
  { Division_ID: 'D-11A', Class_ID: 'C-11', Name: 'Div A' },
  { Division_ID: 'D-11B', Class_ID: 'C-11', Name: 'Div B' }
];

const STUDENT_NAMES_POOL = [
  "Aarav Sharma", "Aditya Patel", "Ananya Iyer", "Arjun Reddy", "Diya Sen",
  "Ishaan Verma", "Kavya Nair", "Krishna Rao", "Meera Joshi", "Pranav Gupta",
  "Rohan Kapoor", "Sanya Malhotra", "Siddharth Bose", "Sneha Rao", "Tanvi Bhat",
  "Vivaan Mehta", "Yash Singhal", "Zara Khan", "Devendra Jha", "Nisha Saxena"
];

// Generate deterministic students for classes and divisions
function generateStudents() {
  const students = [];
  let studentCount = 1;

  DEFAULT_DIVISIONS.forEach(div => {
    // Generate 12 students per division
    for (let i = 1; i <= 12; i++) {
      const nameIndex = (studentCount - 1) % STUDENT_NAMES_POOL.length;
      const baseName = STUDENT_NAMES_POOL[nameIndex];
      // Add some variation to names if we exceed the pool
      const suffix = studentCount > STUDENT_NAMES_POOL.length ? ` II` : '';
      
      students.push({
        Student_ID: `S-${1000 + studentCount}`,
        Roll_No: i.toString().padStart(2, '0'),
        Name: `${baseName}${suffix}`,
        Class_ID: div.Class_ID,
        Division_ID: div.Division_ID,
        Parent_Contact: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`
      });
      studentCount++;
    }
  });
  return students;
}

// Helper to get dates for the past N days
function getPastDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Generate historical attendance logs for the past 7 days to make the analytics chart look rich
function generateHistoricalLogs(students) {
  const logs = [];
  let logIdCounter = 1;

  // Generate logs for past 7 days (daysAgo: 1 to 7)
  for (let d = 7; d >= 1; d--) {
    const dateStr = getPastDateString(d);
    
    // For each division, let's mark attendance
    DEFAULT_DIVISIONS.forEach(div => {
      const divStudents = students.filter(s => s.Division_ID === div.Division_ID);
      
      // Attendance rate is usually around 85% to 98%
      const attendanceRate = 0.85 + Math.random() * 0.13; 

      divStudents.forEach(student => {
        const isPresent = Math.random() < attendanceRate;
        logs.push({
          Log_ID: `L-${logIdCounter++}`,
          Date: dateStr,
          Student_ID: student.Student_ID,
          Class_ID: student.Class_ID,
          Division_ID: student.Division_ID,
          Status: isPresent ? 'P' : 'A',
          Marked_By_Teacher_ID: 'T-101',
          Synced: true
        });
      });
    });
  }
  return logs;
}

class DKGDatabase {
  constructor() {
    this.syncUrl = window.dkgApiUrl ? window.dkgApiUrl('/api/shared-db') : '/api/shared-db';
    this.eventsUrl = window.dkgApiUrl ? window.dkgApiUrl('/api/events') : '/api/events';
    this.syncReady = false;
    this.lastSharedUpdatedAt = Number(localStorage.getItem(DB_KEYS.SHARED_UPDATED_AT) || 0);
    this.init();
    this.startSharedSync();
  }

  init() {
    // Initialize LocalStorage if not already set
    if (!localStorage.getItem(DB_KEYS.TEACHERS)) {
      localStorage.setItem(DB_KEYS.TEACHERS, JSON.stringify([DEFAULT_TEACHER]));
    }
    if (!localStorage.getItem(DB_KEYS.CLASSES)) {
      localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
    }
    if (!localStorage.getItem(DB_KEYS.DIVISIONS)) {
      localStorage.setItem(DB_KEYS.DIVISIONS, JSON.stringify(DEFAULT_DIVISIONS));
    }
    
    let students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS));
    if (!students) {
      students = generateStudents();
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
    }

    if (!localStorage.getItem(DB_KEYS.ATTENDANCE_LOGS)) {
      const historicalLogs = generateHistoricalLogs(students);
      localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify(historicalLogs));
    }
  }

  getSharedSnapshot() {
    return {
      teachers: JSON.parse(localStorage.getItem(DB_KEYS.TEACHERS)) || [],
      classes: JSON.parse(localStorage.getItem(DB_KEYS.CLASSES)) || [],
      divisions: JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS)) || [],
      students: JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [],
      attendanceLogs: JSON.parse(localStorage.getItem(DB_KEYS.ATTENDANCE_LOGS)) || []
    };
  }

  applySharedSnapshot(snapshot, updatedAt, shouldNotify = true) {
    if (!snapshot) return;

    if (Array.isArray(snapshot.teachers)) localStorage.setItem(DB_KEYS.TEACHERS, JSON.stringify(snapshot.teachers));
    if (Array.isArray(snapshot.classes)) localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(snapshot.classes));
    if (Array.isArray(snapshot.divisions)) localStorage.setItem(DB_KEYS.DIVISIONS, JSON.stringify(snapshot.divisions));
    if (Array.isArray(snapshot.students)) localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(snapshot.students));
    if (Array.isArray(snapshot.attendanceLogs)) localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify(snapshot.attendanceLogs));

    if (updatedAt) {
      this.lastSharedUpdatedAt = Number(updatedAt);
      localStorage.setItem(DB_KEYS.SHARED_UPDATED_AT, String(this.lastSharedUpdatedAt));
    }

    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent('dkg-db-updated'));
    }
  }

  async pullSharedData(shouldNotify = true, forceApply = false) {
    try {
      const response = await fetch(`${this.syncUrl}?t=${Date.now()}`, { cache: 'no-store' });
      if (response.status === 404) {
        await this.pushSharedData();
        return;
      }
      if (!response.ok) return;

      const payload = await response.json();
      const updatedAt = Number(payload.updatedAt || 0);

      if (payload.success && payload.data && (forceApply || updatedAt > this.lastSharedUpdatedAt)) {
        this.applySharedSnapshot(payload.data, updatedAt, shouldNotify);
      }
    } catch (error) {
      // Offline or static file mode: keep using this browser's local copy.
    }
  }

  async pushSharedData() {
    const updatedAt = Date.now();
    const payload = {
      success: true,
      updatedAt,
      data: this.getSharedSnapshot()
    };

    this.lastSharedUpdatedAt = updatedAt;
    localStorage.setItem(DB_KEYS.SHARED_UPDATED_AT, String(updatedAt));

    try {
      const response = await fetch(this.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('dkg-shared-data-saved', { detail: { updatedAt } }));
        return true;
      }
    } catch (error) {
      // Offline or static file mode: changes stay local until server is available.
    }
    return false;
  }

  markSharedDataChanged() {
    return this.pushSharedData();
  }

  startSharedSync() {
    this.pullSharedData(true, true);
    if (window.EventSource) {
      try {
        const events = new EventSource(this.eventsUrl);
        events.addEventListener('shared-db-updated', event => {
          try {
            const payload = JSON.parse(event.data || '{}');
            if (!payload.updatedAt || Number(payload.updatedAt) > this.lastSharedUpdatedAt) {
              this.pullSharedData(true);
            }
          } catch (_) {
            this.pullSharedData(true);
          }
        });
        events.onerror = () => {
          setTimeout(() => this.pullSharedData(true), 2000);
        };
      } catch (_) {
        setInterval(() => this.pullSharedData(true), 3000);
        return;
      }
    }
    setInterval(() => this.pullSharedData(true), 10000);
  }
  // Getters
  getTeacher(teacherId) {
    const teachers = JSON.parse(localStorage.getItem(DB_KEYS.TEACHERS));
    return teachers.find(t => t.Teacher_ID === teacherId) || teachers[0];
  }

  getClasses() {
    return JSON.parse(localStorage.getItem(DB_KEYS.CLASSES));
  }

  getDivisions(classId) {
    const divisions = JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS));
    return divisions.filter(d => d.Class_ID === classId);
  }

  getStudents(classId, divisionId) {
    const students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS));
    return students.filter(s => s.Class_ID === classId && s.Division_ID === divisionId)
                   .sort((a, b) => a.Roll_No.localeCompare(b.Roll_No));
  }

  // Attendance Operations
  getAttendanceLogs() {
    return JSON.parse(localStorage.getItem(DB_KEYS.ATTENDANCE_LOGS)) || [];
  }

  getAttendanceForDate(dateStr, classId, divisionId) {
    const logs = this.getAttendanceLogs();
    const filteredLogs = logs.filter(l => l.Date === dateStr && l.Class_ID === classId && l.Division_ID === divisionId);
    
    // Map to studentId -> status
    const statusMap = {};
    filteredLogs.forEach(l => {
      statusMap[l.Student_ID] = l.Status;
    });
    return statusMap;
  }

  saveAttendance(dateStr, classId, divisionId, roster, teacherId, isOnline = true) {
    const logs = this.getAttendanceLogs();
    
    // Remove any existing logs for this date, class, division to prevent duplicates
    const cleanLogs = logs.filter(l => !(l.Date === dateStr && l.Class_ID === classId && l.Division_ID === divisionId));
    
    const newEntries = [];
    let logIdCounter = Date.now();

    Object.keys(roster).forEach(studentId => {
      newEntries.push({
        Log_ID: `L-${logIdCounter++}`,
        Date: dateStr,
        Student_ID: studentId,
        Class_ID: classId,
        Division_ID: divisionId,
        Status: roster[studentId], // 'P' or 'A'
        Marked_By_Teacher_ID: teacherId,
        Synced: true
      });
    });

    // Save to main logs
    localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify([...cleanLogs, ...newEntries]));
    this.markSharedDataChanged();

    // Return the list of students marked absent for reports.
    const students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS));
    const absentStudents = [];
    Object.keys(roster).forEach(studentId => {
      if (roster[studentId] === 'A') {
        const student = students.find(s => s.Student_ID === studentId);
        if (student) absentStudents.push(student);
      }
    });

    return {
      success: true,
      absentStudents: absentStudents
    };
  }

  // Dashboard Stats
  getDashboardStats(teacherId, dateStr) {
    const students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS));
    const logs = this.getAttendanceLogs();

    const totalStudents = students.length;

    // Filter logs for today
    const todayLogs = logs.filter(l => l.Date === dateStr);
    
    let presentCount = 0;
    let absentCount = 0;

    todayLogs.forEach(l => {
      if (l.Status === 'P') presentCount++;
      else if (l.Status === 'A') absentCount++;
    });

    // Calculate percentage based on logs taken. If no logs taken today, use default/historical average or 0
    const totalMarked = presentCount + absentCount;
    const attendancePercentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

    return {
      totalStudents,
      attendancePercentage,
      absentCount,
      totalMarked
    };
  }

  // Get weekly stats for analytics graph (last 6 working days excluding Sundays)
  getWeeklyAnalytics(teacherId) {
    const logs = this.getAttendanceLogs();
    const days = [];
    
    // Loop backwards from today (i = 0) up to 10 days to collect 6 working days
    for (let i = 0; i < 10; i++) {
      const dateStr = getPastDateString(i);
      const dateObj = new Date(dateStr);
      
      // Skip Sunday (day number 0)
      if (dateObj.getDay() === 0) continue;
      
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dayLogs = logs.filter(l => l.Date === dateStr);
      const total = dayLogs.length;
      const present = dayLogs.filter(l => l.Status === 'P').length;
      
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      days.push({
        date: dateStr,
        day: dayName,
        percentage: rate === 0 && i === 0 ? 94 : rate // default fallback for today if not marked yet
      });
      
      if (days.length === 6) break;
    }
    
    // Reverse to show chronologically (oldest to newest)
    return days.reverse();
  }

  // Get monthly attendance report data
  getMonthlyReportData(classId, divisionId, year, month) {
    const students = this.getStudents(classId, divisionId);
    const logs = this.getAttendanceLogs();
    
    // Filter logs for this class, division, and year-month
    const prefix = `${year}-${month.toString().padStart(2, '0')}`;
    const monthlyLogs = logs.filter(l => l.Class_ID === classId && l.Division_ID === divisionId && l.Date.startsWith(prefix));
    
    // Map student attendance
    const report = students.map(student => {
      const studentLogs = monthlyLogs.filter(l => l.Student_ID === student.Student_ID);
      const totalDays = studentLogs.length;
      const presentDays = studentLogs.filter(l => l.Status === 'P').length;
      const absentDays = studentLogs.filter(l => l.Status === 'A').length;
      
      const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100; // default to 100 if no logs
      
      return {
        ...student,
        totalDays,
        presentDays,
        absentDays,
        percentage
      };
    });

    return report;
  }

  //  MANAGE: CLASSES 
  addClass(name) {
    if (!name || !name.trim()) return { success: false, error: 'Class name is required.' };
    const classes = this.getClasses();
    const exists = classes.find(c => c.Name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return { success: false, error: 'Class already exists.' };
    const newId = 'C-' + Date.now();
    classes.push({ Class_ID: newId, Name: name.trim() });
    localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(classes));
    this.markSharedDataChanged();
    return { success: true, id: newId };
  }

  removeClass(classId) {
    // Remove all students, divisions, and logs for this class first
    let students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
    students = students.filter(s => s.Class_ID !== classId);
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));

    let divisions = JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS)) || [];
    divisions = divisions.filter(d => d.Class_ID !== classId);
    localStorage.setItem(DB_KEYS.DIVISIONS, JSON.stringify(divisions));

    let logs = this.getAttendanceLogs();
    logs = logs.filter(l => l.Class_ID !== classId);
    localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify(logs));

    let classes = this.getClasses();
    classes = classes.filter(c => c.Class_ID !== classId);
    localStorage.setItem(DB_KEYS.CLASSES, JSON.stringify(classes));
    this.markSharedDataChanged();
    return { success: true };
  }

  //  MANAGE: DIVISIONS 
  addDivision(classId, name) {
    if (!classId) return { success: false, error: 'Please select a class.' };
    if (!name || !name.trim()) return { success: false, error: 'Division name is required.' };
    const divisions = JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS)) || [];
    const exists = divisions.find(d => d.Class_ID === classId && d.Name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return { success: false, error: 'Division already exists in this class.' };
    const newId = 'D-' + Date.now();
    divisions.push({ Division_ID: newId, Class_ID: classId, Name: name.trim() });
    localStorage.setItem(DB_KEYS.DIVISIONS, JSON.stringify(divisions));
    this.markSharedDataChanged();
    return { success: true, id: newId };
  }

  removeDivision(divisionId) {
    // Remove all students and logs for this division first
    let students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
    students = students.filter(s => s.Division_ID !== divisionId);
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));

    let logs = this.getAttendanceLogs();
    logs = logs.filter(l => l.Division_ID !== divisionId);
    localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify(logs));

    let divisions = JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS)) || [];
    divisions = divisions.filter(d => d.Division_ID !== divisionId);
    localStorage.setItem(DB_KEYS.DIVISIONS, JSON.stringify(divisions));
    this.markSharedDataChanged();
    return { success: true };
  }

  //  MANAGE: STUDENTS 
  addStudent(classId, divisionId, name, rollNo, contact) {
    if (!classId) return { success: false, error: 'Please select a class.' };
    if (!divisionId) return { success: false, error: 'Please select a division.' };
    if (!name || !name.trim()) return { success: false, error: 'Student name is required.' };
    if (!rollNo || !rollNo.trim()) return { success: false, error: 'Roll number is required.' };
    if (!contact || !contact.trim()) return { success: false, error: 'Parent mobile number is required.' };
    const cleanContact = contact.trim();
    if (!/^\+?\d[\d\s-]{7,18}$/.test(cleanContact)) return { success: false, error: 'Enter a valid parent mobile number with country code.' };
    const students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
    const rollExists = students.find(s => s.Class_ID === classId && s.Division_ID === divisionId && s.Roll_No === rollNo.trim().padStart(2, '0'));
    if (rollExists) return { success: false, error: `Roll No ${rollNo} already exists in this division.` };
    const newId = 'S-' + Date.now();
    students.push({
      Student_ID: newId,
      Roll_No: rollNo.trim().padStart(2, '0'),
      Name: name.trim(),
      Class_ID: classId,
      Division_ID: divisionId,
      Parent_Contact: cleanContact
    });
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
    this.markSharedDataChanged();
    return { success: true, id: newId };
  }

  removeStudent(studentId) {
    let students = JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
    students = students.filter(s => s.Student_ID !== studentId);
    localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));

    let logs = this.getAttendanceLogs();
    logs = logs.filter(l => l.Student_ID !== studentId);
    localStorage.setItem(DB_KEYS.ATTENDANCE_LOGS, JSON.stringify(logs));
    this.markSharedDataChanged();
    return { success: true };
  }

  getAllDivisions() {
    return JSON.parse(localStorage.getItem(DB_KEYS.DIVISIONS)) || [];
  }

  getAllStudents() {
    return JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS)) || [];
  }
}

// Export database instance to window for vanilla JS access
window.db = new DKGDatabase();




