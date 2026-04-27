// ============================================================
// shared/types.ts
// Single source of truth for all data shapes in the extension.
// ============================================================

// ------------------------------------------------------------------
// Color Tokens
// ------------------------------------------------------------------

/** Normalised colour extracted from the page */
export interface RawColor {
  /** Original value as seen in computed style, e.g. "rgb(59, 130, 246)" */
  original: string;
  /** Normalised hex, always lowercase 6-digit, e.g. "#3b82f6" */
  hex: string;
  /** Parsed RGBA channels (0-255 / 0-1 for alpha) */
  rgba: RGBA;
  /** How many DOM nodes reference this colour */
  frequency: number;
  /** CSS properties where this colour was found */
  sources: ColorSource[];
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorSource =
  | "color"
  | "background-color"
  | "border-color"
  | "outline-color"
  | "fill"
  | "stroke"
  | "box-shadow"
  | "text-decoration-color"
  | "caret-color"
  | "accent-color";

/** A colour with a semantic CSS variable name assigned by the AI labeller */
export interface SemanticColorToken extends RawColor {
  /** e.g. "--color-primary", "--color-surface-muted" */
  cssVar: string;
  /** Human-readable label, e.g. "Primary Brand" */
  label: string;
  /** HSL lightness bucket: "dark" < 30, "mid" 30-70, "light" > 70 */
  lightnessBucket: "dark" | "mid" | "light";
}

// ------------------------------------------------------------------
// Typography Tokens
// ------------------------------------------------------------------

export interface TypographyToken {
  fontFamily: string;
  /** Parsed px value */
  fontSizePx: number;
  /** Snapped to nearest 4px multiple */
  fontSizeSnapped: number;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  frequency: number;
}

// ------------------------------------------------------------------
// Spacing Tokens
// ------------------------------------------------------------------

export interface SpacingToken {
  /** Original raw value, e.g. "15.8px" */
  original: string;
  /** Parsed float in px */
  valuePx: number;
  /** Snapped to nearest 4px multiple */
  snappedPx: number;
  /** rem equivalent at 16px root (snappedPx / 16) */
  snappedRem: number;
  /** Source CSS property */
  property: SpacingProperty;
  frequency: number;
}

export type SpacingProperty =
  | "padding-top"
  | "padding-right"
  | "padding-bottom"
  | "padding-left"
  | "margin-top"
  | "margin-right"
  | "margin-bottom"
  | "margin-left"
  | "gap"
  | "row-gap"
  | "column-gap";

// ------------------------------------------------------------------
// Scan Result — the full payload sent from content → panel
// ------------------------------------------------------------------

export interface ScanResult {
  /** ISO timestamp of when the scan ran */
  scannedAt: string;
  /** URL of the scanned page */
  pageUrl: string;
  /** Page <title> */
  pageTitle: string;
  /** Total DOM nodes visited */
  nodesScanned: number;
  colors: RawColor[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
}

/** Extended result after semantic labelling */
export interface EnrichedScanResult extends Omit<ScanResult, "colors"> {
  colors: SemanticColorToken[];
  /** The generated @theme CSS block */
  themeBlock: string;
  /** Design tokens as a flat JSON object */
  designTokens: DesignTokens;
}

// ------------------------------------------------------------------
// Design Tokens (JSON export)
// ------------------------------------------------------------------

export interface DesignTokens {
  color: Record<string, DesignToken<string>>;
  fontSize: Record<string, DesignToken<string>>;
  fontFamily: Record<string, DesignToken<string>>;
  spacing: Record<string, DesignToken<string>>;
}

export interface DesignToken<T> {
  $value: T;
  $type: "color" | "dimension" | "fontFamily" | "number";
  $description?: string;
}

// ------------------------------------------------------------------
// Message Bus (content ↔ background ↔ panel)
// ------------------------------------------------------------------

export type ExtensionMessage =
  | { type: "TRIGGER_SCAN" }
  | { type: "SCAN_PROGRESS"; payload: { phase: ScanPhase; progress: number } }
  | { type: "SCAN_COMPLETE"; payload: ScanResult }
  | { type: "SCAN_ERROR"; payload: { message: string } }
  | { type: "REQUEST_ENRICHMENT"; payload: ScanResult }
  | { type: "ENRICHMENT_COMPLETE"; payload: EnrichedScanResult }
  | { type: "GOOGLE_AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: UserSession }
  | { type: "AUTH_ERROR"; payload: { message: string } }
  | { type: "LOGOUT" };

export type ScanPhase =
  | "collecting-nodes"
  | "extracting-colors"
  | "extracting-typography"
  | "extracting-spacing"
  | "deduplicating"
  | "done";

// ------------------------------------------------------------------
// Auth / Subscription
// ------------------------------------------------------------------

/** Tier of the user's account */
export type Tier = "free" | "pro";

/** Stored in chrome.storage.local after successful Google OAuth */
export interface UserSession {
  /** Twift JWT (30-day expiry) */
  token: string;
  /** Google email */
  email: string;
  /** Display name from Google */
  name: string;
  /** Google profile picture URL */
  picture: string;
  /** Subscription tier */
  tier: Tier;
  /** Number of AI exports used this calendar month */
  aiExportsUsed: number;
  /** ISO string of when the monthly counter resets */
  aiExportsResetAt: string;
  /** JWT expiry as Unix timestamp (seconds) */
  exp: number;
}
