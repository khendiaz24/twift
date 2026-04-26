import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { tokensRoute } from "./routes/tokens";
import { stripeRoute } from "./routes/stripe";
import { authMiddleware } from "./middleware/auth";

const app = new Hono();

// ── Global middleware ────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["chrome-extension://*"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// ── Public routes ─────────────────────────────────────────────────────────────
app.route("/stripe", stripeRoute);

// ── Protected routes ─────────────────────────────────────────────────────────
app.use("/api/*", authMiddleware);
app.route("/api/tokens", tokensRoute);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 3000,
  fetch: app.fetch,
};
