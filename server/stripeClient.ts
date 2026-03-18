import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let _stripeSync: StripeSync | null = null;

async function getCredentials(): Promise<{ secretKey: string; publishableKey: string }> {
  const replitConnectionsUrl = process.env.REPLIT_STRIPE_CONNECTIONS_URL;

  if (replitConnectionsUrl) {
    try {
      const resp = await fetch(replitConnectionsUrl);
      if (resp.ok) {
        const data = await resp.json() as any;
        const conn = Array.isArray(data) ? data[0] : data;
        if (conn?.settings?.secret_key) {
          return {
            secretKey: conn.settings.secret_key,
            publishableKey: conn.settings.publishable_key ?? "",
          };
        }
      }
    } catch {
    }
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    return { secretKey, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "" };
  }

  throw new Error("No Stripe credentials found. Connect Stripe in the Integrations panel or set STRIPE_SECRET_KEY.");
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2024-12-18.acacia" });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (_stripeSync) return _stripeSync;
  const { secretKey } = await getCredentials();
  _stripeSync = new StripeSync({ secretKey });
  return _stripeSync;
}

export function isStripeConfigured(): boolean {
  return !!(
    process.env.REPLIT_STRIPE_CONNECTIONS_URL ||
    process.env.STRIPE_SECRET_KEY
  );
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
