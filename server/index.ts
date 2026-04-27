import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { tokensRoute } from "./routes/tokens";
import { stripeRoute } from "./routes/stripe";
import { authRoute } from "./routes/auth";
import { userRoute } from "./routes/user";
import { authMiddleware } from "./middleware/auth";
import { initDb } from "./db";
import type { HonoVariables } from "./types";

const app = new Hono<{ Variables: HonoVariables }>();

// ── Initialise DB on startup ─────────────────────────────────────────────────
await initDb();

// ── Global middleware ────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["chrome-extension://*", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// ── Public routes ─────────────────────────────────────────────────────────────
app.route("/auth", authRoute);
app.route("/stripe", stripeRoute);
app.route("/checkout", stripeRoute); // success / cancel pages

// ── Protected routes ─────────────────────────────────────────────────────────
app.use("/api/*", authMiddleware);
app.route("/api/tokens", tokensRoute);
app.route("/api/user", userRoute);

// ── 404 / Error ───────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 3000,
  fetch: app.fetch,
};
