import { Hono } from "hono";

export const stripeRoute = new Hono();

/**
 * POST /stripe/webhook
 * Handles Stripe subscription lifecycle events.
 * Verify the signature, then upsert user tier in your DB.
 */
stripeRoute.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  const body = await c.req.text();

  if (!sig) {
    return c.json({ error: "Missing stripe-signature" }, 400);
  }

  // TODO: verify with Stripe SDK
  // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const status = sub["status"] as string;
      const customerId = sub["customer"] as string;
      const tier = status === "active" ? "pro" : "free";
      console.log(`[stripe] customer=${customerId} tier=${tier}`);
      // TODO: upsert to DB
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = sub["customer"] as string;
      console.log(`[stripe] subscription cancelled for customer=${customerId}`);
      // TODO: downgrade to free
      break;
    }
    default:
      // Unhandled events — just ack
  }

  return c.json({ received: true });
});

/**
 * POST /stripe/create-checkout
 * Creates a Stripe Checkout session for upgrading to Pro.
 */
stripeRoute.post("/create-checkout", async (c) => {
  // TODO: validate auth, create Stripe session
  // const session = await stripe.checkout.sessions.create({ ... });
  // return c.json({ url: session.url });
  return c.json({ url: "https://buy.stripe.com/placeholder" });
});
