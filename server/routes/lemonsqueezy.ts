// ============================================================
// server/routes/lemonsqueezy.ts
// LemonSqueezy Checkout + Webhook handler.
// ============================================================

import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import {
  getUserById,
  setLemonCustomer,
  setTier,
  getUserByLemonCustomer,
} from "../db";

export const lemonsqueezyRoute = new Hono();

// ── POST /lemonsqueezy/create-checkout ───────────────────────────────────────

lemonsqueezyRoute.post("/create-checkout", async (c) => {
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

  const apiKey = process.env["LEMONSQUEEZY_API_KEY"];
  if (!apiKey) return c.json({ error: "LEMONSQUEEZY_API_KEY not set" }, 500);

  const storeId = process.env["LEMONSQUEEZY_STORE_ID"];
  if (!storeId) return c.json({ error: "LEMONSQUEEZY_STORE_ID not set" }, 500);

  const variantId = process.env["LEMONSQUEEZY_VARIANT_ID"];
  if (!variantId)
    return c.json({ error: "LEMONSQUEEZY_VARIANT_ID not set" }, 500);

  const baseUrl = process.env["SERVER_URL"] ?? "http://localhost:3000";

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: user.email,
            name: user.name,
            custom: { user_id: user.id },
          },
          product_options: {
            redirect_url: `${baseUrl}/checkout/success`,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[lemonsqueezy] checkout error:", errText);
    return c.json({ error: "Failed to create checkout" }, 500);
  }

  const json = (await response.json()) as {
    data: { attributes: { url: string } };
  };
  return c.json({ ok: true, url: json.data.attributes.url });
});

// ── POST /lemonsqueezy/webhook ────────────────────────────────────────────────

lemonsqueezyRoute.post("/webhook", async (c) => {
  const sig = c.req.header("X-Signature");
  const body = await c.req.text();
  const webhookSecret = process.env["LEMONSQUEEZY_WEBHOOK_SECRET"];

  if (!sig || !webhookSecret) {
    return c.json({ error: "Missing signature or webhook secret" }, 400);
  }

  // Verify HMAC-SHA256 signature
  const hmac = createHmac("sha256", webhookSecret);
  hmac.update(body);
  const digest = hmac.digest("hex");

  const sigBuf = Buffer.from(sig, "hex");
  const digestBuf = Buffer.from(digest, "hex");
  const valid =
    sigBuf.length === digestBuf.length && timingSafeEqual(sigBuf, digestBuf);

  if (!valid) {
    console.error("[lemonsqueezy/webhook] Signature verification failed");
    return c.json({ error: "Webhook signature invalid" }, 400);
  }

  type LsEvent = {
    meta: {
      event_name: string;
      custom_data?: { user_id?: string };
    };
    data: {
      attributes: {
        status: string;
        customer_id: number;
      };
    };
  };

  const event = JSON.parse(body) as LsEvent;
  const eventName = event.meta.event_name;
  const attrs = event.data.attributes;
  const customUserId = event.meta.custom_data?.user_id;

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated": {
      const isActive = attrs.status === "active" || attrs.status === "on_trial";
      const tier = isActive ? "pro" : "free";

      if (customUserId) {
        await setLemonCustomer(customUserId, String(attrs.customer_id));
        await setTier(customUserId, tier);
        console.log(`[lemonsqueezy] user=${customUserId} → tier=${tier}`);
      } else {
        const user = await getUserByLemonCustomer(String(attrs.customer_id));
        if (user) {
          await setTier(user.id, tier);
          console.log(`[lemonsqueezy] user=${user.email} → tier=${tier}`);
        }
      }
      break;
    }

    case "subscription_cancelled":
    case "subscription_expired": {
      if (customUserId) {
        await setTier(customUserId, "free");
        console.log(
          `[lemonsqueezy] cancelled → user=${customUserId} downgraded to free`,
        );
      } else {
        const user = await getUserByLemonCustomer(String(attrs.customer_id));
        if (user) {
          await setTier(user.id, "free");
          console.log(
            `[lemonsqueezy] cancelled → user=${user.email} downgraded to free`,
          );
        }
      }
      break;
    }

    default:
      break;
  }

  return c.json({ received: true });
});

// ── Checkout result pages ─────────────────────────────────────────────────────

lemonsqueezyRoute.get("/success", (c) =>
  c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>🎉 You're now on Twift Pro!</h1>
    <p>You can close this tab and return to the extension.</p>
  </body></html>`),
);

lemonsqueezyRoute.get("/cancel", (c) =>
  c.html(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>Upgrade cancelled</h1>
    <p>No worries — you can upgrade any time from the Twift panel.</p>
  </body></html>`),
);
