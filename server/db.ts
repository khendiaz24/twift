// ============================================================
// server/db.ts
// Database abstraction — Bun SQLite in dev, Turso in production.
// Uses @libsql/client which speaks the same dialect for both.
// ============================================================

import { createClient, type Client } from "@libsql/client";

// ── Client singleton ──────────────────────────────────────────────────────────

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;

  const tursoUrl = process.env["TURSO_URL"];
  const tursoToken = process.env["TURSO_AUTH_TOKEN"];

  if (tursoUrl) {
    // Production: Turso remote (or embedded replica)
    _client = createClient({
      url: tursoUrl,
      ...(tursoToken ? { authToken: tursoToken } : {}),
    });
  } else {
    // Development: local SQLite file
    _client = createClient({ url: "file:twift.db" });
  }

  return _client;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL DEFAULT '',
    picture             TEXT NOT NULL DEFAULT '',
    google_id           TEXT UNIQUE,
    lemon_customer_id   TEXT,
    tier                TEXT NOT NULL DEFAULT 'free',
    ai_exports_used     INTEGER NOT NULL DEFAULT 0,
    ai_exports_reset_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-01', 'now')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    page_url    TEXT NOT NULL,
    page_title  TEXT NOT NULL,
    scanned_at  TEXT NOT NULL,
    result_json TEXT NOT NULL
  );
`;

export async function initDb(): Promise<void> {
  const db = getClient();
  // Execute each statement separately (libsql doesn't support multi-statement exec)
  for (const stmt of SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await db.execute(stmt);
  }

  // ── Migrations ──────────────────────────────────────────────────────────────
  // Add lemon_customer_id if migrating from old stripe_customer_id schema
  try {
    await db.execute("ALTER TABLE users ADD COLUMN lemon_customer_id TEXT");
  } catch {
    // Column already exists — ignore
  }
}

// ── User helpers ──────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  google_id: string | null;
  lemon_customer_id: string | null;
  tier: "free" | "pro";
  ai_exports_used: number;
  ai_exports_reset_at: string;
  created_at: string;
}

/** Upsert a user from Google OAuth data. Returns the full user row. */
export async function upsertGoogleUser(opts: {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}): Promise<DbUser> {
  const db = getClient();
  const id = opts.googleId; // use Google sub as our primary key

  await db.execute({
    sql: `
      INSERT INTO users (id, email, name, picture, google_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email   = excluded.email,
        name    = excluded.name,
        picture = excluded.picture
    `,
    args: [id, opts.email, opts.name, opts.picture, opts.googleId],
  });

  return getUserById(id) as Promise<DbUser>;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const db = getClient();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  return (result.rows[0] as unknown as DbUser) ?? null;
}

export async function getUserByLemonCustomer(
  customerId: string,
): Promise<DbUser | null> {
  const db = getClient();
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE lemon_customer_id = ?",
    args: [customerId],
  });
  return (result.rows[0] as unknown as DbUser) ?? null;
}

/** Set a user's LemonSqueezy customer ID */
export async function setLemonCustomer(
  userId: string,
  customerId: string,
): Promise<void> {
  const db = getClient();
  await db.execute({
    sql: "UPDATE users SET lemon_customer_id = ? WHERE id = ?",
    args: [customerId, userId],
  });
}

/** Upgrade or downgrade a user's tier */
export async function setTier(
  userId: string,
  tier: "free" | "pro",
): Promise<void> {
  const db = getClient();
  await db.execute({
    sql: "UPDATE users SET tier = ? WHERE id = ?",
    args: [tier, userId],
  });
}

// ── AI usage tracking ─────────────────────────────────────────────────────────

const FREE_AI_LIMIT = 3;

/**
 * Check if a free-tier user can still perform an AI export this month.
 * Resets the counter if the month has rolled over.
 * Returns { allowed, used, limit, resetAt }.
 */
export async function checkAndIncrementAiUsage(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
}> {
  const db = getClient();

  // Fetch current user
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  // Pro users always allowed (no increment stored for them)
  if (user.tier === "pro") {
    return { allowed: true, used: 0, limit: Infinity, resetAt: "" };
  }

  // Reset counter if month has rolled over
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const storedMonth = user.ai_exports_reset_at.slice(0, 7);

  if (currentMonth !== storedMonth) {
    await db.execute({
      sql: "UPDATE users SET ai_exports_used = 0, ai_exports_reset_at = strftime('%Y-%m-01', 'now') WHERE id = ?",
      args: [userId],
    });
    user.ai_exports_used = 0;
    user.ai_exports_reset_at = new Date().toISOString().slice(0, 8) + "01";
  }

  if (user.ai_exports_used >= FREE_AI_LIMIT) {
    return {
      allowed: false,
      used: user.ai_exports_used,
      limit: FREE_AI_LIMIT,
      resetAt: user.ai_exports_reset_at,
    };
  }

  // Increment
  await db.execute({
    sql: "UPDATE users SET ai_exports_used = ai_exports_used + 1 WHERE id = ?",
    args: [userId],
  });

  return {
    allowed: true,
    used: user.ai_exports_used + 1,
    limit: FREE_AI_LIMIT,
    resetAt: user.ai_exports_reset_at,
  };
}
