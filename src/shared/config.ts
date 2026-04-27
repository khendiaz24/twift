// ============================================================
// shared/config.ts
// Single source of truth for runtime configuration.
// Extension contexts read SERVER_URL from here.
// ============================================================

/** Base URL of the Twift API server */
export const SERVER_URL =
  (typeof process !== "undefined" && process.env["SERVER_URL"]) ||
  "http://localhost:3000";

/** Free tier AI export allowance per calendar month */
export const FREE_AI_EXPORTS_PER_MONTH = 3;

/** Price displayed in the upgrade modal */
export const PRO_PRICE_DISPLAY = "$9/mo";
