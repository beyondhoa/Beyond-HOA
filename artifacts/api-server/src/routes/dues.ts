// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  isStripeConfigured,
  resetStripeSync,
} from "../lib/stripeClient";

const router: IRouter = Router();

router.get("/dues/stripe-configured", async (_req, res) => {
  res.json({ configured: await isStripeConfigured() });
});

router.get("/admin/stripe-status", async (_req, res) => {
  try {
    const configured = await isStripeConfigured();
    const pkResult = await pool.query(
      "SELECT value FROM hoa_settings WHERE key='stripe_publishable_key' LIMIT 1"
    );
    const publishableKey = pkResult.rows[0]?.value ?? null;
    const hasEnvKey = !!process.env.STRIPE_SECRET_KEY;
    const skResult = await pool.query(
      "SELECT value FROM hoa_settings WHERE key='stripe_secret_key' LIMIT 1"
    );
    const hasDbKey = !!skResult.rows[0]?.value;
    res.json({ configured, publishableKey, hasEnvKey, hasDbKey });
  } catch (err) {
    _req.log.error({ err }, "Stripe status error");
    res.status(500).json({ error: "Failed to get Stripe status" });
  }
});

router.post("/admin/stripe-setup", async (req, res) => {
  try {
    const { secretKey, publishableKey } = req.body;
    if (!secretKey) return res.status(400).json({ error: "secretKey is required" });
    if (!secretKey.startsWith("sk_")) {
      return res.status(400).json({ error: "Invalid secret key. Must start with sk_test_ or sk_live_" });
    }

    const stripe = new (await import("stripe")).default(secretKey, { apiVersion: "2024-12-18.acacia" });
    try {
      await stripe.accounts.retrieve();
    } catch (err: any) {
      if (err?.type === "StripeAuthenticationError") {
        return res.status(400).json({ error: "Invalid Stripe secret key — authentication failed" });
      }
    }

    await pool.query(
      `INSERT INTO hoa_settings (key, value, updated_at)
       VALUES ('stripe_secret_key', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [secretKey]
    );

    if (publishableKey) {
      await pool.query(
        `INSERT INTO hoa_settings (key, value, updated_at)
         VALUES ('stripe_publishable_key', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
        [publishableKey]
      );
    }

    resetStripeSync();
    res.json({ success: true, live: secretKey.startsWith("sk_live_") });
  } catch (err) {
    req.log.error({ err }, "Stripe setup error");
    res.status(500).json({ error: "Failed to save Stripe configuration" });
  }
});

router.delete("/admin/stripe-setup", async (_req, res) => {
  try {
    await pool.query("DELETE FROM hoa_settings WHERE key IN ('stripe_secret_key','stripe_publishable_key')");
    resetStripeSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove Stripe configuration" });
  }
});

router.post("/dues/checkout", async (req, res) => {
  try {
    const { duesId, period, amount } = req.body;
    if (!duesId || !period || !amount) {
      return res.status(400).json({ error: "duesId, period, and amount are required" });
    }
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? req.get("host");
    const base = `https://${domain}`;
    const successUrl = `${base}/api/dues/payment-success?session_id={CHECKOUT_SESSION_ID}&dues_id=${duesId}`;
    const cancelUrl = `${base}/api/dues/payment-cancelled`;

    const { url, sessionId } = await createCheckoutSession({
      duesId: String(duesId),
      period: String(period),
      amount: Number(amount),
      successUrl,
      cancelUrl,
    });

    await pool.query(
      `INSERT INTO dues_payments (dues_id, period, amount, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (stripe_session_id) DO NOTHING`,
      [String(duesId), String(period), Number(amount), sessionId]
    );

    res.json({ url, sessionId });
  } catch (err: any) {
    req.log.error({ err }, "Dues checkout error");
    res.status(500).json({ error: err.message ?? "Failed to create checkout session" });
  }
});

router.get("/dues/payment-success", async (req, res) => {
  const { session_id, dues_id } = req.query as Record<string, string>;
  try {
    if (session_id) {
      const { paymentStatus, paymentIntentId } = await retrieveCheckoutSession(session_id);
      if (paymentStatus === "paid") {
        await pool.query(
          `UPDATE dues_payments SET status='paid', stripe_payment_intent_id=$1, paid_at=NOW()
           WHERE stripe_session_id=$2`,
          [paymentIntentId, session_id]
        );
      }
    }
  } catch (err) {
    req.log.error({ err }, "Payment success verification error");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful – Beyond HOA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F6FA; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .icon { width: 72px; height: 72px; background: #e8f8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 36px; height: 36px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #C9A84C; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; color: #0F2340; margin-bottom: 10px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 28px; }
    .back-btn { display: inline-block; background: #0F2340; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; }
    .note { font-size: 12px; color: #9CA3AF; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="brand">Beyond HOA</div>
    <h1>Payment Successful</h1>
    <p>Your HOA dues payment has been processed and your account has been updated. Thank you!</p>
    <a href="javascript:window.close()" class="back-btn">Return to App</a>
    <p class="note">You can close this window and return to the Beyond HOA app to see your updated payment status.</p>
  </div>
</body>
</html>`);
});

router.get("/dues/payment-cancelled", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled – Beyond HOA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F6FA; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .icon { width: 72px; height: 72px; background: #FEF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 36px; height: 36px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #C9A84C; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; color: #0F2340; margin-bottom: 10px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 28px; }
    .back-btn { display: inline-block; background: #0F2340; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </div>
    <div class="brand">Beyond HOA</div>
    <h1>Payment Cancelled</h1>
    <p>Your payment was not completed. No charges have been made. You can try again from the app.</p>
    <a href="javascript:window.close()" class="back-btn">Return to App</a>
  </div>
</body>
</html>`);
});

router.get("/dues/payments", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM dues_payments ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    _req.log.error({ err }, "Dues payments fetch error");
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.get("/dues/payment-status/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const dbResult = await pool.query(
      "SELECT * FROM dues_payments WHERE stripe_session_id=$1",
      [sessionId]
    );
    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    const record = dbResult.rows[0];
    if (record.status !== "paid") {
      try {
        const { paymentStatus, paymentIntentId } = await retrieveCheckoutSession(sessionId);
        if (paymentStatus === "paid") {
          await pool.query(
            `UPDATE dues_payments SET status='paid', stripe_payment_intent_id=$1, paid_at=NOW()
             WHERE stripe_session_id=$2`,
            [paymentIntentId, sessionId]
          );
          record.status = "paid";
        }
      } catch (stripeErr) {
        req.log.error({ stripeErr }, "Stripe session check error");
      }
    }
    res.json(record);
  } catch (err) {
    req.log.error({ err }, "Payment status error");
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

export default router;
