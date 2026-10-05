# Synapse Tamil as an app: install, challenge of the day, reminders

## What students get

- **Install.** On Android (Chrome) and computers, a "Put Synapse Tamil on your home screen"
  button appears on `/daily`. On iPhone/iPad it is Safari's Share > Add to Home Screen; the page
  shows the steps. Installed, it opens full screen with its own icon and works offline for
  pages already visited.
- **Challenge of the day** at `/daily`: three quick questions from three different labs
  (sound pairs, participles, vocabulary, case markers), the same for everyone on a given
  Singapore day. Free for everyone; it does not count towards the one free question before
  sign-up, and it never shows source or school names.
- **Streak.** A 🔥 counter and a 7-day row, stored on the device. The nav shows the streak on
  every page. Doing today's challenge (any score) keeps it going.
- **Reminders.** After finishing the challenge, "Turn on reminders". One notification a day
  at about 7pm Singapore time with a teaser of the first question. Tapping it opens `/daily`.

The install, the challenge and the streak work as soon as this is deployed. Reminders stay
hidden until the steps below are done.

## What only you can do (about 15 minutes, once)

### 1. Make the push keys

On any computer with Node.js:

```
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep the private key secret.

Also make one long random text to use as a shared password, for example from
<https://www.random.org/strings/> or `openssl rand -hex 32`. Below it is called **the secret**.

### 2. Vercel settings (synapse-tamil project > Settings > Environment Variables, Production)

| Name | Value |
| --- | --- |
| `CRON_SECRET` | the secret |
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `SHEET_URL` | the Apps Script web app URL (the `endpoint` in `assets/config.js`, ends in `/exec`) |
| `VAPID_SUBJECT` | optional: `mailto:sage.synapse@gmail.com` (the default) |

Vercel runs `/api/push` every day at 11:00 UTC (7pm Singapore) from `vercel.json`. On the
free Hobby plan, Vercel may run it any time within that hour. It sends `CRON_SECRET` itself.

### 3. Apps Script (the same sheet as sign-ups)

1. Open the sheet > Extensions > Apps Script.
2. In the main file, add the two lines marked `// reminders: apps-script-push.gs` from
   `docs/tracking/apps-script.gs` (one at the top of `doPost`, one at the top of `doGet`).
   Do not paste the whole file over yours: your live copy has newer pass prices.
3. Click **+ > Script**, name it `Push`, and paste all of `docs/tracking/apps-script-push.gs`.
4. Project Settings (gear) > Script Properties > Add: `PUSH_SECRET` = the secret.
5. Deploy > Manage deployments > edit (pencil) > Version: **New version** > Deploy. The URL
   stays the same.

A **Push** tab appears in the sheet when the first device switches reminders on.

### 4. Turn the button on

Paste the **public** key into `assets/config.js`:

```js
window.SYNAPSE_PUSH = {
  publicKey: 'B...your public key...'
};
```

Commit and deploy. (Or tell Claude the public key and it will do this step.)

### 5. Test on your own phone

1. Open the site, do today's challenge, tap **Turn on reminders** and allow notifications.
   On iPhone, add it to the Home Screen first and open it from there.
2. Visit `https://synapse-tamil.vercel.app/api/push?key=THE_SECRET&dry=1`. It shows how many
   devices are signed up and today's message, without sending.
3. Send a real one to everyone: `.../api/push?key=THE_SECRET`
   Or your own message: `.../api/push?key=THE_SECRET&title=Well%20done&body=Prelims%20tomorrow!`

Treat links with the secret like a password: anyone with it can send a notification.

## Limits worth knowing

- **iPhone/iPad:** reminders only work on iOS/iPadOS 16.4 or newer, and only after the app is
  added to the Home Screen and opened from there. In plain Safari the button is replaced by
  the add-to-home-screen steps.
- **Android and computers:** work in Chrome, Edge, Firefox and Samsung Internet, installed or not.
- **Notifications can be switched off** by the student or a parent at any time in phone
  settings; dead devices are removed from the Push tab automatically on the next send.
- **The streak lives on the device.** A new phone or cleared browser data starts it again.
  The reminder is the same for everyone; it does not know who has kept their streak.
- **Not in the App Store or Play Store.** Students install it from the website.

## If you later want store apps

| Option | What it adds | Cost | Effort |
| --- | --- | --- | --- |
| Play Store listing (Trusted Web Activity, e.g. via PWABuilder) | Found by searching Play Store; same site inside | US$25 once (Google developer account) | A day or two, plus Google review; the site needs `/.well-known/assetlinks.json` |
| App Store (iOS wrapper, e.g. Capacitor) | Found on the App Store; push without "add to home screen" | US$99 a year (Apple developer program) + a Mac for building | One to two weeks; Apple often rejects apps that are only a website, so it needs app-only features (offline packs, native notifications) to pass review |
| Fully native apps | Smoother feel, widgets, streak shown on the lock screen | Same fees, plus ongoing developer time | Months; two codebases to keep in step with the site |

The website app covers the "install + daily nudge" goal for most students without these.
A sensible next step, if needed, is the Play Store listing alone, since it reuses everything here.

## Files

- `manifest.webmanifest`, `assets/icons/` (rendered from `docs/app/icon.html` by `docs/app/render-icons.js`)
- `sw.js`: offline, and shows the notifications
- `assets/app.js`: install button, streak, reminders sign-up, the 🔥 nav link
- `daily.html`, `assets/daily-pick.js`, `assets/daily.json`
- `scripts/build-daily.js`: rebuilds `assets/daily.json` from the labs. Run `node scripts/build-daily.js` after changing lab questions.
- `api/push.js`: the sender. `package.json` exists only for its `web-push` library.
- `docs/tracking/apps-script-push.gs`: stores subscriptions in the sheet.
