import type { MiddlewareHandler } from "hono";

/**
 * Validates the Bearer token and attaches `userId` and `tier` to the context.
 * In production: verify a JWT (jose / hono/jwt) and query your DB for tier.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = auth.slice(7);

  // TODO: replace with real JWT verification
  // import { jwtVerify } from "jose";
  // const { payload } = await jwtVerify(token, secret);
  // c.set("userId", payload.sub);
  // c.set("tier", payload.tier);

  if (token === "dev-token") {
    // Development bypass
    c.set("userId", "dev-user");
    c.set("tier", "pro");
  } else {
    // In production: decode & verify JWT
    c.set("userId", "unknown");
    c.set("tier", "free");
  }

  await next();
};
