import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { pool } from "./db";

let _stripeSync: StripeSync | null = null;

export async function getStoredStripeKey(): Promise<string | null> {
  try {
    const result = await pool.query(
      "SELECT value FROM hoa_settings WHERE key='stripe_secret_key' LIMIT 1"
    );
    return result.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function getStoredPublishableKey(): Promise<string | null> {
  try {
    const result = await pool.query(
      "SELECT value FROM hoa_settings WHERE key='stripe_publishable_key' LIMIT 1"
    );
    return result.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function resolveSecretKey(): Promise<string> {
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) return envKey;

  const dbKey = await getStoredStripeKey();
  if (dbKey) return dbKey;

  const replitConnectionsUrl = process.env.REPLIT_STRIPE_CONNECTIONS_URL;
  if (replitConnectionsUrl) {
    try {
      const resp = await fetch(replitConnectionsUrl);
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const conn = Array.isArray(data) ? data[0] : data;
        if (conn?.settings?.secret_key) return conn.settings.secret_key;
      }
    } catch {}
  }

  throw new Error(
    "Stripe not configured. Enter your Stripe Secret Key in Board → Payment Setup."
  );
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = await resolveSecretKey();
  return new Stripe(secretKey, { apiVersion: "2024-12-18.acacia" });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (_stripeSync) return _stripeSync;
  const secretKey = await resolveSecretKey();
  _stripeSync = new StripeSync({ stripeSecretKey: secretKey });
  return _stripeSync;
}

export function resetStripeSync(): void {
  _stripeSync = null;
}

export async function isStripeConfigured(): Promise<boolean> {
  if (process.env.STRIPE_SECRET_KEY) return true;

  const dbKey = await getStoredStripeKey();
  if (dbKey) return true;

  const replitConnectionsUrl = process.env.REPLIT_STRIPE_CONNECTIONS_URL;
  if (replitConnectionsUrl) {
    try {
      const resp = await fetch(replitConnectionsUrl);
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const conn = Array.isArray(data) ? data[0] : data;
        if (conn?.settings?.secret_key) return true;
      }
    } catch {}
  }

  return false;
}

export async function createCheckoutSession(opts: {
  duesId: string;
  period: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = await getUncachableStripeClient();
  const amountCents = Math.round(opts.amount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `HOA Dues — ${opts.period}`,
            description: "Beyond HOA Community Association",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      dues_id: opts.duesId,
      period: opts.period,
    },
  });

  if (!session.url) throw new Error("No checkout URL returned from Stripe");
  return { url: session.url, sessionId: session.id };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<{
  paymentStatus: string;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
}> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paymentStatus: session.payment_status,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    metadata: session.metadata ?? {},
  };
}
