/**
 * ============================================================================
 *  YOUTH LIONS SOCIETY MANAGEMENT SYSTEM (YLSMS) - BACKEND
 *  Google Apps Script + Google Sheets database
 * ============================================================================
 *
 *  DEPLOYMENT NOTES (see README.md for full walkthrough):
 *  1. Create a new Google Sheet. Copy its ID from the URL.
 *  2. Open Extensions > Apps Script, paste this file as Code.gs and the
 *     contents of appsscript.json into the manifest (View > Show manifest).
 *  3. Run the `setup` function once from the editor to create all sheets
 *     and headers automatically. Grant the requested permissions.
 *  4. Deploy > New deployment > type: Web app.
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5. Copy the deployment URL into assets/js/config.js (API_URL).
 *
 *  All requests/responses use JSON. GET is used for read-only calls, POST
 *  (sent as text/plain by the frontend to avoid CORS preflight) is used for
 *  all writes.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

var SHEET_MEMBERS = 'Members';
var SHEET_ATTENDANCE = 'Attendance';
var SHEET_FEES = 'Fees';
var SHEET_SETTINGS = 'Settings';

var MEMBERS_HEADERS = ['ID', 'Position', 'Name', 'Birthday', 'Gender', 'Address', 'Email', 'Phone', 'WhatsApp'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var ATTENDANCE_HEADERS = ['ID', 'Name'].concat(MONTHS);
var FEES_HEADERS = ['ID', 'Name'].concat(MONTHS);

var DEFAULT_SETTINGS = {
  orgName: 'Youth Lions Society',
  whatsappLink: '',
  feeAmount: '500',
  theme: 'default',
  adminPassword: 'admin123' // CHANGE THIS immediately from the Settings page after first login!
};

var ADMIN_SESSION_SECONDS = 6 * 60 * 60; // 6 hours
var WRITE_ACTIONS_REQUIRING_AUTH = [
  'addMember', 'updateMember', 'deleteMember',
  'updateAttendance', 'updateFees',
  'saveSettings', 'changeAdminPassword'
];

// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;

    switch (action) {
      case 'getMembers':
        result = getMembers();
        break;
      case 'getAttendance':
        result = getAttendance();
        break;
      case 'getFees':
        result = getFees();
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'ping':
        result = { ok: true, time: new Date().toISOString() };
        break;
      default:
        return jsonResponse({ success: false, error: 'Unknown or missing action: ' + action });
    }

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action;
    var data = body.data || {};
    var result;

    if (WRITE_ACTIONS_REQUIRING_AUTH.indexOf(action) > -1) {
      requireAdmin_(body.token);
    }

    switch (action) {
      case 'addMember':
        result = addMember(data);
        break;
      case 'updateMember':
        result = updateMember(data);
        break;
      case 'deleteMember':
        result = deleteMember(data);
        break;
      case 'updateAttendance':
        result = updateAttendance(data);
        break;
      case 'updateFees':
        result = updateFees(data);
        break;
      case 'saveSettings':
        result = saveSettings(data);
        break;
      case 'adminLogin':
        result = adminLogin(data);
        break;
      case 'adminLogout':
        result = adminLogout(data);
        break;
      case 'changeAdminPassword':
        result = changeAdminPassword(data, body.token);
        break;
      default:
        return jsonResponse({ success: false, error: 'Unknown or missing action: ' + action });
    }

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// SETUP / SHEET HELPERS
// ---------------------------------------------------------------------------

/**
 * Run this once manually from the Apps Script editor to bootstrap the
 * spreadsheet with all required sheets, headers and default settings.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_MEMBERS, MEMBERS_HEADERS);
  ensureSheet_(ss, SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  ensureSheet_(ss, SHEET_FEES, FEES_HEADERS);
  ensureSheet_(ss, SHEET_SETTINGS, ['Setting', 'Value']);

  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (settingsSheet.getLastRow() < 2) {
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      settingsSheet.appendRow([key, DEFAULT_SETTINGS[key]]);
    });
  }
  return 'Setup complete';
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ensureSheet_(ss, name, headers);
}

function sheetToObjects_(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// MEMBERS
// ---------------------------------------------------------------------------

function getMembers() {
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  return sheetToObjects_(sheet).map(formatMember_);
}

function formatMember_(m) {
  if (m.Birthday instanceof Date) {
    m.Birthday = Utilities.formatDate(m.Birthday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return m;
}

function generateMemberId_(year) {
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var ids = sheet.getDataRange().getValues().slice(1).map(function (r) { return String(r[0]); });
  var prefix = 'YLS/' + year + '/';
  var max = 0;
  ids.forEach(function (id) {
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  var next = max + 1;
  return prefix + ('000' + next).slice(-3);
}

function addMember(data) {
  if (!data.Name) throw new Error('Member name is required.');

  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var year = data.Birthday ? new Date().getFullYear() : new Date().getFullYear();
  var id = data.ID && String(data.ID).trim() !== '' ? data.ID : generateMemberId_(year);

  var phone = normalizePhone_(data.Phone);
  var whatsapp = normalizePhone_(data.WhatsApp || data.Phone);

  var row = [
    id,
    data.Position || 'Member',
    data.Name,
    data.Birthday || '',
    data.Gender || '',
    data.Address || '',
    data.Email || '',
    phone,
    whatsapp
  ];
  sheet.appendRow(row);

  // Create matching rows in Attendance and Fees so every member appears there.
  var attSheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  attSheet.appendRow([id, data.Name].concat(MONTHS.map(function () { return ''; })));

  var feeSheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  feeSheet.appendRow([id, data.Name].concat(MONTHS.map(function () { return ''; })));

  return { ID: id, Position: row[1], Name: row[2], Birthday: row[3], Gender: row[4], Address: row[5], Email: row[6], Phone: row[7], WhatsApp: row[8] };
}

function updateMember(data) {
  if (!data.ID) throw new Error('Member ID is required for update.');
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var rowIndex = findRowById_(sheet, data.ID);
  if (rowIndex === -1) throw new Error('Member not found: ' + data.ID);

  var phone = normalizePhone_(data.Phone);
  var whatsapp = normalizePhone_(data.WhatsApp || data.Phone);

  var newRow = [
    data.ID,
    data.Position || '',
    data.Name || '',
    data.Birthday || '',
    data.Gender || '',
    data.Address || '',
    data.Email || '',
    phone,
    whatsapp
  ];
  sheet.getRange(rowIndex, 1, 1, MEMBERS_HEADERS.length).setValues([newRow]);

  // Keep the Name column in sync on Attendance and Fees sheets.
  syncNameAcrossSheets_(data.ID, data.Name);

  return { ID: data.ID, updated: true };
}

function syncNameAcrossSheets_(id, name) {
  if (!name) return;
  [SHEET_ATTENDANCE, SHEET_FEES].forEach(function (sheetName) {
    var headers = sheetName === SHEET_ATTENDANCE ? ATTENDANCE_HEADERS : FEES_HEADERS;
    var sheet = getSheet_(sheetName, headers);
    var rowIndex = findRowById_(sheet, id);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 2).setValue(name);
    }
  });
}

function deleteMember(data) {
  if (!data.ID) throw new Error('Member ID is required for delete.');

  [
    [SHEET_MEMBERS, MEMBERS_HEADERS],
    [SHEET_ATTENDANCE, ATTENDANCE_HEADERS],
    [SHEET_FEES, FEES_HEADERS]
  ].forEach(function (pair) {
    var sheet = getSheet_(pair[0], pair[1]);
    var rowIndex = findRowById_(sheet, data.ID);
    if (rowIndex > -1) sheet.deleteRow(rowIndex);
  });

  return { ID: data.ID, deleted: true };
}

function normalizePhone_(phone) {
  if (!phone) return '';
  var str = String(phone).trim();
  // Already a full international number (e.g. "+447911123456") chosen
  // via the country-code dropdown — keep it as-is.
  if (str.indexOf('+') === 0) return str;
  // Fallback for legacy/raw input with no "+": assume Sri Lanka.
  var digits = str.replace(/[^\d]/g, '');
  if (digits.indexOf('94') === 0) {
    return '+' + digits;
  }
  if (digits.indexOf('0') === 0) {
    digits = digits.substring(1);
  }
  return '+94' + digits;
}

// ---------------------------------------------------------------------------
// ATTENDANCE
// ---------------------------------------------------------------------------

function getAttendance() {
  var sheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  return sheetToObjects_(sheet);
}

function updateAttendance(data) {
  // data: { id, month, value } -- value is "Present" | "Absent" | "" (blank/Empty)
  // Also accepts legacy boolean true/false for backward compatibility.
  if (!data.id || !data.month) throw new Error('id and month are required.');
  var sheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  var rowIndex = findRowById_(sheet, data.id);
  if (rowIndex === -1) throw new Error('Member not found in Attendance: ' + data.id);

  var colIndex = ATTENDANCE_HEADERS.indexOf(data.month) + 1;
  if (colIndex < 1) throw new Error('Invalid month: ' + data.month);

  var monthIndex = MONTHS.indexOf(data.month);
  var currentMonthIndex = new Date().getMonth(); // 0 = Jan ... 11 = Dec
  if (monthIndex > currentMonthIndex) {
    throw new Error('Cannot mark attendance for a future month.');
  }

  var cellValue;
  if (data.value === true || data.value === 'true' || data.value === 'Present') {
    cellValue = 'Present';
  } else if (data.value === false || data.value === 'false' || data.value === 'Absent') {
    cellValue = 'Absent';
  } else {
    cellValue = ''; // Empty — genuinely blank cell
  }
  sheet.getRange(rowIndex, colIndex).setValue(cellValue);
  return { id: data.id, month: data.month, value: cellValue, saved: true };
}

// ---------------------------------------------------------------------------
// FEES
// ---------------------------------------------------------------------------

function getFees() {
  var sheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  return sheetToObjects_(sheet);
}

function updateFees(data) {
  // data: { id, month, value } -- value is "Paid" | "Pending" | "" (blank/Empty)
  if (!data.id || !data.month) throw new Error('id and month are required.');
  var sheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  var rowIndex = findRowById_(sheet, data.id);
  if (rowIndex === -1) throw new Error('Member not found in Fees: ' + data.id);

  var colIndex = FEES_HEADERS.indexOf(data.month) + 1;
  if (colIndex < 1) throw new Error('Invalid month: ' + data.month);

  var cellValue;
  if (data.value === 'Paid') {
    cellValue = 'Paid';
  } else if (!data.value) {
    cellValue = ''; // Empty — leaves the cell genuinely blank, not a text value
  } else {
    cellValue = 'Pending';
  }
  sheet.getRange(rowIndex, colIndex).setValue(cellValue);
  return { id: data.id, month: data.month, value: cellValue, saved: true };
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

function getSettings() {
  var settings = getRawSettings_();
  // Never expose the admin password to the browser, not even to an
  // already-logged-in admin's own network tab.
  delete settings.adminPassword;
  return settings;
}

function getRawSettings_() {
  var sheet = getSheet_(SHEET_SETTINGS, ['Setting', 'Value']);
  var rows = sheet.getDataRange().getValues().slice(1);
  var settings = Object.assign({}, DEFAULT_SETTINGS);
  rows.forEach(function (row) {
    if (row[0]) settings[row[0]] = row[1];
  });
  return settings;
}

function saveSettings(data) {
  var sheet = getSheet_(SHEET_SETTINGS, ['Setting', 'Value']);
  var keys = Object.keys(DEFAULT_SETTINGS).filter(function (k) { return k !== 'adminPassword'; });
  keys.forEach(function (key) {
    if (typeof data[key] === 'undefined') return;
    var rowIndex = findRowById_(sheet, key);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 2).setValue(data[key]);
    } else {
      sheet.appendRow([key, data[key]]);
    }
  });
  return getSettings();
}

// ---------------------------------------------------------------------------
// ADMIN LOGIN / SESSIONS
// ---------------------------------------------------------------------------
//
// There is one shared Admin password (stored in the Settings sheet, never
// sent back to the browser). A correct password earns the caller a random
// session token that is cached server-side for a few hours; every write
// action must present a still-valid token. This keeps editing locked down
// even if someone tampers with the front-end JavaScript, while letting
// anyone view members, attendance, fees and birthdays without logging in.

function requireAdmin_(token) {
  if (!token || !isValidAdminToken_(token)) {
    throw new Error('Unauthorized. Please log in as Admin to make changes.');
  }
}

function isValidAdminToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get('admin_session_' + token) === 'valid';
}

function adminLogin(data) {
  var password = data && data.password;
  if (!password) throw new Error('Password is required.');
  var settings = getRawSettings_();
  if (String(password) !== String(settings.adminPassword)) {
    throw new Error('Incorrect password.');
  }
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('admin_session_' + token, 'valid', ADMIN_SESSION_SECONDS);
  return { token: token };
}

function adminLogout(data) {
  var token = data && data.token;
  if (token) {
    CacheService.getScriptCache().remove('admin_session_' + token);
  }
  return { ok: true };
}

function changeAdminPassword(data, token) {
  requireAdmin_(token);
  var newPassword = data && data.newPassword;
  if (!newPassword || String(newPassword).trim().length < 4) {
    throw new Error('New password must be at least 4 characters.');
  }
  var sheet = getSheet_(SHEET_SETTINGS, ['Setting', 'Value']);
  var rowIndex = findRowById_(sheet, 'adminPassword');
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2).setValue(newPassword);
  } else {
    sheet.appendRow(['adminPassword', newPassword]);
  }
  return { ok: true };
}
