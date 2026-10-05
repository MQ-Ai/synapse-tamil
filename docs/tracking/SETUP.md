# Switching on sign-up and tracking for Synapse Tamil

Synapse Tamil sends its sign-ups and events to the **same Google Sheet and web app URL as Synapse Econs**. Every row now carries an `app` column (`synapse-econs` or `synapse-tamil`), so you can filter one from the other. Older Econs rows have that column blank.

## One-time update (about 3 minutes), before this goes live
The current Econs script only accepts Econs data, so do this first or Tamil sign-ups are silently dropped.

1. Open the Synapse Econs users sheet, then **Extensions → Apps Script**.
2. Replace all the code with everything in `docs/tracking/apps-script.gs` from this repo and click **Save**.
3. **Deploy → Manage deployments**, click the pencil on the existing web app, set **Version: New version**, then **Deploy**. The URL stays the same, so neither site's `assets/config.js` needs to change.
4. Merge and deploy Synapse Tamil. Open it in a private window, answer one question, then try a second: the form should appear. Sign up with a test name, finish a round, and check the `Signups` and `Events` tabs for rows with `app` = `synapse-tamil`. Delete the test rows afterwards.

The first time the new script runs it adds the `app` header to the existing tabs by itself.

## How "first question free" works in Tamil
One question across the whole site is free: one drill card in any lab, one pair in ஒலி's pair drill, one line in செய்யுள் Build, one phrase, or one question on an exam paper. Starting a second one opens the form, which cannot be closed. After signing up, the blocked answer goes through automatically. Reading tabs (rules, lists, phrase bank, past papers) stay open to everyone.

## What is collected and where it lives
- Signups tab: name, school, level (Primary 3 to 6 or Other), email. The email label says "yours or a parent's", since most users are primary pupils.
- Events tab: page, lab, set, score and time for page views, finished drill rounds and checked exam papers, linked to the signup by a random `uid`. Nothing else.
- It lives only in your Google Sheet. The public web app can add rows but cannot read any.
- To answer an access or deletion request sent to the contact email, find the row by email in Signups and delete it.
- Learning progress stays in the browser exactly as before. If the browser blocks storage, the site still works and simply never asks for sign-up.

## Before pupils use it
Users here are mostly under 13. Please check with whoever handles PDPA at your school that the one-line purpose notice is enough, and whether a parent's consent or email should be required.

# Switching on passes (payments)

Until the Payment Links are pasted into `assets/config.js`, nothing changes for users: everything stays free after sign-in. This is the same for Synapse Econs, which shares this script.

## How it works
- After sign-in, each lab section is free until its first round is finished. Exam papers need a pass, and in Econs only the first Data case is free. The free count is kept in the browser.
- The pay screen offers two one-off passes through Stripe Payment Links (PayNow or card). Tamil also shows "Ask a parent to pay" with a WhatsApp link that sends the pay link to a parent.
- After paying, Stripe sends the buyer back to the site with the checkout id. The site asks this script, the script asks Stripe whether it was paid, writes a row to `Payments`, and the device unlocks. If a parent pays on their own phone, the pass goes to the child's device, which unlocks the next time it opens the site.
- Every 10 minutes the script also collects paid checkouts from Stripe, in case someone closed the tab before coming back.
- On another device, "Unlock this one" emails a 6-digit code (from your Gmail) to the email used at checkout. Each pass works on up to 3 devices; see the `Devices` tab.

## One-time setup (about 30 minutes plus Stripe's identity check)
1. **Stripe account.** Sign up at stripe.com as a Singapore business (sole proprietor is fine). Under **Settings → Payment methods**, turn on **PayNow** and cards.
2. **Products and links.** Create four Payment Links, one per pass, in SGD:
   | App | Pass | Price | After payment, redirect to |
   | --- | --- | --- | --- |
   | Synapse Tamil | Exam-year pass (to 31 Dec 2027) | 49.00 | `https://synapse-tamil.vercel.app/?paid={CHECKOUT_SESSION_ID}` |
   | Synapse Tamil | 30-day pass | 12.00 | same as above |
   | Synapse Econs | Exam-year pass (to 31 Dec 2027) | 69.00 | `https://synapse-econs.vercel.app/?paid={CHECKOUT_SESSION_ID}` |
   | Synapse Econs | 30-day pass | 15.00 | same as above |

   For each link: **After payment → Don't show confirmation page → Redirect** to the address above, typed exactly, including `{CHECKOUT_SESSION_ID}`. Leave quantity fixed at 1 and promotion codes off. The script tells the passes apart by price, so every price must be different.
3. **Key for the script.** In Stripe, **Developers → API keys → Create restricted key**. Give it **Read** on **Checkout Sessions** and **Read** on **Refunds**, and nothing else. In the Apps Script editor open **Project Settings → Script Properties**, add `STRIPE_KEY` with that key. Never put it in the website. Without Refunds access, payments still work but refunds must be marked by hand.
4. **Update the script.** Paste the new `apps-script.gs` and **Deploy → Manage deployments → edit → New version** (same URL). Then select `installSync` in the editor's function menu and click **Run**. Approve the new permissions (Stripe access, sending email, timed runs).
5. **Paste the links.** Put each Payment Link (`https://buy.stripe.com/...`) into `link` in each site's `assets/config.js`, then deploy.
6. **Receipts.** In Stripe, **Settings → Customer emails**, turn on **Successful payments**, so buyers get the receipt the thank-you screen promises.
7. **Test first.** Stripe has a test mode (sandbox) with its own links and key. Do steps 2 to 5 there first, with the sandbox restricted key and the `buy.stripe.com/test_...` links on a branch, and pay with card `4242 4242 4242 4242`. Check the site unlocks and a row appears in `Payments`, then refund it in Stripe and confirm the row changes to `refunded` within 10 minutes. Then repeat steps 2 to 5 with live keys and links on `main`, and do one live S$12 PayNow purchase and refund.

## Running it
- **Refunds:** refund in the Stripe dashboard. Within about 10 minutes the script sets the row's `status` to `refunded` (a PayNow refund counts as soon as it is pending), and the pass stops on its devices within a day. Partial refunds don't cancel a pass. If the key has no Refunds access, type `refunded` in the cell yourself.
- **More devices for one family:** add a row to `Devices` with the same `session` and the new device's id, or ask me to raise `MAX_DEVICES`.
- **Changing prices or the end date:** change the Payment Link in Stripe, `PASSES` at the top of the pass section in `apps-script.gs`, and `price` / `until` in `assets/config.js`, all together.
- Email codes come from your Gmail; Google allows about 100 a day on a personal account.
