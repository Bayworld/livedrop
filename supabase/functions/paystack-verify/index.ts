// POST { reference } (signed-in fan, after returning from Paystack) -> { status }
import { admin, authedUser, json, preflight, settle } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await authedUser(req);
  if (!user) return json({ error: "Please sign in first." }, 401);
  let body: { reference?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const reference = String(body?.reference ?? "");
  if (!/^dl_[0-9a-f]{32}$/.test(reference)) return json({ error: "Invalid reference." }, 400);
  const db = admin();
  const { data: c } = await db.from("contributions").select("fan_id").eq("provider_reference", reference).maybeSingle();
  if (!c || c.fan_id !== user.id) return json({ error: "Payment not found." }, 404);
  await settle(reference, `verify:${reference}`);
  const { data: after } = await db.from("contributions").select("status").eq("provider_reference", reference).maybeSingle();
  return json({ status: after?.status ?? "unknown" });
});
