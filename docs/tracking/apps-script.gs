/**
 * Synapse Econs and Synapse Tamil: one receiver for sign-ups and usage events.
 * Every row carries an `app` column (synapse-econs or synapse-tamil), so both
 * sites can share one sheet and one web app URL. Rows written before the app
 * column existed have it blank: they all came from Synapse Econs.
 * Paste into a Google Sheet's Apps Script (Extensions > Apps Script), then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * Sign-ups and events: the web app can only ADD rows (and delete a student's own
 * sign-up row when they ask). It cannot read them back, so they stay private to
 * the sheet owner.
 *
 * Passes (doGet, see the PASSES section below): the only thing it answers is
 * "until when does this device's pass run", given the device's random uid.
 *
 * Sheets (created on first use):
 *   Signups      one row per student: name, school, level, email, consent time
 *   Events       one row per page view, finished round, case or paper
 *   Withdrawals  uid and time, when a student deletes their details
 *   Payments     one row per paid Stripe checkout; refunds in Stripe set status to "refunded" within 10 minutes
 *                (you can also type "refunded" in the status cell to cancel a pass by hand)
 *   Devices      extra devices unlocked with an emailed code
 *   Codes        unlock codes waiting to be used (rows are removed once used)
 * Join Events to Signups on the uid column.
 */
var HEADERS = {
  Signups: ['updated', 'uid', 'name', 'school', 'level', 'email', 'consent_at', 'consent_v', 'app'],
  Events: ['received', 'uid', 'event', 'page', 'lab', 'set', 'score', 'of', 'client_ts', 'app'],
  Withdrawals: ['received', 'uid', 'app'],
  Payments: ['received', 'app', 'session', 'email', 'uid', 'pass', 'amount', 'until', 'status', 'payment_intent'],
  Devices: ['linked', 'app', 'session', 'uid', 'email'],
  Codes: ['created', 'app', 'email', 'code', 'tries']
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

/* ===================== PASSES (Stripe) =====================
 * Prices: each Stripe Payment Link's amount (in cents, SGD) decides the app and
 * the pass. Keep these in step with the Payment Links and assets/config.js.
 * Set up once (see SETUP.md): Project Settings > Script Properties > STRIPE_KEY =
 * a restricted Stripe key with read access to Checkout Sessions; then run
 * installSync() once from the editor.
 */
/* One 12-month pass per app (the larger amount). The 30-day amounts are retired but kept so
 * older payments still match. */
var PASSES = {
  'synapse-tamil': { 4900: { pass: 'year', days: 365 }, 1200: { pass: 'month', days: 30 } },
  'synapse-econs': { 6900: { pass: 'year', days: 365 }, 1500: { pass: 'month', days: 30 } }
};
var MAX_DEVICES = 3, CODE_MINUTES = 15, CODES_PER_HOUR = 3;
var SESSION_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;

function stripe_(path) {
  var key = PropertiesService.getScriptProperties().getProperty('STRIPE_KEY');
  if (!key) throw new Error('STRIPE_KEY is not set');
  var r = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Stripe ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}
function rows_(name) {
  var sh = sheet_(name), last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, HEADERS[name].length).getValues();
}
function iso_(d) { return d instanceof Date ? d.toISOString() : String(d || ''); }
function live_(p) { return String(p[8]).toLowerCase() === 'paid' && new Date(p[7]) > new Date(); }
function paymentBySession_(session) {
  var ps = rows_('Payments');
  for (var i = 0; i < ps.length; i++) if (ps[i][2] === session) return ps[i];
  return null;
}

/** Record one paid checkout session (idempotent). Returns its Payments row or null. */
function record_(s) {
  if (!s || s.status !== 'complete' || s.payment_status !== 'paid' || s.currency !== 'sgd') return null;
  var uid = String(s.client_reference_id || '');
  if (!UID_RE.test(uid)) return null;
  var app = '', def = null;
  for (var a in PASSES) if (PASSES[a][s.amount_total]) { app = a; def = PASSES[a][s.amount_total]; }
  if (!def) return null;
  var have = paymentBySession_(s.id);
  if (have) return have;
  var paidAt = new Date(s.created * 1000);
  var until = def.until ? new Date(def.until) : new Date(paidAt.getTime() + def.days * 864e5);
  var email = clean_(((s.customer_details || {}).email || '').toLowerCase(), 120);
  var row = [paidAt, app, s.id, email, uid, def.pass, s.amount_total / 100, until, 'paid', String(s.payment_intent || '')];
  sheet_('Payments').appendRow(row);
  return row;
}

/** The latest live pass end for a device uid in one app ('' if none). */
function untilFor_(app, uid) {
  var best = null, ps = rows_('Payments'), bySession = {};
  ps.forEach(function (p) { if (p[1] === app && live_(p)) bySession[p[2]] = p; });
  ps.forEach(function (p) { if (p[1] === app && p[4] === uid && live_(p) && (!best || new Date(p[7]) > best)) best = new Date(p[7]); });
  rows_('Devices').forEach(function (d) {
    var p = d[1] === app && d[3] === uid ? bySession[d[2]] : null;
    if (p && (!best || new Date(p[7]) > best)) best = new Date(p[7]);
  });
  return best ? best.toISOString() : '';
}

