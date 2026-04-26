// ============================================================
// shared/color-labeller.ts
//
// Assigns semantic CSS variable names to raw hex colours.
// Phase 1: pure heuristic (HSL analysis + frequency ranking).
// Phase 2 (future): optional AI pass via the Anthropic API.
// ============================================================

import type { RawColor, SemanticColorToken } from "./types";

// ------------------------------------------------------------------
// HSL conversion
// ------------------------------------------------------------------

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

function rgbaToHSL(r: number, g: number, b: number): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

// ------------------------------------------------------------------
// Hue → colour family
// ------------------------------------------------------------------

type HueFamily =
  | "red" | "orange" | "amber" | "yellow"
  | "lime" | "green" | "teal" | "cyan"
  | "sky" | "blue" | "indigo" | "violet"
  | "purple" | "fuchsia" | "pink" | "rose"
  | "neutral";

function hueToFamily(h: number, s: number): HueFamily {
  if (s < 8) return "neutral";
  if (h < 15 || h >= 345) return "red";
  if (h < 35) return "orange";
  if (h < 50) return "amber";
  if (h < 65) return "yellow";
  if (h < 85) return "lime";
  if (h < 150) return "green";
  if (h < 175) return "teal";
  if (h < 195) return "cyan";
  if (h < 215) return "sky";
  if (h < 245) return "blue";
  if (h < 265) return "indigo";
  if (h < 285) return "violet";
  if (h < 310) return "purple";
  if (h < 330) return "fuchsia";
  if (h < 345) return "pink";
  return "rose";
}

// ------------------------------------------------------------------
// Semantic role assignment based on HSL + usage context
// ------------------------------------------------------------------

/**
 * Assigns a semantic role name to a colour given its visual properties
 * and its rank in the palette (0 = most frequent).
 */
function assignRole(
  hsl: HSL,
  sources: RawColor["sources"],
  rank: number
): string {
  const { s, l } = hsl;
  const isBackground = sources.includes("background-color");
  const isText = sources.includes("color");
  const isBorder = sources.includes("border-color");

  // Near-white backgrounds
  if (l > 92 && s < 15 && isBackground) return "background";
  // Near-black / very dark text
  if (l < 12 && isText) return "foreground";
  // Mid-dark text tones
  if (l < 35 && isText && !isBackground) return "foreground-muted";
  // Light neutral backgrounds / surfaces
  if (l > 85 && s < 20 && isBackground) return "surface";
  // Light neutral for cards / panels
  if (l > 78 && s < 25 && isBackground) return "surface-raised";
  // Border / divider colours
  if (l > 60 && s < 20 && isBorder) return "border";
  // Primary action colour — most frequent saturated colour
  if (rank === 0 && s > 40) return "primary";
  // Secondary action
  if (rank === 1 && s > 30) return "secondary";
  // Accent / highlight
  if (rank === 2 && s > 30) return "accent";
  // Muted info
  if (s < 20 && l > 30 && l < 75) return "muted";
  // Destructive / error
  if (hsl.h < 15 || hsl.h > 345) return "destructive";
  // Success
  if (hsl.h >= 100 && hsl.h < 160) return "success";
  // Warning
  if (hsl.h >= 35 && hsl.h < 65) return "warning";
  // Info
  if (hsl.h >= 190 && hsl.h < 250) return "info";

  return `color-${rank + 1}`;
}

// ------------------------------------------------------------------
// Deduplication: avoid two tokens with the same role
// ------------------------------------------------------------------

function deduplicateRoles(tokens: SemanticColorToken[]): SemanticColorToken[] {
  const seen = new Map<string, number>();
  return tokens.map((token) => {
    const baseName = token.cssVar.replace(/^--color-/, "");
    const count = seen.get(baseName) ?? 0;
    seen.set(baseName, count + 1);
    if (count > 0) {
      const newVar = `--color-${baseName}-${count + 1}`;
      return { ...token, cssVar: newVar };
    }
    return token;
  });
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Takes raw colours (already sorted by frequency desc) and returns
 * semantically labelled tokens with CSS variable names.
 */
export function labelColors(colors: RawColor[]): SemanticColorToken[] {
  const labelled: SemanticColorToken[] = colors.map((color, rank) => {
    const { r, g, b } = color.rgba;
    const hsl = rgbaToHSL(r, g, b);
    const family = hueToFamily(hsl.h, hsl.s);
    const role = assignRole(hsl, color.sources, rank);

    // Build CSS var: --color-{role} or --color-{family}-{role} for non-primary
    let cssVar: string;
    if (
      ["background", "foreground", "foreground-muted", "surface",
       "surface-raised", "border", "primary", "secondary", "accent",
       "muted", "destructive", "success", "warning", "info"].includes(role)
    ) {
      cssVar = `--color-${role}`;
    } else if (role.startsWith("color-")) {
      cssVar = `--color-${family}-${role.replace("color-", "")}`;
    } else {
      cssVar = `--color-${role}`;
    }

    const lightnessBucket =
      hsl.l < 30 ? "dark" : hsl.l > 70 ? "light" : "mid";

    const label = toTitleCase(cssVar.replace(/^--color-/, "").replace(/-/g, " "));

    return {
      ...color,
      cssVar,
      label,
      lightnessBucket,
    };
  });

  return deduplicateRoles(labelled);
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
