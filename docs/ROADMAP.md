# DropLive roadmap (numbering follows the migration files: 000 to 014)

## Done
- 000-009: schema, onboarding, marketplace, identity/security, trust, pilot hardening, invites, delivery
- 010 hardening (rate limits, reports) · 011 lifecycle + in-app notifications · 012 payments (built, OFF, run last) · 013 live room (questions, ratings, report)
- 014 (v0.13.0): creator earnings, one-hour reminders, scheduled jobs, email notifications (Edge Function), Terms/Privacy rewrite, fonts no longer loaded from Google, session-call batching (429 fix)

## Before the pilot (in this order)
1. Fill the highlighted placeholders in Terms/Privacy and have a Nigerian lawyer sign off.
2. Run 014 on staging; set up the notify-email webhook (see README); enable pg_cron.
3. Run docs/TEST_PLAN.md on the live site with 1 creator and 2 fans (mark pledges paid by hand).

## Open risks (after v0.16.0)
- A refund here only records that the creator returned the money; DropLive does not move it. Keep the real refund process documented for pilot creators.
- Pledges are confirmed by the creator on trust until Paystack is on, so keep pilot creators hand-picked.
- vendor/supabase.js is 2.45.4; upgrade steps are at the end of docs/HOSTING.md.

## Next
- Paystack test-mode verification, then 012 at launch: creator payouts + KYC, receipts by email
- Shareable Drop previews (OG images), search/sort on Explore, calendar reminders
- Admin screen for reports and verification
- Self-host fonts (add woff2 files under public/fonts and @font-face; system fonts are used until then)
- Sentry, uptime monitor, backups, custom domain, CAPTCHA on sign-up
- Built-in video only after demand is proven (sessions use external links)
