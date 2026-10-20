# DropLive decision log
## v0.4.0
- Roles gate the UI and the database (drops insert requires creator/both). Chose: keep self-service role switch (no privileged roles exist yet).
- Display names are presentation only. Ownership and routing use UUIDs.
- Raised amounts will come only from verified paid contributions (server-side, future). Until then both public page and dashboard show 0 paid.
- Postponed: real payments, live video, claim flow for unregistered creators, module split of index.html.
- Known: self-contributions to own Drop are blocked; existing fan-owned Drops stay readable but their owner needs Creator mode to create more.
## v0.5.0
- Verified is manual (SQL) until a real review process exists; protects against impersonation of famous names.
- Request backing is a non-binding signal, kept separate from contributions/payments.
- Postponed: real payments, notifications, supporter perks, moving the pitch panels to a separate page, replacing alert() with in-page messages.
## v0.6.0
- Removed pitch-deck content from the product; it made claims (escrow, fees, refunds) that do not exist yet.
- Supabase email settings (confirmation on/off, redirect URL) decide sign-up behavior; app handles both.

## Global standard checklist (open items)
- Per-Drop WhatsApp/Twitter link previews need server-rendered og tags (edge function or prerender); client JS cannot do it.
- Security headers (CSP, HSTS, X-Frame-Options) must be set at the host (Netlify/Vercel/Cloudflare), not in HTML.
- Paystack payments + webhook-verified paid status; refund/dispute policy; creator payout + KYC.
- Email/WhatsApp notifications to creators; email on pledge confirmation.
- Lawyer-reviewed Terms/Privacy; NDPR (Nigeria) data-protection compliance; cookie/consent note.
- Moderation: report button, block, takedown contact, rate limiting (Supabase), abuse of requests.
- Analytics (privacy-friendly), error monitoring (Sentry), uptime check, database backups.
- Automated browser tests (Playwright) in CI; staging Supabase project separate from production.
- Accessibility pass (screen reader labels, contrast), self-hosted fonts, SRI on third-party scripts.
- Self-serve delivery: how the live session actually happens (link/room/ticket) after a Drop funds.
