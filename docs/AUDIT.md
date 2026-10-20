# DropLive v0.16.1 audit (what was checked, and how)

Status key: VERIFIED = I ran it and saw the result. READ = I read the source or SQL but did not run it. UNVERIFIED = needs a live Supabase project. BLOCKED = needs an account or access I do not have.

Limits of this audit: no Postgres, no Supabase project and no network were available, so nothing below was run against a real database, a real email provider or Paystack.

| Area | Status | Evidence | Gap / action |
|---|---|---|---|
| Static audit (JS syntax, handlers, ids, secrets, dangerous calls) | VERIFIED | `tests/static-audit.py`: all clear | none |
| Click-through UI tests (tabs, filters, modals, no JS errors) | VERIFIED | `tests/actions-test.py`: all PASS | local mock mode only |
| Mobile layout (5 viewport sizes) | VERIFIED | `tests/mobile-audit.py`: "all clear" | only a couple of 14px link targets at tablet width |
| Sign-up, login, password reset code | READ | `account-auth.js` calls `signUp`, `resetPasswordForEmail`, `updateUser` | Email delivery UNVERIFIED (see HOSTING.md step 4) |
| Creator/fan separation | READ | RLS and guard triggers in 005, 007, 010, 011, 015 | UNVERIFIED on live DB |
| Drop create/edit/cancel | READ | `requests-dashboard.js`, `drop-edit.js`, guard trigger | cancel with paid pledges now blocked (017) |
| Funding totals and supporter counts | READ | only security-definer functions change `raised_amount` (guard trigger) | concurrency relies on `for update` row locks; not load-tested |
| Duplicate pending pledges | FIXED in 016, UNVERIFIED | unique partial index | run 016 on staging |
| Pledge withdraw, expiry, manual refund | FIXED in 017, UNVERIFIED | `fan_cancel_pledge`, `expire_stale_pledges`, `creator_mark_pledge_refunded` | needs pg_cron for expiry |
| Category filter and search/sort | FIXED in 016, VERIFIED only for syntax and click tests | `explore.js` | try with real Drops |
| No-money pilot mode | READ | `DROPLIVE_PAYMENTS_ENABLED=false` in `config.example.js`; DB `payments_enabled='false'` (011); manual confirm only works while off | see warning below |
| Paystack init, verify, webhook, refund | UNVERIFIED / BLOCKED | functions in `supabase/functions`; `tests/payments.test.ts` not run (needs Deno) | do not enable for pilot |
| Secrets in repo | VERIFIED | static audit "secrets: []" | keep service-role key out of `config.js` |
| Privacy page | FIXED | support-email placeholder now fills from `DROPLIVE_CONTACT_EMAIL` | you must set it |
| Under-18 testers | OPEN, your decision | the privacy page has a children section; no age gate in code | get school and guardian consent; see PILOT_PACK.md |
| Clean-DB migration run | BLOCKED | no Postgres here | run migrations in order on staging (DEPLOYMENT.md) |
| End-to-end test with real accounts | BLOCKED | needs a live project | use the task list in PILOT_PACK.md as the manual test |
| Supabase client library | VERIFIED version | `vendor/supabase.js` is supabase-js 2.45.4 (the official browser build, identical to the file you sent); I know of no specific flaw in it, but it is not current | upgrade after the pilot: see HOSTING.md |
| Load, rate-limit and bot protection | PARTIAL | pledge rate limit in 010; no CAPTCHA | acceptable for a small invited pilot |

## Known behavior to tell testers
- Pledges are promises. No money moves. A creator "Mark paid" only unlocks access; it is not proof of payment.
- Expired or withdrawn pledges are cancelled, not deleted.
- A refund here is a record that the creator returned money outside the app.

## Release gate (honest result)
Passed: static audit, UI click tests, mobile audit. Not yet proven: migrations on a clean database, real sign-up/email, the full journey with real accounts. So this is READY FOR STAGING TESTING, not yet "ready for students" until you complete DEPLOYMENT.md steps 1-6 and the journey in PILOT_PACK.md works for you first.
