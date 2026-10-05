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
