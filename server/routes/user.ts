// ============================================================
// server/routes/user.ts
// Current-user endpoint — lets the panel refresh session data.
// ============================================================

import { Hono } from "hono";
import { getUserById } from "../db";
import type { HonoVariables } from "../types";

export const userRoute = new Hono<{ Variables: HonoVariables }>();

/**
 * GET /api/user/me
 * Returns the authenticated user's profile + current AI usage.
 */
userRoute.get("/me", async (c) => {
  const userId = c.get("userId");
  const email = c.get("email");
  const name = c.get("name");
  const tier = c.get("tier");
  const aiExportsUsed = c.get("aiExportsUsed");

  const user = await getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({
    ok: true,
    user: {
      id: userId,
      email,
      name,
      tier,
      aiExportsUsed,
      aiExportsResetAt: user.ai_exports_reset_at,
    },
  });
});
