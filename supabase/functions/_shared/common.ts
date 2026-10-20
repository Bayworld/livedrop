import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { chargeMatches, safeEqual } from "./verify.ts";
export { safeEqual };

export const env = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing secret: ${k}`);
  return v;
};
export const siteUrl = () => env("SITE_URL").replace(/\/+$/, "");
export const admin = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const cors = () => ({
  "Access-Control-Allow-Origin": siteUrl(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(), "Content-Type": "application/json" } });
export const preflight = (req: Request) => req.method === "OPTIONS" ? new Response("ok", { headers: cors() }) : null;

export async function authedUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

export async function paystack(path: string, init: RequestInit = {}) {
  const r = await fetch("https://api.paystack.co" + path, {
    ...init,
    headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}`, "Content-Type": "application/json" },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && body.status === true, status: r.status, body };
}

// Confirms a payment with Paystack itself (never trusts the caller), then marks it paid in the database.
export async function settle(reference: string, eventId: string) {
  const db = admin();
  const { data: c } = await db.from("contributions").select("id,amount,status").eq("provider_reference", reference).maybeSingle();
  if (!c) return { ok: false, reason: "unknown_reference" };
  if (c.status === "paid") return { ok: true, already: true };
  const v = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!v.ok) return { ok: false, reason: "verify_unavailable", transient: true };
  const tx = v.body.data;
  if (tx.status !== "success") return { ok: false, reason: `payment_${tx.status}` };
  if (!chargeMatches(tx, { reference, amountNaira: Number(c.amount) })) {
    await db.from("payment_events").insert({ event_id: `mismatch:${eventId}`, reference, kind: "mismatch", payload: tx });
    return { ok: false, reason: "amount_mismatch" };
  }
  const { data, error } = await db.rpc("mark_contribution_paid", { p_reference: reference, p_event_id: eventId, p_payload: tx });
  if (error) return { ok: false, reason: "db_error", transient: true };
  return data;
}
