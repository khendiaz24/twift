// ============================================================
// shared/theme-generator.ts
//
// Converts enriched token data into:
//  1. A Tailwind v4 @theme { } CSS block
//  2. A flat Design Token JSON (W3C DTCG format)
// ============================================================

import type {
  DesignTokens,
  EnrichedScanResult,
  SemanticColorToken,
  SpacingToken,
  TypographyToken,
} from "./types";

// ------------------------------------------------------------------
// @theme block generator
// ------------------------------------------------------------------

export function generateThemeBlock(result: EnrichedScanResult): string {
  const lines: string[] = ["@theme {"];

  // ---- Colors ------------------------------------------------
  if (result.colors.length > 0) {
    lines.push("  /* Colors */");
    for (const color of result.colors) {
      const comment =
        color.rgba.a < 1
          ? ` /* ${color.hex} @ ${Math.round(color.rgba.a * 100)}% opacity */`
          : ` /* ${color.hex} */`;
      lines.push(`  ${color.cssVar}: ${color.hex};${comment}`);
    }
    lines.push("");
  }

  // ---- Typography --------------------------------------------
  const fontFamilies = dedupeBy(result.typography, (t) => t.fontFamily);
  if (fontFamilies.length > 0) {
    lines.push("  /* Font Families */");
    fontFamilies.forEach((t, i) => {
      const key = i === 0 ? "--font-sans" : `--font-${slugify(t.fontFamily)}`;
      lines.push(`  ${key}: "${t.fontFamily}", sans-serif;`);
    });
    lines.push("");
  }

  const fontSizes = dedupeBy(result.typography, (t) => t.fontSizeSnapped)
    .sort((a, b) => a.fontSizeSnapped - b.fontSizeSnapped);
  if (fontSizes.length > 0) {
    lines.push("  /* Font Sizes */");
    fontSizes.forEach((t) => {
      const rem = (t.fontSizeSnapped / 16).toFixed(4).replace(/\.?0+$/, "");
      const key = `--text-${fontSizeToScale(t.fontSizeSnapped)}`;
      lines.push(`  ${key}: ${rem}rem; /* ${t.fontSizeSnapped}px */`);
    });
    lines.push("");
  }

  // ---- Spacing -----------------------------------------------
  const spacingValues = dedupeBy(result.spacing, (s) => s.snappedPx)
    .sort((a, b) => a.snappedPx - b.snappedPx);
  if (spacingValues.length > 0) {
    lines.push("  /* Spacing */");
    spacingValues.forEach((s) => {
      const rem = s.snappedRem.toFixed(4).replace(/\.?0+$/, "");
      const key = `--spacing-${s.snappedPx / 4}`;
      lines.push(`  ${key}: ${rem}rem; /* ${s.snappedPx}px */`);
    });
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
}

// ------------------------------------------------------------------
// JSON Design Tokens (W3C DTCG)
// ------------------------------------------------------------------

export function generateDesignTokens(result: EnrichedScanResult): DesignTokens {
  const color: DesignTokens["color"] = {};
  for (const c of result.colors) {
    const key = c.cssVar.replace(/^--color-/, "");
    color[key] = {
      $value: c.hex,
      $type: "color",
      $description: `${c.label} — ${c.frequency} occurrences`,
    };
  }

  const fontSize: DesignTokens["fontSize"] = {};
  const seenSizes = new Set<number>();
  for (const t of result.typography) {
    if (seenSizes.has(t.fontSizeSnapped)) continue;
    seenSizes.add(t.fontSizeSnapped);
    const key = fontSizeToScale(t.fontSizeSnapped);
    fontSize[key] = {
      $value: `${(t.fontSizeSnapped / 16).toFixed(4).replace(/\.?0+$/, "")}rem`,
      $type: "dimension",
    };
  }

  const fontFamily: DesignTokens["fontFamily"] = {};
  const seenFamilies = new Set<string>();
  result.typography.forEach((t, i) => {
    if (seenFamilies.has(t.fontFamily)) return;
    seenFamilies.add(t.fontFamily);
    const key = i === 0 ? "sans" : slugify(t.fontFamily);
    fontFamily[key] = {
      $value: `"${t.fontFamily}", sans-serif`,
      $type: "fontFamily",
    };
  });

  const spacing: DesignTokens["spacing"] = {};
  const seenSpacing = new Set<number>();
  for (const s of result.spacing) {
    if (seenSpacing.has(s.snappedPx)) continue;
    seenSpacing.add(s.snappedPx);
    const key = String(s.snappedPx / 4);
    spacing[key] = {
      $value: `${s.snappedRem}rem`,
      $type: "dimension",
    };
  }

  return { color, fontSize, fontFamily, spacing };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function dedupeBy<T>(arr: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const T_SHIRT_SCALE: Record<number, string> = {
  10: "2xs", 12: "xs", 14: "sm", 16: "base", 18: "lg",
  20: "xl", 24: "2xl", 28: "3xl", 32: "4xl", 36: "5xl",
  40: "6xl", 48: "7xl", 56: "8xl", 64: "9xl", 72: "10xl",
};

function fontSizeToScale(px: number): string {
  return T_SHIRT_SCALE[px] ?? `${px}px`;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
