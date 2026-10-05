/**
 * Synapse Econs and Synapse Tamil: one receiver for sign-ups and usage events.
 * Every row carries an `app` column (synapse-econs or synapse-tamil), so both
 * sites can share one sheet and one web app URL. Rows written before the app
 * column existed have it blank: they all came from Synapse Econs.
 * Paste into a Google Sheet's Apps Script (Extensions > Apps Script), then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * The web app can only ADD rows (and delete a student's own sign-up row when
 * they ask). It cannot read anything back, so the data stays private to the
 * sheet owner.
 *
 * Sheets (created on first use):
 *   Signups      one row per student: name, school, level, email, consent time
 *   Events       one row per page view, finished round, case or paper
 *   Withdrawals  uid and time, when a student deletes their details
 * Join Events to Signups on the uid column.
 */
var HEADERS = {
  Signups: ['updated', 'uid', 'name', 'school', 'level', 'email', 'consent_at', 'consent_v', 'app'],
  Events: ['received', 'uid', 'event', 'page', 'lab', 'set', 'score', 'of', 'client_ts', 'app'],
  Withdrawals: ['received', 'uid', 'app']
};
var UID_RE = /^[0-9a-f-]{16,64}$/i;
var EVENTS_OK = { view: 1, round: 1, 'case': 1, paper: 1 };
var LEVELS_OK = {
  'synapse-econs': { JC1: 1, JC2: 1, Other: 1 },
  'synapse-tamil': { 'Primary 3': 1, 'Primary 4': 1, 'Primary 5': 1, 'Primary 6': 1, Other: 1 }
};

function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 100);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // stop spreadsheet formula injection
}
function num_(v) { var n = Number(v); return isFinite(n) ? n : ''; }

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < HEADERS[name].length) {
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]); // add the app column to an older sheet
  }
  return sh;
}
function findRow_(sh, uid) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === uid) return i + 2;
  return 0;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var p = JSON.parse(e.postData.contents);
    if (!p || !LEVELS_OK.hasOwnProperty(p.app) || p.v !== 1 || !UID_RE.test(String(p.uid))) return json_({ ok: false });
    var uid = String(p.uid), now = new Date(), ev = String(p.event), app = p.app;
    lock.waitLock(20000);

    if (ev === 'signup') {
      var pr = p.profile || {};
      if (!LEVELS_OK[app].hasOwnProperty(pr.level) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(pr.email || ''))) return json_({ ok: false });
      var sh = sheet_('Signups'), row = findRow_(sh, uid);
      var vals = [now, uid, clean_(pr.name, 80), clean_(pr.school, 80), pr.level, clean_(pr.email, 120), clean_(pr.consent_at, 40), num_(pr.consent_v), app];
      if (row) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    } else if (ev === 'withdraw') {
      var s2 = sheet_('Signups'), r2 = findRow_(s2, uid);
      if (r2) s2.deleteRow(r2);
      sheet_('Withdrawals').appendRow([now, uid, app]);
    } else if (EVENTS_OK[ev]) {
      var d = p.data || {};
      sheet_('Events').appendRow([now, uid, ev, clean_(p.page, 30), clean_(d.lab, 30), clean_(d.set, 30), num_(d.score), num_(d.of), clean_(p.ts, 40), app]);
    } else {
      return json_({ ok: false });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Run once from the editor to confirm the script can reach this sheet. */
function selfTest() {
  sheet_('Signups'); sheet_('Events'); sheet_('Withdrawals');
  Logger.log('Sheets ready: Signups, Events, Withdrawals');
}
