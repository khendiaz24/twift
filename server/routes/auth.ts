// ============================================================
// server/routes/auth.ts
// Google OAuth token exchange → Twift JWT issuance.
//
// Flow (Chrome extension side):
//   1. Panel triggers GOOGLE_AUTH_START → service worker
//   2. Service worker uses chrome.identity.launchWebAuthFlow
//      to get a Google access_token
//   3. Extension POSTs the access_token to POST /auth/google
//   4. Server verifies token with Google, upserts user, returns JWT
// ============================================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SignJWT } from "jose";
import { upsertGoogleUser } from "../db";

export const authRoute = new Hono();


// ── Helpers ───────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

async function verifyGoogleToken(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Invalid Google access token");
  }
  return res.json() as Promise<GoogleUserInfo>;
}

// ── POST /auth/google ─────────────────────────────────────────────────────────

const GoogleAuthSchema = z.object({
  /** Google OAuth access token obtained by the extension */
  accessToken: z.string().min(10),
});

authRoute.post(
  "/google",
  zValidator("json", GoogleAuthSchema),
  async (c) => {
    const { accessToken } = c.req.valid("json");

    // Verify token with Google
    let googleUser: GoogleUserInfo;
    try {
      googleUser = await verifyGoogleToken(accessToken);
    } catch {
      return c.json({ error: "Invalid Google token" }, 401);
    }

    if (!googleUser.email_verified) {
      return c.json({ error: "Google email not verified" }, 403);
    }

    // Upsert user in DB
    const user = await upsertGoogleUser({
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
    });

    // Issue Twift JWT (30 days)
    const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;

    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      tier: user.tier,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(getJwtSecret());

    return c.json({
      ok: true,
      token,
      email: user.email,
      name: user.name,
      picture: user.picture,
      tier: user.tier,
      aiExportsUsed: user.ai_exports_used,
      aiExportsResetAt: user.ai_exports_reset_at,
      exp,
    });
  }
);
