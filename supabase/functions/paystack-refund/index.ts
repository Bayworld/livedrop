// Admin only. POST { drop_id } with header x-admin-secret. Refunds every paid contribution of a cancelled/failed Drop.
import { admin, env, json, paystack, safeEqual } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!safeEqual(req.headers.get("x-admin-secret") ?? "", env("ADMIN_SECRET"))) return json({ error: "Forbidden" }, 403);
  const { drop_id } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: d } = await db.from("drops").select("id,status").eq("id", String(drop_id ?? "")).maybeSingle();
  if (!d) return json({ error: "Drop not found" }, 404);
  if (!["cancelled", "failed"].includes(d.status)) return json({ error: "Only cancelled or failed Drops can be refunded." }, 400);
  const { data: rows } = await db.from("contributions").select("provider_reference")
    .eq("drop_id", d.id).eq("status", "paid");
  const results: { reference: string; ok: boolean }[] = [];
  for (const row of rows ?? []) {
    const r = await paystack("/refund", { method: "POST", body: JSON.stringify({ transaction: row.provider_reference }) });
    results.push({ reference: row.provider_reference, ok: r.ok });   // status flips to 'refunded' via the webhook
  }
  return json({ requested: results.length, results });
});
