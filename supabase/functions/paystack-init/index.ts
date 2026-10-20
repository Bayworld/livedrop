// POST { drop_id }  (signed-in fan)  ->  { authorization_url, reference }
import { admin, authedUser, json, paystack, preflight, siteUrl } from "../_shared/common.ts";
import { toKobo } from "../_shared/verify.ts";

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await authedUser(req);
  if (!user || !user.email) return json({ error: "Please sign in first." }, 401);
  let body: { drop_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const dropId = String(body?.drop_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(dropId)) return json({ error: "Invalid Drop." }, 400);

  const db = admin();
  const { data: d } = await db.from("drops")
    .select("id,title,creator_id,status,deadline,contribution_amount").eq("id", dropId).maybeSingle();
  if (!d) return json({ error: "Drop not found." }, 404);
  if (d.creator_id === user.id) return json({ error: "You cannot back your own Drop." }, 400);
  if (!["funding", "unlocked", "live"].includes(d.status) || (d.deadline && new Date(d.deadline) <= new Date()))
    return json({ error: "Funding for this Drop has closed." }, 400);
  const { data: paid } = await db.from("contributions").select("id")
    .eq("drop_id", d.id).eq("fan_id", user.id).eq("status", "paid").limit(1);
  if (paid?.length) return json({ error: "You are already backing this Drop." }, 409);

  // Abandoned checkouts are retired; a late payment on one is still honoured by mark_contribution_paid.
  await db.from("contributions").update({ status: "failed" })
    .eq("drop_id", d.id).eq("fan_id", user.id).eq("status", "pending");

  const reference = "dl_" + crypto.randomUUID().replaceAll("-", "");
  const ins = await db.from("contributions").insert({
    drop_id: d.id, fan_id: user.id, amount: d.contribution_amount, currency: "NGN",
    payment_provider: "paystack", provider_reference: reference, status: "pending",
  });
  if (ins.error) return json({ error: ins.error.message.includes("Rate limit") ? "Too many attempts. Try again later." : "Could not start payment." }, 429);

  const r = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: user.email, amount: toKobo(Number(d.contribution_amount)), currency: "NGN", reference,
      callback_url: `${siteUrl()}/?drop=${d.id}&payment=${reference}`,
      metadata: { drop_id: d.id, fan_id: user.id, custom_fields: [{ display_name: "Drop", variable_name: "drop", value: d.title }] },
    }),
  });
  if (!r.ok) {
    await db.from("contributions").update({ status: "failed" }).eq("provider_reference", reference);
    return json({ error: "Payment provider unavailable. Please try again." }, 502);
  }
  return json({ authorization_url: r.body.data.authorization_url, reference });
});
