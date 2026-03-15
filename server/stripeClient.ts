import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY;
}

export function getStripeClient(): Stripe {
  const key = getStripeKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!getStripeKey();
}

export async function createCheckoutSession(opts: {
  duesId: string;
  period: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripeClient();
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
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paymentStatus: session.payment_status,
    paymentIntentId: typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null),
    metadata: session.metadata ?? {},
  };
}
