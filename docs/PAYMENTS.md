# Payments (Paystack) — setup and operations
> **STATUS: built but switched OFF.** Do this last. Switch-on order: (1) Paystack TEST setup below, (2) run migration `012_v0_10_0_payments_ENABLE_LAST.sql`, (3) `update public.app_settings set value='true' where key='payments_enabled';`, (4) set `window.DROPLIVE_PAYMENTS_ENABLED = true;` in config.js, (5) run TEST_PLAN steps 16-23 in test mode, (6) only then switch to live keys.

## How money flows
1. Fan taps CONTRIBUTE -> `paystack-init` creates a pending record (amount read from the Drop, never from the browser) and returns a Paystack checkout link.
2. Fan pays on Paystack's page. Card data never touches DropLive.
3. Paystack calls `paystack-webhook`. We check the signature, re-verify the transaction with Paystack's API, check amount + currency, then `mark_contribution_paid` updates the Drop atomically. The fan also lands on `?payment=<ref>` where `paystack-verify` confirms (covers a slow webhook).
4. Goal reached -> Drop becomes `unlocked`. Deadline passes below goal -> `close_expired_drops()` marks it `failed`. Cancelled or failed -> run `paystack-refund`.
## One-time setup
1. Paystack account: create it, start with TEST keys. Live keys need your business approved (KYC) by Paystack.
2. Run `supabase/migrations/012_v0_10_0_payments_ENABLE_LAST.sql` (staging first).
3. Install the Supabase CLI, then:
```
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx SITE_URL=https://your-site.netlify.app ADMIN_SECRET=$(openssl rand -hex 32)
supabase functions deploy paystack-init
supabase functions deploy paystack-verify
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy paystack-refund --no-verify-jwt
```
4. Paystack Dashboard -> Settings -> API Keys & Webhooks: set the webhook URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook` (test and live are separate).
5. Optional: enable pg_cron and schedule `close_expired_drops()` (command is in the migration).
6. The secret key lives ONLY in Supabase secrets. Never put it in `config.js` or the repo.
## Refunding a failed or cancelled Drop
```
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-refund \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" -H "Content-Type: application/json" -d '{"drop_id":"<uuid>"}'
```
Each contribution flips to `refunded` when Paystack's `refund.processed` webhook arrives. Refunds are admin-triggered in this version (not automatic).
## Going live: decisions only you can make
- **Where the money sits:** payments settle to YOUR Paystack balance. Paying creators is manual (bank transfer) for now. Holding funds on behalf of others can carry regulatory duties in Nigeria: ask a lawyer and Paystack about their marketplace options (split payments / subaccounts) before real volume.
- **DropLive's fee:** none is charged yet. Paystack's own fees come out of what you receive; check their current pricing.
- **Terms:** publish a refund policy that matches the rule above.
## Not verified
Nothing here has run against real Paystack or a real database (no network from my environment). The signature/amount logic is unit-tested (`tests/payments.test.ts`). Before real money, run the new TEST_PLAN steps in Paystack TEST mode. Confirm the `refund.processed` payload field names in test mode (the code accepts `transaction_reference` or `reference`).
