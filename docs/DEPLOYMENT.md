# Deploy DropLive for the no-money pilot

Use a NEW Supabase project for the pilot. Never run these on a project holding real data without a backup.

## 1. Run the migrations in this order (Supabase > SQL Editor, one file at a time)
000, 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 013, 014, 015, 016, 017.

**Do NOT run `012_v0_10_0_payments_ENABLE_LAST.sql`.** It is for the real payment launch. 014 will print a notice that `close_expired_drops` is missing; that is expected in the pilot.

If a file errors, stop and send me the exact message. Do not skip ahead.

## 2. Turn on pg_cron
Database > Extensions > pg_cron. Then re-run 014 and 017 so the schedules (reminders, stale pledge expiry) get created.

## 3. Auth settings (Authentication > URL Configuration)
Site URL = your site address. Add the same address under Redirect URLs.

## 4. Email
Built-in email is heavily limited. Either turn off "Confirm email" for the pilot, or add your own SMTP. Test password reset on your own phone first.

## 5. Config
Copy `public/config.example.js` to `public/config.js` and fill in the project URL and the anon/publishable key only. Keep `DROPLIVE_PAYMENTS_ENABLED = false`. Set `DROPLIVE_CONTACT_EMAIL` to an inbox you read. Never put the service-role key in this file.

## 6. Host
Upload the `public` folder contents to Netlify (see HOSTING.md). The `_headers` file adds the security headers.

## 7. Check before inviting anyone
- In SQL Editor: `select value from app_settings where key='payments_enabled';` must say `false`.
- Do the full journey yourself with two accounts (one creator, one fan): sign up, create a Drop, pledge, withdraw, pledge again, Mark paid, check totals, Mark refunded.
- Run the tests locally: `python3 tests/static-audit.py`, `python3 tests/actions-test.py`, `python3 tests/mobile-audit.py`.

## Backups and rollback
Supabase dashboard > Database > Backups (daily on paid plans; on the free plan export with the SQL editor before changes). Rollback for a bad site upload: redeploy the previous folder in Netlify. Database changes are additive; to undo 016/017 drop the new objects only after taking an export.

## Reset a test environment
Create a fresh Supabase project and rerun the migrations. Do not wipe the pilot project while testers are using it.
