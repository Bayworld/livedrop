# Deploy to Vercel (via GitHub)

Vercel does not read `public/_headers` (that is a Netlify file). The same security headers live in `vercel.json`;
`tests/deploy-check.py` fails if the two ever differ, so change both together.

## One-time setup
1. Push this folder to a **private** GitHub repository (commands below).
2. vercel.com > Add New > Project > import the repository. Leave Framework as **Other**; `vercel.json` already sets the build command and the `public` output folder.
3. Before the first deploy, open **Environment Variables** and add (Production, Preview and Development):
   - `SUPABASE_URL` = `https://YOUR-REF.supabase.co`
   - `SUPABASE_ANON_KEY` = the **publishable / anon** key (never the secret or service_role key; the build refuses it)
   - `CONTACT_EMAIL` = optional, shown in the footer and Terms
   - Do **not** set `PAYMENTS_ENABLED` until payments launch.
4. Deploy. The build writes `public/config.js` from those variables, so nothing secret is committed.

## Right after the first deploy (login breaks without this)
- Supabase > Authentication > URL Configuration: set **Site URL** to your Vercel address (or custom domain) and add it under **Redirect URLs**, plus `https://*-YOURTEAM.vercel.app/**` if you want preview deploys to log in.
- Supabase Edge Function secret: `supabase secrets set SITE_URL=https://your-domain` so emails link to the live site.
- Open the site on your phone and run `docs/TEST_PLAN.md`.

## Day to day
- Push to `main` = production deploy. Pull requests get a preview URL.
- GitHub Actions runs the test suites on every push (`.github/workflows/ci.yml`). In Vercel > Settings > Git you can require the checks to pass first.
- Database migrations are NOT run by Vercel. Run new `supabase/migrations/*.sql` files in the Supabase SQL editor (staging first).
- Edge Functions deploy with `supabase functions deploy <name>`, separately from Vercel.

## Custom domain
Vercel > Settings > Domains. After it works, update Supabase Site URL/Redirect URLs and the `SITE_URL` secret to the new domain.
