/* Synapse Tamil as an app: service worker, install button, streak and reminders.
   Reminders stay hidden until assets/config.js sets SYNAPSE_PUSH.publicKey (see
   docs/app/SETUP.md). Subscriptions go to the same Apps Script as sign-ups. */
(function () {
  'use strict';
  var PUSH = window.SYNAPSE_PUSH || {}, TRACK = window.SYNAPSE_TRACK || {};
  var SK = 'synapse-tamil-streak-v1', DK = 'synapse-tamil-device-v1', PK = 'synapse-tamil-push-v1', RK = 'synapse-tamil-push-done-v1';
  var installEvt = null, listeners = [];

  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  function standalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }

  /* ---------- service worker + install ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').then(syncPush, function () {}); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; changed(); });
  window.addEventListener('appinstalled', function () { installEvt = null; changed(); });

  /* ---------- streak (per device) ---------- */
  function dayNum() { return Math.floor((Date.now() + 8 * 3600e3) / 864e5); } /* Singapore day */
  function streak() {
    var s = get(SK) || { last: -1, count: 0, best: 0, days: [] }, today = dayNum();
    var alive = s.last === today || s.last === today - 1;
    return { count: alive ? s.count : 0, best: s.best, doneToday: s.last === today, days: s.days || [], lost: !alive && s.count > 1 ? s.count : 0, result: s.last === today ? s.result : null };
  }
  function markDone(result) {
    var s = get(SK) || { last: -1, count: 0, best: 0, days: [] }, today = dayNum();
    if (s.last !== today) {
      s.count = s.last === today - 1 ? s.count + 1 : 1;
      s.best = Math.max(s.best || 0, s.count);
      s.days = (s.days || []).concat(today).slice(-60);
      s.last = today;
      if (result && typeof result.score === 'number' && result.of) {
        var h = get('synapse-tamil-history-v1') || [];
        h.push({ e: 'daily', lab: 'daily', set: '', score: result.score, of: result.of, t: Date.now() });
        set('synapse-tamil-history-v1', h.slice(-200));
      }
    }
    s.result = result;
    set(SK, s);
    changed();
    reportDone();
    return streak();
  }

  /* ---------- reminders (Web Push) ---------- */
  function uid() {
    var p = get('synapse-tamil-profile-v1');
    if (p && p.uid) return p.uid;
    var d = get(DK);
    if (!d) {
      try { d = crypto.randomUUID(); } catch (e) {
        d = 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function () { return Math.floor(Math.random() * 16).toString(16); });
      }
      set(DK, d);
    }
    return d;
  }
  function pushSupported() {
    return !!(PUSH.publicKey && TRACK.endpoint && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }
  /* 'off' (not set up), 'needs-install' (iPhone in Safari), 'blocked', 'on', 'ready' (can be turned on) */
  function pushState() {
    if (!PUSH.publicKey || !TRACK.endpoint) return 'off';
    if (isIOS && !standalone()) return 'needs-install';
    if (!pushSupported()) return 'off';
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' && get(PK) ? 'on' : 'ready';
  }
  function key(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function post(event, data) {
    return fetch(TRACK.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ app: 'synapse-tamil', v: 1, uid: uid(), event: event, ts: new Date().toISOString(), data: data || {} }) });
  }
  function saveSub(sub) {
    var j = sub.toJSON();
    var today = dayNum();
    return post('push_sub', { sub: j, done: streak().doneToday ? today : null }).then(function () {
      set(PK, j.endpoint); if (streak().doneToday) set(RK, today); changed();
    });
  }
  /* Today's practice is done: tell the sheet, so tonight's reminder skips this device. */
  function reportDone() {
    var today = dayNum(), ep = get(PK);
    if (!ep || !streak().doneToday || get(RK) === today || !pushSupported()) return;
    post('push_done', { endpoint: ep, day: today }).then(function () { set(RK, today); }, function () {});
  }
  function enablePush() {
    if (!pushSupported()) return Promise.reject(new Error('unsupported'));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { changed(); throw new Error(perm); }
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(PUSH.publicKey) });
      });
    }).then(saveSub);
  }
  function disablePush() {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      return post('push_off', { endpoint: sub.endpoint }).then(function () { return sub.unsubscribe(); });
    }).then(function () { try { localStorage.removeItem(PK); } catch (e) {} changed(); });
  }
  /* The browser can swap a subscription for a new one; send the new one when that happens. */
  function syncPush(reg) {
    if (!pushSupported() || Notification.permission !== 'granted' || !get(PK)) return;
    reg.pushManager.getSubscription().then(function (sub) {
      if (!sub) return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(PUSH.publicKey) });
      return sub;
    }).then(function (sub) { if (sub && sub.endpoint !== get(PK)) return saveSub(sub); reportDone(); }).catch(function () {});
  }

  /* ---------- nav: a "Today" link on every page ---------- */
  function navLink() {
    var links = document.querySelector('.nav-links');
    if (!links || links.querySelector('[data-page="daily"]')) return;
    var a = document.createElement('a'), s = streak();
    a.href = '/daily'; a.setAttribute('data-page', 'daily');
    a.innerHTML = s.count ? '🔥 ' + s.count + '<small>Streak</small>' : 'இன்று ✨<small>Today</small>';
    a.title = 'Challenge of the day';
    if (/\/daily(\.html)?$/.test(location.pathname)) a.className = 'active';
    var home = links.querySelector('[data-page="home"]');
    links.insertBefore(a, home ? home.nextSibling : links.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', navLink); else navLink();

  window.synApp = {
    isIOS: isIOS, standalone: standalone, dayNum: dayNum,
    canInstall: function () { return !!installEvt; },
    install: function () {
      if (!installEvt) return Promise.resolve(false);
      var e = installEvt; e.prompt();
      return e.userChoice.then(function (c) { installEvt = null; changed(); return c.outcome === 'accepted'; });
    },
    streak: streak, markDone: markDone,
    pushState: pushState, enablePush: enablePush, disablePush: disablePush,
    onChange: function (f) { listeners.push(f); }
  };
})();
