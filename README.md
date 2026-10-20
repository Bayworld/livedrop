**Deploying:** see docs/VERCEL.md (GitHub then Vercel). `vercel.json` holds the security headers, `scripts/build-config.mjs` creates `public/config.js` from environment variables, and `.github/workflows/ci.yml` runs the tests on every push.

**v0.16.1** Adds docs/AUDIT.md (honest status of every area), docs/DEPLOYMENT.md (migration order, settings, checks) and docs/PILOT_PACK.md (teacher note, tester guide, tasks, bug report, questionnaire). The privacy page now shows your `DROPLIVE_CONTACT_EMAIL`. Start with DEPLOYMENT.md.

---
**v0.16.0** Run `supabase/migrations/017_v0_16_0_pledge_safety.sql` after 016. Fans can withdraw a pending pledge (My Activity). Pending pledges close themselves once a Drop's deadline passes or the Drop is closed (needs pg_cron, same as 014). While payments are off, creators can mark a paid pledge refunded from the dashboard, and a Drop that still has paid supporters can no longer be cancelled until they are refunded. Not run against a live database: try 016 and 017 on staging first.

---
**v0.15.0** Run `supabase/migrations/016_v0_15_0_growth.sql` after 015. Fixes: (1) the Explore category chips never matched real Drops (the column did not exist), so Drops now carry a category chosen when they are created; (2) a fan could stack duplicate pending pledges on one Drop and a creator confirming each would inflate funding, so the database now allows one pending pledge per fan per Drop (existing duplicates are collapsed). Adds search and sort on Explore. Not run against a live database: try 016 on staging first.

---
**v0.14.0 (pilot)** Marking a pledge paid also notifies the fan (in-app bell + email once notify-email is set up). Run `supabase/migrations/015_v0_14_0_pilot.sql` after 014. Adds: (1) a Drop cannot GO LIVE without a session link; (2) creators confirm pledges as paid from the dashboard while payments are off (PENDING PLEDGES panel), which unlocks the fan's Live Room and join link and updates funding; (3) Live Room and Join card update themselves every 20s; (4) Accepting a request offers to create the Drop immediately. NOT tested against a real Supabase database (no network here): run docs/TEST_PLAN.md on a staging project first.

---
**v0.13.0** Run `supabase/migrations/014_v0_13_0_ops.sql` (after 013). Changes: creator Earnings section; one-hour reminders; pg_cron schedules; email notifications; full Terms/Privacy; Google Fonts removed; fewer auth calls on page load (fixes the 429 on `/auth/v1/token`).

**Email setup (once):** `supabase functions deploy notify-email`, then `supabase secrets set RESEND_API_KEY=... WEBHOOK_SECRET=... MAIL_FROM="DropLive <hello@yourdomain>" SITE_URL=https://yourdomain`. In Dashboard > Database > Webhooks create a webhook on table `notifications`, event INSERT, target the `notify-email` function, with header `x-webhook-secret` = your WEBHOOK_SECRET. Enable the `pg_cron` extension before running 014.

**If you still see 429 on /token:** wait a few minutes, test in a private window, and raise the token-refresh limit under Authentication > Rate Limits. Upgrading `public/vendor/supabase.js` to a current supabase-js release is also recommended (this build had no internet to fetch one).

---
**v0.12.0** adds Report, a Live room (questions + ratings) and a strict script CSP. Run `supabase/migrations/013_v0_12_0_live_room.sql`. Run all tests in `tests/` (now includes `actions-test.py`).

# DropLive v0.11.1 — creator button fix + mobile layer. (v0.11.0: request lifecycle + notifications (payments built but switched OFF))

**Run `supabase/migrations/011_v0_11_0_lifecycle_notifications.sql` once (after 010).** Then deploy `public/` with your `config.js`.

What's new
- **Accept a request:** creators get an ACCEPT button (then CREATE DROP). The fan and everyone who backed the request are notified. Decline notifies them too.
- **Drop lifecycle:** creator GO LIVE and END SESSION buttons on the dashboard (database-enforced, via `set_drop_phase`). Fans see LIVE NOW on the Drop page. Before payments are on, a creator can go live from "funding" so you can test; once `payments_enabled` is true a Drop must be funded first.
- **Notifications:** bell in the nav with unread count and an inbox. Triggers: new fan request (creator), request accepted/declined/converted, new Drop from a followed creator, Drop funded/live/cancelled. Email can be added later from the same table.
- **Payments are OFF.** `config.js` flag `DROPLIVE_PAYMENTS_ENABLED=false`. The Paystack code and `012_..._ENABLE_LAST.sql` are in the zip but unused. See docs/PAYMENTS.md for the switch-on steps (last).
- Built-in video: not started. Sessions still use a private link; the lifecycle is ready for a video provider to plug in later.

Tests: `python3 tests/mobile-audit.py` (5 screen sizes), `python3 tests/static-audit.py`, `tests/browser-smoke.py`, `tests/flows-mock.py` (fake database, proves the browser calls), `node --experimental-strip-types tests/payments.test.ts`.

---
# (previous) v0.10.0 payments (built, switched off). Start with docs/PAYMENTS.md. Run `012_v0_10_0_payments_ENABLE_LAST.sql` only at launch.

---
# (previous) v0.9.0 — structured, hardened foundation

## Folder structure
```
public/                  <- the ONLY folder you deploy
  index.html             page markup
  css/styles.css         original styles
  css/polish.css         v0.9.0 visual refinements (hover, motion, skeletons)
  js/core/               utils (escaping, toast), boot (error handling), data (Supabase client)
  js/features/           one file per feature area (explore, pledge, auth, dashboard...)
  js/ui/                 panel switching
  _headers               security headers + CSP (Netlify / Cloudflare Pages)
  404.html, robots.txt, manifest.webmanifest, icon-*.png
  config.js              YOUR keys (not in this zip; copy your working one in)
supabase/migrations/     numbered SQL, run in order, once each (000 -> 011)
supabase/functions/      Paystack Edge Functions (init, verify, webhook, refund)
docs/                    HOSTING, TEST_PLAN, DECISION_LOG, SECURITY, ROADMAP
tests/                   static-audit.py, browser-smoke.py (Playwright), payments.test.ts (Node)
```

## Upgrade from v0.8.1
1. Copy your working `config.js` into `public/`.
2. Run `supabase/migrations/010_v0_9_0_hardening.sql` once (rate limits, size limits, reports table). Try it on a staging project first: it is untested against a live database.
3. Deploy the `public/` folder (see docs/HOSTING.md). Netlify will pick up `_headers` automatically.
4. Run `python3 tests/static-audit.py` and `python3 tests/browser-smoke.py`, then docs/TEST_PLAN.md on the live site.

## What changed in v0.9.0
- **Security fix:** creator display names were inserted into inline `onclick` attributes with incomplete escaping, so a crafted name could run script in other users' browsers (stored XSS). `escapeJs` now escapes correctly and `escapeHtml` covers single quotes. Covered by tests.
- Code split from one 143KB file into 13 files with no behaviour change.
- Security headers + CSP, rate limits on Drops/requests/pledges/reports, input length limits, reports table.
- PWA icons and manifest, 404 page, robots.txt, polish layer.

See docs/SECURITY.md and docs/ROADMAP.md.
