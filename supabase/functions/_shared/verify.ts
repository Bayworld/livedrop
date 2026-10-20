// Pure helpers (no Deno/network APIs) so they can be unit-tested with Node.
export async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function validSignature(secret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!secret || !header) return false;
  return safeEqual(await hmacSha512Hex(secret, rawBody), header.trim().toLowerCase());
}
export const toKobo = (naira: number): number => Math.round(naira * 100);
export interface PaystackTx { status: string; amount: number; currency: string; reference: string }
export function chargeMatches(tx: PaystackTx, expected: { reference: string; amountNaira: number }): boolean {
  return tx.status === "success" && tx.reference === expected.reference &&
    tx.currency === "NGN" && tx.amount === toKobo(expected.amountNaira);
}
