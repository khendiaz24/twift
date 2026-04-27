// ============================================================
// server/types.ts
// Shared Hono context variable types for typed c.get() calls.
// ============================================================

/** Variables populated by authMiddleware on every /api/* request */
export type HonoVariables = {
  userId: string;
  email: string;
  name: string;
  tier: "free" | "pro";
  aiExportsUsed: number;
};
