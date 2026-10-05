/* Synapse passes: free first round in each lab, then a one-off pass.
   Dormant until assets/config.js gives SYNAPSE_PAY at least one Stripe Payment Link.
   Shared by Synapse Tamil and Synapse Econs; the app id comes from config.js.

   After sign-in, each lab section is free until its first round is finished (or
   FREE_TRIES answers, if a round is left half done). Exam papers are pass-only,
   and in the Data lab only the first case is free. The pass check runs through
   the same Apps Script as sign-up: it asks Stripe whether a checkout was paid and
   remembers which devices hold a pass. Loads after track.js. */
(function () {
  'use strict';
  var T = window.SYNAPSE_TRACK || {}, C = window.SYNAPSE_PAY || {};
  var EP = T.endpoint || '', APP = C.app || '';
  var PASSES = ['year', 'month'].filter(function (k) { return C[k] && /^https:\/\/buy\.stripe\.com\//.test(C[k].link || ''); });
  if (!EP || !APP || !PASSES.length) return;

  var PK = APP + '-profile-v1', UK = APP + '-unlock-v1', SK = APP + '-pass-v1';
  var FREE_TRIES = 60, DAY = 864e5;
  var NAME = APP === 'synapse-tamil' ? 'Synapse Tamil' : 'Synapse Econs';
  var CONTACT = (T.contact || '').replace(/[<>&"]/g, '');
  var COVERS = C.covers || 'every round in all labs', SHORT = C.short || 'Every lab';

  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function profile() { return get(PK); }
  function pass() { return get(SK); }
  function paid() { var p = pass(); return !!(p && p.until && new Date(p.until) > new Date()); }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

  function api(params) {
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(EP + '?app=' + APP + '&' + q, { method: 'GET' }).then(function (r) { return r.json(); });
  }
  function save(until) { set(SK, { until: until || '', checked: Date.now() }); }
  /* ask the script whether this device holds a pass; network errors keep what we have */
  function refresh() {
    var p = profile();
    if (!p || !p.uid) return Promise.resolve(paid());
    return api({ a: 'status', uid: p.uid }).then(function (r) {
      if (r && r.ok) save(r.until || '');
      return paid();
    }, function () { return paid(); });
  }

  /* ---------- free allowance per lab section ---------- */
  var SUBS = { pair: 1, phrase: 1, build: 1, paper: 1 };
  function section(key) {
    var parts = String(key).split(':');
    return parts[0] + (SUBS[parts[1]] ? ':' + parts[1] : '');
  }
  function unlocked(key) {
    var sec = section(key), u = get(UK) || { done: {}, tries: {}, cases: {} };
    if (/:paper$/.test(sec)) return false;
    if (sec === 'data') {
      var sid = String(key).split(':')[1];
      if (!u.cases.first) { u.cases.first = sid; set(UK, u); }
      return u.cases.first === sid;
    }
    if (u.done[sec]) return false;
    u.tries[sec] = (u.tries[sec] || 0) + 1; set(UK, u);
    return u.tries[sec] <= FREE_TRIES;
  }
  var baseTrack = window.synTrack;
  window.synTrack = function (event, data) {
    if (event === 'round' && data && data.lab) {
      var u = get(UK) || { done: {}, tries: {}, cases: {} };
      u.done[String(data.lab).replace(/-pairs$/, ':pair')] = 1; set(UK, u);
    }
    if (baseTrack) return baseTrack(event, data);
  };

  var baseAllow = window.synAllow;
  window.synAllow = function (key, resume) {
    if (baseAllow && !baseAllow(key, resume)) return false; /* sign-in form is showing */
    if (!profile() || paid() || unlocked(key)) return true;
    open('offer', resume);
    return false;
  };

  /* ---------- styles ---------- */
  var css = '' +
    '#syn-pay{position:fixed;inset:0;z-index:1001;background:rgba(8,14,22,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,Catamaran,system-ui,sans-serif}' +
    '#syn-pc{--c-bg:#fff;--c-ink:#15302e;--c-mut:#5b6b68;--c-line:#dad8cc;--c-acc:#1e5a55;--c-on:#fff;--c-bad:#b03a33;--c-soft:#f3f1ea;' +
    'background:var(--c-bg);color:var(--c-ink);border-radius:14px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
    '@media (prefers-color-scheme:dark){#syn-pc{--c-bg:#17221f;--c-ink:#e6eeea;--c-mut:#98a9a4;--c-line:#2a3834;--c-acc:#7fc3b8;--c-on:#0c1311;--c-bad:#ee8a80;--c-soft:#1f2c28}}' +
    '#syn-pc h2{font:800 22px/1.2 Catamaran,Inter,system-ui,sans-serif;margin:0 0 6px}' +
    '#syn-pc p{margin:0 0 12px;font-size:14px;line-height:1.5;color:var(--c-mut)}' +
    '#syn-pc a.opt{display:block;text-decoration:none;color:var(--c-ink);border:1px solid var(--c-line);border-radius:12px;padding:12px 14px;margin:0 0 10px;background:transparent}' +
    '#syn-pc a.opt.p{border:2px solid var(--c-acc);background:var(--c-soft)}' +
    '#syn-pc a.opt b{display:flex;justify-content:space-between;gap:10px;font:700 16px Catamaran,Inter,system-ui,sans-serif}' +
    '#syn-pc a.opt em{font-style:normal}' +
    '#syn-pc a.opt span{display:block;font-weight:400;font-size:13px;color:var(--c-mut);margin-top:2px}' +
    '#syn-pc .small{font-size:12px;color:var(--c-mut);margin:10px 0 0}' +
    '#syn-pc .small a,#syn-pc a.lnk{color:var(--c-acc)}' +
    '#syn-pc label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}' +
    '#syn-pc input{width:100%;box-sizing:border-box;font:16px Inter,system-ui,sans-serif;padding:10px 12px;border-radius:10px;border:1px solid var(--c-line);background:transparent;color:var(--c-ink)}' +
    '#syn-pc .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}' +
    '#syn-pc button{font:600 15px Catamaran,Inter,system-ui,sans-serif;padding:10px 18px;border-radius:10px;border:1px solid var(--c-line);background:transparent;color:var(--c-ink);cursor:pointer}' +
    '#syn-pc button.p{background:var(--c-acc);border-color:var(--c-acc);color:var(--c-on)}' +
    '#syn-pc a:focus-visible,#syn-pc button:focus-visible,#syn-pc input:focus-visible{outline:3px solid var(--c-acc);outline-offset:2px}' +
    '#syn-pe{color:var(--c-bad);font-size:13px;min-height:1em;margin:8px 0 0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- modal ---------- */
  var ov = null, resumeFn = null, lastFocus = null;
  function close() {
    if (!ov) return;
    document.removeEventListener('keydown', onKey, true);
    ov.remove(); ov = null;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function onKey(e) {
    if (!ov) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = ov.querySelectorAll('input,button,a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function unlockedNow() {
    close();
    if (resumeFn) { var f = resumeFn; resumeFn = null; setTimeout(f, 60); }
  }
  function linkFor(k) {
    var p = profile() || {};
    return C[k].link + (C[k].link.indexOf('?') > -1 ? '&' : '?') +
      'client_reference_id=' + encodeURIComponent(p.uid || '') +
      (p.email ? '&prefilled_email=' + encodeURIComponent(p.email) : '');
  }
  function optHtml(k) {
    var o = C[k], yr = k === 'year';
    return '<a class="opt' + (yr ? ' p' : '') + '" data-k="' + k + '" href="' + esc(linkFor(k)) + '">' +
      '<b>' + (yr ? 'Exam-year pass' : '30-day pass') + '<em>' + esc(o.price) + '</em></b>' +
      '<span>' + esc(SHORT) + (yr ? ' until ' + esc(o.until) : ' for 30 days') + '</span></a>';
  }
  function view(mode) {
    var p = profile() || {};
    var foot = '<p class="small">One-off payment by PayNow or card. Nothing renews. Full refund within 7 days' +
      (CONTACT ? ': email ' + CONTACT : '') + '. <a href="terms" target="_blank" rel="noopener">Terms and privacy</a></p>';
    if (mode === 'offer') {
      var wa = C.parent && C.year ? 'https://wa.me/?text=' + encodeURIComponent(NAME + ' exam-year pass for ' + (p.name || 'my child') +
        ' (' + C.year.price + ', until ' + C.year.until + '): ' + linkFor(PASSES[0])) : '';
      return '<h2 id="syn-ph">Unlock all of ' + NAME + '</h2>' +
        '<p>You\'ve had the free round here. A pass opens ' + esc(COVERS) + '.</p>' +
        PASSES.map(optHtml).join('') +
        (wa ? '<p style="margin-top:4px">Ask a parent to pay. <a class="lnk" href="' + esc(wa) + '" target="_blank" rel="noopener">Send them the link on WhatsApp</a></p>' : '') +
        foot +
        '<div class="row"><button type="button" id="syn-pchk">I\'ve paid</button><button type="button" id="syn-px">Not now</button></div>' +
        '<p class="small"><a href="#" id="syn-prest">Paid on another phone or computer? Unlock this one</a></p><div id="syn-pe" role="alert"></div>';
    }
    if (mode === 'restore') {
      return '<h2 id="syn-ph">Unlock this device</h2>' +
        '<p>Enter the email used to pay. We\'ll email you a 6-digit code.</p>' +
        '<label for="syn-pem">Email</label><input id="syn-pem" type="email" autocomplete="email" value="' + esc(p.email || '') + '">' +
        '<div class="row"><button type="button" class="p" id="syn-psend">Email me a code</button><button type="button" id="syn-px">Cancel</button></div>' +
        '<div id="syn-pcode" hidden><label for="syn-pcd">Code</label><input id="syn-pcd" inputmode="numeric" autocomplete="one-time-code" maxlength="6">' +
        '<div class="row"><button type="button" class="p" id="syn-pver">Unlock</button></div></div><div id="syn-pe" role="alert"></div>';
    }
    return '<h2 id="syn-ph">' + esc(mode.h) + '</h2><p>' + esc(mode.p) + '</p>' +
      '<div class="row"><button type="button" class="p" id="syn-px">OK</button></div>';
  }
  function open(mode, resume) {
    if (resume !== undefined) resumeFn = resume || null;
    if (ov) ov.remove(); else lastFocus = document.activeElement;
    ov = document.createElement('div'); ov.id = 'syn-pay';
    ov.innerHTML = '<div id="syn-pc" role="dialog" aria-modal="true" aria-labelledby="syn-ph">' + view(mode) + '</div>';
    document.body.appendChild(ov);
    document.removeEventListener('keydown', onKey, true); document.addEventListener('keydown', onKey, true);
    var $ = function (id) { return ov.querySelector('#' + id); }, err = function (m) { var e = $('syn-pe'); if (e) e.textContent = m; };
    if ($('syn-px')) $('syn-px').onclick = close;
    if (mode === 'offer') {
      $('syn-prest').onclick = function (e) { e.preventDefault(); open('restore'); };
      $('syn-pchk').onclick = function () {
        err('Checking…');
        refresh().then(function (ok) {
          if (ok) unlockedNow();
          else err('No payment found for this device yet. If you paid just now, wait a minute and try again.');
        });
      };
      /* a parent may already have paid from their own phone */
      refresh().then(function (ok) { if (ok && ov && $('syn-pchk')) unlockedNow(); });
    }
    if (mode === 'restore') {
      $('syn-psend').onclick = function () {
        var em = $('syn-pem').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { err('Please enter a valid email address.'); return; }
        err('Sending…');
        api({ a: 'code', email: em }).then(function () {
          err(''); $('syn-pcode').hidden = false; $('syn-pcd').focus();
          $('syn-pe').textContent = 'If that email has a pass, a code is on its way. Check spam too.';
        }, function () { err('Could not reach the server. Check your connection.'); });
      };
      $('syn-pver').onclick = function () {
        var p = profile() || {}, em = $('syn-pem').value.trim(), cd = $('syn-pcd').value.trim();
        if (!/^\d{6}$/.test(cd)) { err('The code has 6 digits.'); return; }
        err('Checking…');
        api({ a: 'verify', email: em, code: cd, uid: p.uid || '' }).then(function (r) {
          if (r && r.ok && r.until) { save(r.until); unlockedNow(); return; }
          err(r && r.why === 'devices' ? 'This pass is already on 3 devices.' + (CONTACT ? ' Email ' + CONTACT + ' to move it.' : '')
            : 'That code did not match, or it has expired.');
        }, function () { err('Could not reach the server. Check your connection.'); });
      };
    }
    setTimeout(function () { var f = ov && ov.querySelector('a.opt,input,button.p'); if (f) f.focus(); }, 0);
  }

  /* ---------- coming back from Stripe: ?paid={CHECKOUT_SESSION_ID} ---------- */
  function claim() {
    var m = /[?&]paid=(cs_[A-Za-z0-9_]+)/.exec(location.search);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    var p = profile() || {};
    open({ h: 'Confirming your payment…', p: 'This takes a few seconds.' });
    api({ a: 'claim', s: m[1], uid: p.uid || '' }).then(function (r) {
      if (r && r.ok && r.until) {
        if (r.mine) {
          save(r.until);
          open({ h: 'Thank you, you\'re unlocked', p: SHORT + ' is open until ' + day(r.until) + '.' });
        } else {
          open({ h: 'Payment received, thank you', p: 'The pass is on your child\'s device. It unlocks the next time they open ' + NAME + '. A receipt is in your email.' });
        }
      } else {
        open({ h: 'Payment not confirmed yet', p: 'If you were charged, the pass unlocks by itself within 10 minutes.' + (CONTACT ? ' Still locked after that? Email ' + CONTACT + '.' : '') });
      }
    }, function () {
      open({ h: 'Payment not confirmed yet', p: 'We could not reach the server. If you were charged, the pass unlocks by itself within 10 minutes.' });
    });
  }

  function init() {
    claim();
    var p = pass();
    if (profile() && (!p || Date.now() - (p.checked || 0) > DAY)) refresh(); /* daily re-check picks up refunds and other-device payments */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
