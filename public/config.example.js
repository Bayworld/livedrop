// Rename this file to config.js for local testing after creating a Supabase project.
// The Supabase anon/publishable key is safe to expose in browser code when Row Level Security is configured correctly.
window.DROPLIVE_SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
window.DROPLIVE_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY';
// Payments stay OFF until the very end (see docs/PAYMENTS.md). Do not set true before then.
window.DROPLIVE_PAYMENTS_ENABLED = false;
// Optional: shown as a Contact link in the footer and Terms page.
window.DROPLIVE_CONTACT_EMAIL = '';
