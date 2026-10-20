// Paystack -> DropLive. Deploy with --no-verify-jwt. Paystack signs the raw body with your secret key.
import { admin, env, settle } from "../_shared/common.ts";
import { validSignature } from "../_shared/verify.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();                                   // raw text: the signature covers exact bytes
  if (!(await validSignature(env("PAYSTACK_SECRET_KEY"), raw, req.headers.get("x-paystack-signature"))))
    return new Response("invalid signature", { status: 401 });
  let evt: { event?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const data = (evt.data ?? {}) as Record<string, string | number>;

  if (evt.event === "charge.success") {
    const r = await settle(String(data.reference), `charge.success:${data.id}`);
    return new Response(r.transient ? "retry" : "ok", { status: r.transient ? 500 : 200 }); // 500 => Paystack retries
  }
  if (evt.event === "refund.processed") {
    const ref = String(data.transaction_reference ?? data.reference ?? "");
    const { error } = await admin().rpc("mark_contribution_refunded",
      { p_reference: ref, p_event_id: `refund:${data.id ?? ref}`, p_payload: data });
    return new Response(error ? "retry" : "ok", { status: error ? 500 : 200 });
  }
  return new Response("ignored", { status: 200 });
});
