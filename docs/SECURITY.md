# Security notes (honest status)
## In place
- Row Level Security on every table; the browser only holds the public anon key.
- Pledges are created `pending` only; `paid` cannot be set from the browser. Session links are readable only by the creator and paid backers.
- Session links must be https (database check + app check).
- Output escaping on all user text; XSS bug in display-name handlers fixed in v0.9.0.
- Security headers, frame blocking, restricted `connect-src`.
- Per-user rate limits and size limits (migration 010).
## Known gaps (do before real money)
1. **CSP still allows `'unsafe-inline'` scripts** because the HTML uses 78 inline `onclick` handlers. Fix: move to one delegated click listener using `data-action` attributes, then remove `'unsafe-inline'` from `script-src`. This is the top engineering item.
2. **Supabase library loads from a CDN.** Download supabase-js 2.45.4 into `public/vendor/`, load it from there, and tighten `script-src` to `'self'`.
3. **Payments:** verify Paystack payments only in a server-side webhook (Supabase Edge Function) that checks the signature, then marks `paid`. Never trust the browser.
4. Turn on Supabase: email confirmation, leaked-password protection, CAPTCHA (Turnstile) on sign-up, and daily backups.
5. Use a separate staging project; never test migrations on production.
6. Nothing is unhackable. The goal is layered defence plus monitoring (Sentry, Supabase logs, uptime checks).


## Update v0.12.0
Inline handlers are gone (data-act dispatcher in js/ui/actions.js) and script-src is now 'self' only. supabase-js is vendored in public/vendor/. Still open: self-host fonts, remove style 'unsafe-inline', schedule close_expired_drops() with pg_cron.
