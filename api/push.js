/* Sends the challenge-of-the-day reminder to every subscribed device.
   Vercel Cron calls it once a day (vercel.json). Dr Ali can also call it by hand:
     /api/push?key=SECRET&dry=1                 how many devices, and the message, without sending
     /api/push?key=SECRET&to=UID                send today's reminder to one device only (testing)
     /api/push?key=SECRET&title=...&body=...    send your own message to everyone
   Settings (Vercel > Project > Settings > Environment Variables), see docs/app/SETUP.md:
     CRON_SECRET        long random text; the same value as PUSH_SECRET in the Apps Script
     VAPID_PUBLIC_KEY   from `npx web-push generate-vapid-keys` (also in assets/config.js)
     VAPID_PRIVATE_KEY  from the same command; keep it secret
     SHEET_URL          the Apps Script web app URL (same as assets/config.js endpoint)
     VAPID_SUBJECT      optional, mailto: address push services can contact */
'use strict';
const webpush = require('web-push');
const pool = require('../assets/daily.json');
const daily = require('../assets/daily-pick.js');

const APP = 'synapse-tamil';
const BATCH = 50;

function todaysMessage() {
  const first = daily.pick(pool, daily.dayNum())[0].item;
  let teaser = first.ask || first.q.replace(/_{2,}/g, '____');
  if (teaser.length > 90) teaser = teaser.slice(0, 87) + '…';
  return {
    title: 'Challenge of the day ✨',
    body: teaser + '\n3 quick questions. Keep your streak going! 🔥',
    url: '/daily?source=push',
    tag: 'daily'
  };
}

async function sheet(method, body, query) {
  const url = process.env.SHEET_URL + (query ? (process.env.SHEET_URL.includes('?') ? '&' : '?') + query : '');
  const r = await fetch(url, method === 'POST'
    ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' }
    : { redirect: 'follow' });
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) { throw new Error('Apps Script did not answer with JSON (' + r.status + '): ' + text.slice(0, 120)); }
}

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET || '';
  const q = req.query || {};
  if (!secret || (req.headers.authorization !== 'Bearer ' + secret && q.key !== secret)) {
    return res.status(401).json({ ok: false, error: 'not allowed' });
  }
  const missing = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'SHEET_URL'].filter((k) => !process.env[k]);
  if (missing.length) return res.status(500).json({ ok: false, error: 'missing settings: ' + missing.join(', ') });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:sage.synapse@gmail.com',
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const custom = !!(q.title || q.body);
  const msg = custom
    ? { title: String(q.title || 'Synapse Tamil').slice(0, 80), body: String(q.body || '').slice(0, 240), url: String(q.url || '/daily?source=push'), tag: 'news' }
    : todaysMessage();

  const list = await sheet('GET', null, 'app=' + APP + '&a=push_list&key=' + encodeURIComponent(secret));
  if (!list || !list.ok) return res.status(502).json({ ok: false, error: 'Apps Script refused push_list (check PUSH_SECRET)' });
  let subs = list.subs || [];
  /* The daily reminder skips devices that already did today's challenge (push_done).
     A custom message, or a test to one device, still goes to everyone asked for. */
  let skipped = 0;
  if (q.to) subs = subs.filter((s) => s.uid === q.to);
  else if (!custom) {
    const today = daily.dayNum();
    const left = subs.filter((s) => s.done !== today);
    skipped = subs.length - left.length;
    subs = left;
  }
  if (q.dry) return res.json({ ok: true, dry: true, devices: subs.length, skipped, message: msg });

  let sent = 0, failed = 0;
  const gone = [];
  const payload = JSON.stringify(msg);
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(subs.slice(i, i + BATCH).map((s) =>
      webpush.sendNotification(s.sub, payload, { TTL: 6 * 3600, urgency: 'normal', topic: msg.tag })
        .then(() => { sent++; })
        .catch((err) => {
          failed++;
          if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.sub.endpoint);
          else console.warn('push failed', err.statusCode, String(err.body || err.message).slice(0, 200));
        })));
  }
  /* Devices that uninstalled or switched reminders off in settings: remove them from the sheet. */
  if (gone.length) {
    try { await sheet('POST', { app: APP, v: 1, event: 'push_gone', key: secret, endpoints: gone }); }
    catch (e) { console.warn('could not tidy the sheet', e.message); }
  }
  console.log(JSON.stringify({ sent, failed, skipped, removed: gone.length }));
  return res.json({ ok: true, devices: subs.length, sent, failed, skipped, removed: gone.length, message: msg.title });
};
