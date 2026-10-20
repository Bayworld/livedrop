# Put DropLive online for the pilot (about 15 minutes)
1. Make a folder with `index.html` and your real `config.js` (never share the Supabase *service-role* key; the anon key in `config.js` is meant to be public). Optionally add `window.DROPLIVE_CONTACT_EMAIL = 'you@example.com';` to `config.js`.
2. Go to netlify.com → Add new site → Deploy manually → drag the folder in. You get an address like `https://something.netlify.app`.
3. Supabase → Authentication → URL Configuration: set **Site URL** to that address and add it under **Redirect URLs** (needed for confirmation and password-reset links).
4. Email: Supabase's built-in sender is heavily rate-limited. For the pilot either turn off "Confirm email" (Authentication → Providers → Email) or set up your own SMTP sender.
5. Open the live address on your phone and run TEST_PLAN.md before inviting anyone.

## Upgrading the Supabase library (optional, after the pilot)
`public/vendor/supabase.js` is supabase-js 2.45.4. To upgrade: download `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<VERSION>/dist/umd/supabase.js`, choosing an exact version that was published at least two weeks ago, and save it over that file. Then run the three tests in `tests/`, and sign up, log in and reset a password on staging before deploying. Do not use `@latest`.
