// ============================================================
// server/routes/stripe.ts
// Real Stripe Checkout + Webhook handler.
// ============================================================

import { Hono } from "hono";
import Stripe from "stripe";
import {
  getUserById,
  setStripeCustomer,
  setTier,
  getUserByStripeCustomer,
} from "../db";

export const stripeRoute = new Hono();

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Use the latest API version supported by the installed stripe package
  return new Stripe(key);
}

// ── POST /stripe/create-checkout ─────────────────────────────────────────────

stripeRoute.post("/create-checkout", async (c) => {
  // Require auth header to associate session with user
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { jwtVerify } = await import("jose");
  const secret = new TextEncoder().encode(process.env["JWT_SECRET"] ?? "");
  let userId: string;
  try {
    const { payload } = await jwtVerify(auth.slice(7), secret);
    userId = payload["sub"] as string;
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const user = await getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  const stripe = getStripe();
  const priceId = process.env["STRIPE_PRO_PRICE_ID"];
  if (!priceId) return c.json({ error: "STRIPE_PRO_PRICE_ID not set" }, 500);

  // Re-use existing Stripe customer or create one
  let customerId = user.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await setStripeCustomer(userId, customerId);
  }

  const baseUrl = process.env["SERVER_URL"] ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/checkout/success`,
    cancel_url: `${baseUrl}/checkout/cancel`,
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  return c.json({ ok: true, url: session.url });
});

// ── POST /stripe/webhook ──────────────────────────────────────────────────────

stripeRoute.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  const body = await c.req.text();
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!sig || !webhookSecret) {
    return c.json({ error: "Missing signature or webhook secret" }, 400);
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return c.json({ error: "Webhook signature invalid" }, 400);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const isActive = sub.status === "active" || sub.status === "trialing";
      const tier = isActive ? "pro" : "free";

      const user = await getUserByStripeCustomer(customerId);
      if (user) {
        await setTier(user.id, tier);
        console.log(`[stripe] user=${user.email} → tier=${tier}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const user = await getUserByStripeCustomer(customerId);
      if (user) {
        await setTier(user.id, "free");
        console.log(`[stripe] cancelled → user=${user.email} downgraded to free`);
      }
      break;
    }

    default:
      break;
  }

  return c.json({ received: true });
});

// ── Checkout result pages ─────────────────────────────────────────────────────

stripeRoute.get("/success", (c) =>
  c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>🎉 You're now on Twift Pro!</h1>
    <p>You can close this tab and return to the extension.</p>
  </body></html>`)
);

stripeRoute.get("/cancel", (c) =>
  c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>Upgrade cancelled</h1>
    <p>No worries — you can upgrade any time from the Twift panel.</p>
  </body></html>`)
);