function doGet(e) {
  var p = (e && e.parameter) || {}, app = p.app, lock = LockService.getScriptLock();
  if (!PASSES.hasOwnProperty(app)) return json_({ ok: false });
  try {
    lock.waitLock(20000);
    if (p.a === 'status') {
      if (!UID_RE.test(String(p.uid))) return json_({ ok: false });
      return json_({ ok: true, until: untilFor_(app, String(p.uid)) });
    }
    if (p.a === 'claim') {
      if (!SESSION_RE.test(String(p.s))) return json_({ ok: false });
      var row = paymentBySession_(p.s) || record_(stripe_('checkout/sessions/' + encodeURIComponent(p.s)));
      if (!row || row[1] !== app || !live_(row)) return json_({ ok: false });
      return json_({ ok: true, until: iso_(row[7]), mine: row[4] === String(p.uid || '') });
    }
    if (p.a === 'code') {
      var email = String(p.email || '').trim().toLowerCase();
      var has = rows_('Payments').some(function (r) { return r[1] === app && r[3] === email && live_(r); });
      var hourAgo = Date.now() - 36e5;
      var recent = rows_('Codes').filter(function (c) { return c[2] === email && new Date(c[0]).getTime() > hourAgo; }).length;
      if (has && recent < CODES_PER_HOUR) {
        var code = ('00000' + Math.floor(Math.random() * 1e6)).slice(-6);
        sheet_('Codes').appendRow([new Date(), app, email, "'" + code, 0]);
        var name = app === 'synapse-tamil' ? 'Synapse Tamil' : 'Synapse Econs';
        MailApp.sendEmail(email, name + ' unlock code: ' + code,
          'Your code to unlock ' + name + ' on another device is ' + code + '.\n\nIt works for ' + CODE_MINUTES +
          ' minutes. If you did not ask for it, you can ignore this email.');
      }
      return json_({ ok: true }); // same answer either way, so emails cannot be probed
    }
    if (p.a === 'verify') {
      var em = String(p.email || '').trim().toLowerCase(), uid = String(p.uid || ''), cd = String(p.code || '');
      if (!UID_RE.test(uid) || !/^\d{6}$/.test(cd)) return json_({ ok: false, why: 'code' });
      var csh = sheet_('Codes'), cs = rows_('Codes'), cutoff = Date.now() - CODE_MINUTES * 6e4, hit = 0, idx = -1;
      for (var i = cs.length - 1; i >= 0; i--) {
        if (cs[i][1] !== app || cs[i][2] !== em || new Date(cs[i][0]).getTime() < cutoff || cs[i][4] >= 5) continue;
        if (String(cs[i][3]) === cd) { hit = 1; idx = i; break; }
        csh.getRange(i + 2, 5).setValue(cs[i][4] + 1);
      }
      if (!hit) return json_({ ok: false, why: 'code' });
      csh.deleteRow(idx + 2);
      var pays = rows_('Payments').filter(function (r) { return r[1] === app && r[3] === em && live_(r); })
        .sort(function (a, b) { return new Date(b[7]) - new Date(a[7]); });
      if (!pays.length) return json_({ ok: false, why: 'code' });
      var pay = pays[0], devs = {};
      devs[pay[4]] = 1;
      rows_('Devices').forEach(function (d) { if (d[2] === pay[2]) devs[d[3]] = 1; });
      if (!devs[uid]) {
        if (Object.keys(devs).length >= MAX_DEVICES) return json_({ ok: false, why: 'devices' });
        sheet_('Devices').appendRow([new Date(), app, pay[2], uid, em]);
      }
      return json_({ ok: true, until: iso_(pay[7]) });
    }
    return json_({ ok: false });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Every 10 minutes: record paid checkouts whose buyer never came back to the site. */
function syncPayments() {
  var props = PropertiesService.getScriptProperties();
  var since = Number(props.getProperty('SYNC_SINCE')) || Math.floor(Date.now() / 1000) - 2 * 86400;
  var start = Math.floor(Date.now() / 1000), after = '', lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    for (var page = 0; page < 20; page++) {
      var list = stripe_('checkout/sessions?limit=100&status=complete&created[gte]=' + (since - 3600) + (after ? '&starting_after=' + after : ''));
      list.data.forEach(record_);
      if (!list.has_more || !list.data.length) break;
      after = list.data[list.data.length - 1].id;
    }
    props.setProperty('SYNC_SINCE', String(start));
    syncRefunds_();
  } finally {
    lock.releaseLock();
  }
}
/** Mark a payment refunded once Stripe has refunded all of it (a pending PayNow refund counts). Needs
 *  Refunds: Read on the restricted key; without it this logs a warning and payments still sync. */
function syncRefunds_() {
  try {
    var sh = sheet_('Payments'), pays = rows_('Payments'), sums = {}, after = '';
    var from = Math.floor(Date.now() / 1000) - 120 * 86400; // PayNow refunds are allowed up to 90 days
    for (var page = 0; page < 10; page++) {
      var list = stripe_('refunds?limit=100&created[gte]=' + from + (after ? '&starting_after=' + after : ''));
      list.data.forEach(function (r) {
        if ((r.status === 'succeeded' || r.status === 'pending') && r.payment_intent) sums[r.payment_intent] = (sums[r.payment_intent] || 0) + r.amount;
      });
      if (!list.has_more || !list.data.length) break;
      after = list.data[list.data.length - 1].id;
    }
    pays.forEach(function (p, i) {
      if (String(p[8]).toLowerCase() === 'paid' && p[9] && sums[p[9]] >= Math.round(Number(p[6]) * 100)) sh.getRange(i + 2, 9).setValue('refunded');
    });
  } catch (err) {
    console.warn('Refund sync skipped: ' + err);
  }
}
/** Run once from the editor after setting STRIPE_KEY. Safe to run again. */
function installSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncPayments') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncPayments').timeBased().everyMinutes(10).create();
  syncPayments();
  Logger.log('Payments sync is on: every 10 minutes.');
}

/** Run once from the editor to confirm the script can reach this sheet. */
function selfTest() {
  Object.keys(HEADERS).forEach(sheet_);
  Logger.log('Sheets ready: ' + Object.keys(HEADERS).join(', '));
}
