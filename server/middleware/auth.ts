// ============================================================
// server/middleware/auth.ts
// Validates the Bearer JWT on every /api/* request.
// Sets userId, email, name, tier, aiExportsUsed on the Hono context.
// ============================================================

import type { MiddlewareHandler } from "hono";
import { jwtVerify } from "jose";
import { getUserById } from "../db";
import type { HonoVariables } from "../types";

function getJwtSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export const authMiddleware: MiddlewareHandler<{ Variables: HonoVariables }> = async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = auth.slice(7);

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    const userId = payload["sub"] as string;
    if (!userId) throw new Error("Missing sub");

    // Always look up from DB so revoked subscriptions take effect immediately
    const user = await getUserById(userId);
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    c.set("userId", user.id);
    c.set("email", user.email);
    c.set("name", user.name);
    c.set("tier", user.tier);
    c.set("aiExportsUsed", user.ai_exports_used);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};
