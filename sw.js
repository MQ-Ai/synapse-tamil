/* Synapse Tamil service worker: lets the site install as an app, open offline with
   the pages already visited, and show challenge-of-the-day reminders.
   Pages and files always come from the network first, so a new deploy shows up at
   once; the cached copy is only used when there is no connection. */
'use strict';
var CACHE = 'synapse-tamil-v1';
var PRECACHE = ['/', '/daily', '/assets/daily.json', '/assets/daily-pick.js', '/assets/app.js',
  '/assets/config.js', '/assets/track.js', '/favicon.svg', '/assets/icons/icon-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') === 0) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('/daily') : Response.error());
    });
  }));
});

/* Reminders: api/push.js sends { title, body, url, tag }. */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Synapse Tamil', {
    body: d.body || 'Your challenge of the day is ready ✨',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: d.tag || 'daily',
    renotify: true,
    data: { url: d.url || '/daily?source=push' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = new URL((e.notification.data && e.notification.data.url) || '/daily', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.location.origin) === 0 && 'focus' in list[i]) {
        return list[i].navigate(target).then(function (c) { return (c || list[i]).focus(); }, function () { return list[i].focus(); });
      }
    }
    return self.clients.openWindow(target);
  }));
});
