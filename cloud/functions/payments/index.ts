// ============================================================
// Kithra — Supabase Edge Function: payments (Razorpay)
//   action:"order"  → creates a Razorpay order (server holds the price table)
//   action:"verify" → verifies the payment signature, records the subscription
// Secrets (Supabase → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID      = rzp_live_xxx / rzp_test_xxx
//   RAZORPAY_KEY_SECRET  = <razorpay key secret>
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// The publishable key_id is returned to the client (safe); the secret never is.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RZP_KEY = Deno.env.get("RAZORPAY_KEY_ID") || "";
const RZP_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

// Prices in the smallest currency unit (paise for INR, cents for USD).
// Annual = 10× monthly (two months free). Source of truth lives here.
const PRICES: Record<string, Record<string, Record<string, number>>> = {
  plus: { USD: { month: 3000, year: 30000 }, INR: { month: 249900, year: 2499000 } },
  premium: { USD: { month: 9000, year: 90000 }, INR: { month: 749900, year: 7499000 } },
};

function userIdFromAuth(req: Request): string | null {
  try {
    const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const part = t.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return json.sub || null;
  } catch (e) { return null; }
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!RZP_KEY || !RZP_SECRET) return json({ error: "Payments are not configured yet (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)." }, 500);
  try {
    const body = await req.json().catch(() => ({} as any));
    const auth = "Basic " + btoa(RZP_KEY + ":" + RZP_SECRET);

    if (body.action === "order") {
      const plan = String(body.plan || "");
      const period = body.period === "year" ? "year" : "month";
      const currency = body.currency === "USD" ? "USD" : "INR";
      const amount = PRICES[plan] && PRICES[plan][currency] && PRICES[plan][currency][period];
      if (!amount) return json({ error: "Unknown plan or currency" }, 400);
      const r = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, receipt: "kithra_" + plan + "_" + Date.now(), notes: { plan, period } }),
      });
      const d = await r.json();
      if (!r.ok) return json({ error: (d && d.error && d.error.description) || "Could not start payment" }, 502);
      return json({ order_id: d.id, amount: d.amount, currency: d.currency, key_id: RZP_KEY, plan, period });
    }

    if (body.action === "verify") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json({ ok: false, error: "Missing payment fields" }, 400);
      const expected = await hmacHex(RZP_SECRET, razorpay_order_id + "|" + razorpay_payment_id);
      if (expected !== razorpay_signature) return json({ ok: false, error: "Signature verification failed" }, 400);
      // record the subscription with the service role (bypasses RLS); user from JWT
      const uid = userIdFromAuth(req);
      if (uid && SUPA_URL && SERVICE) {
        await fetch(SUPA_URL + "/rest/v1/subscriptions", {
          method: "POST",
          headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: uid, plan: plan || "plus", status: "active", provider: "razorpay", order_id: razorpay_order_id, payment_id: razorpay_payment_id, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
      return json({ ok: true, plan: plan || "plus" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
