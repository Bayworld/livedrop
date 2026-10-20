// Emails the user for each new row in public.notifications.
// Setup: Dashboard > Database > Webhooks > create on table "notifications", event INSERT, type Supabase Edge Function -> notify-email,
// with HTTP header  x-webhook-secret: <same value as WEBHOOK_SECRET>.
// Secrets: supabase secrets set RESEND_API_KEY=... WEBHOOK_SECRET=... MAIL_FROM="DropLive <hello@yourdomain>" SITE_URL=https://yourdomain
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });
  let rec: any;
  try { rec = (await req.json())?.record; } catch { return new Response("Bad request", { status: 400 }); }
  if (!rec?.user_id || !rec?.title) return new Response("Ignored", { status: 200 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.getUserById(rec.user_id);
  const to = data?.user?.email;
  if (error || !to) return new Response("No recipient", { status: 200 });

  const site = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  const link = typeof rec.link === "string" && /^\?[A-Za-z0-9=&_.@%-]{1,200}$/.test(rec.link) && site ? site + "/" + rec.link : site;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto"><h2 style="margin:0 0 8px">${esc(rec.title)}</h2>` +
    (rec.body ? `<p style="color:#444">${esc(rec.body)}</p>` : "") +
    (link ? `<p><a href="${esc(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open DropLive</a></p>` : "") +
    `<p style="color:#888;font-size:12px">You get this because you have a DropLive account.</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to: [to], subject: rec.title, html }),
  });
  if (!res.ok) { console.error("Resend failed", res.status, await res.text()); return new Response("Mail failed", { status: 502 }); }
  return new Response("ok");
});
