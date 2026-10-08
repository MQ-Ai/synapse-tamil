/**
 * Synapse Tamil reminders (Web Push): stores which devices switched on the
 * challenge-of-the-day reminder, for the sender in api/push.js (Vercel).
 *
 * Add this as a SECOND file in the same Apps Script project as apps-script.gs
 * (Apps Script editor > + > Script, name it Push). apps-script.gs hands every
 * push_ request to the two functions below. Then set PUSH_SECRET (Project Settings >
 * Script Properties) to the same long random text as CRON_SECRET in Vercel, and
 * redeploy (Deploy > Manage deployments > edit > New version). See docs/app/SETUP.md.
 *
 * Sheet "Push" (created on first use): one row per device.
 *   push_sub   from the site: save or refresh a device's subscription
 *   push_done  from the site: today's challenge is done on this device, skip tonight's reminder
 *   push_off   from the site: the student switched reminders off
 *   push_gone  from the sender, with the secret: devices the push service says are gone
 *   push_list  (GET) from the sender, with the secret: every subscription for one app
 */
var PUSH_SHEET = 'Push';
var PUSH_HEADERS = ['updated', 'app', 'uid', 'endpoint', 'sub', 'done_day'];
var PUSH_APPS = { 'synapse-tamil': 1, 'synapse-econs': 1 };
var PUSH_UID_RE = /^[0-9a-f-]{16,64}$/i;
var PUSH_ENDPOINT_RE = /^https:\/\/[^\s]{10,1000}$/;

function pushJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function pushSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(PUSH_SHEET);
  if (!sh) { sh = ss.insertSheet(PUSH_SHEET); sh.appendRow(PUSH_HEADERS); sh.setFrozenRows(1); }
  else if (sh.getRange(1, PUSH_HEADERS.length).getValue() !== PUSH_HEADERS[PUSH_HEADERS.length - 1]) {
    sh.getRange(1, 1, 1, PUSH_HEADERS.length).setValues([PUSH_HEADERS]); /* sheets made before done_day */
  }
  return sh;
}
function pushRows_(sh) {
  var last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, PUSH_HEADERS.length).getValues();
}
/* Singapore day number, the same as dayNum() in assets/daily-pick.js. */
function pushToday_() { return Math.floor((Date.now() + 8 * 3600e3) / 864e5); }
function pushDay_(x) {
  var n = Number(x), t = pushToday_();
  return Math.floor(n) === n && n >= t - 1 && n <= t + 1 ? n : '';
}
function pushSecretOk_(key) {
  var s = PropertiesService.getScriptProperties().getProperty('PUSH_SECRET');
  return !!s && String(key || '') === s;
}

function pushPost_(p) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var sh = pushSheet_(), rows = pushRows_(sh), ev = String(p.event), d = p.data || {}, i;
    if (ev === 'push_gone') {
      if (!pushSecretOk_(p.key) || !Array.isArray(p.endpoints)) return pushJson_({ ok: false });
      var drop = {};
      p.endpoints.forEach(function (x) { drop[String(x)] = 1; });
      for (i = rows.length - 1; i >= 0; i--) if (drop[rows[i][3]]) sh.deleteRow(i + 2);
      return pushJson_({ ok: true });
    }
    if (!PUSH_APPS[p.app] || p.v !== 1 || !PUSH_UID_RE.test(String(p.uid))) return pushJson_({ ok: false });
    if (ev === 'push_sub') {
      var sub = d.sub || {}, keys = sub.keys || {};
      if (!PUSH_ENDPOINT_RE.test(String(sub.endpoint)) || !/^[\w-]{20,200}$/.test(String(keys.p256dh)) ||
          !/^[\w-]{8,100}$/.test(String(keys.auth))) return pushJson_({ ok: false });
      var keep = JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
      var row = 0;
      for (i = 0; i < rows.length; i++) if (rows[i][3] === sub.endpoint) { row = i + 2; break; }
      var done = pushDay_(d.done);
      if (done === '' && row) done = rows[row - 2][5];
      var vals = [new Date(), p.app, String(p.uid), sub.endpoint, keep, done];
      if (row) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
      return pushJson_({ ok: true });
    }
    if (ev === 'push_done') {
      var day = pushDay_(d.day);
      if (day === '') return pushJson_({ ok: false });
      for (i = 0; i < rows.length; i++) if (rows[i][3] === d.endpoint && rows[i][1] === p.app) sh.getRange(i + 2, 6).setValue(day);
      return pushJson_({ ok: true });
    }
    if (ev === 'push_off') {
      for (i = rows.length - 1; i >= 0; i--) if (rows[i][3] === d.endpoint && rows[i][2] === String(p.uid)) sh.deleteRow(i + 2);
      return pushJson_({ ok: true });
    }
    return pushJson_({ ok: false });
  } catch (err) {
    console.error(err);
    return pushJson_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function pushGet_(p) {
  if (p.a !== 'push_list' || !pushSecretOk_(p.key) || !PUSH_APPS[p.app]) return pushJson_({ ok: false });
  var subs = [];
  pushRows_(pushSheet_()).forEach(function (r) {
    if (r[1] !== p.app) return;
    try { subs.push({ uid: r[2], sub: JSON.parse(r[4]), done: r[5] === '' ? null : Number(r[5]) }); } catch (e) {}
  });
  return pushJson_({ ok: true, subs: subs });
}
