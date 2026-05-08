// ============================================================
// content/scanner.ts
//
// Scans the current page's computed styles without blocking
// the main thread. Uses a chunked iterator with yielding via
// scheduler.postTask / setTimeout fallback so the browser
// can handle user input and rendering between batches.
// ============================================================

import type {
  ColorSource,
  RGBA,
  RawColor,
  ScanPhase,
  ScanResult,
  SpacingProperty,
  SpacingToken,
  TypographyToken,
} from "../shared/types";

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Number of DOM nodes processed per microtask chunk */
const CHUNK_SIZE = 50;

/** CSS properties we care about for colour extraction */
const COLOR_PROPS: ColorSource[] = [
  "color",
  "background-color",
  "border-color",
  "outline-color",
  "fill",
  "stroke",
  "text-decoration-color",
  "caret-color",
  "accent-color",
];

/** CSS properties we care about for spacing extraction */
const SPACING_PROPS: SpacingProperty[] = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "gap",
  "row-gap",
  "column-gap",
];

/** Colours that are transparent/none and should be skipped */
const SKIP_COLOR_PATTERNS =
  /^(transparent|rgba?\(0,\s*0,\s*0,\s*0\)|none|initial|inherit|currentcolor)$/i;

/** Minimum frequency for a colour to be included in the palette */
const MIN_COLOR_FREQUENCY = 1;

// ------------------------------------------------------------------
// Progress callback type
// ------------------------------------------------------------------

export type ProgressCallback = (phase: ScanPhase, progress: number) => void;

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Entry point. Scans the entire document and returns a ScanResult.
 * Non-blocking: yields to the browser between each CHUNK_SIZE batch.
 */
export async function scanPage(
  onProgress?: ProgressCallback,
): Promise<ScanResult> {
  const startedAt = Date.now();
  const report = (phase: ScanPhase, progress: number) =>
    onProgress?.(phase, progress);

  // 1. Collect all visible elements (excluding script/style/meta nodes)
  report("collecting-nodes", 0);
  const elements = collectElements();
  const total = elements.length;

  // 2. Accumulate raw data maps
  const colorMap = new Map<string, RawColor>();
  const typographySet = new Map<string, TypographyToken>();
  const spacingMap = new Map<string, SpacingToken>();

  // 3. Process in chunks, yielding between each batch
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = elements.slice(i, i + CHUNK_SIZE);
    const progress = Math.round((i / total) * 100);

    if (i < total * 0.33) report("extracting-colors", progress);
    else if (i < total * 0.66) report("extracting-typography", progress);
    else report("extracting-spacing", progress);

    processChunk(chunk, colorMap, typographySet, spacingMap);

    // Yield to browser between chunks to avoid jank
    await yieldToMain();
  }

  report("deduplicating", 95);

  // 4. Filter low-frequency colours and finalise
  const colors = Array.from(colorMap.values())
    .filter((c) => c.frequency >= MIN_COLOR_FREQUENCY)
    .sort((a, b) => b.frequency - a.frequency);

  const typography = Array.from(typographySet.values()).sort(
    (a, b) => b.frequency - a.frequency,
  );

  const spacing = Array.from(spacingMap.values()).sort(
    (a, b) => b.frequency - a.frequency,
  );

  report("done", 100);

  return {
    scannedAt: new Date().toISOString(),
    pageUrl: location.href,
    pageTitle: document.title,
    nodesScanned: total,
    colors,
    typography,
    spacing,
  };
}

// ------------------------------------------------------------------
// Element collection
// ------------------------------------------------------------------

function collectElements(): Element[] {
  // TreeWalker is ~3× faster than querySelectorAll("*") for large DOMs
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const tag = (node as Element).tagName.toLowerCase();
        // Skip non-visual nodes
        if (
          ["script", "style", "noscript", "meta", "link", "head"].includes(tag)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const elements: Element[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    elements.push(current as Element);
  }
  return elements;
}

// ------------------------------------------------------------------
// Per-chunk processing
// ------------------------------------------------------------------

function processChunk(
  elements: Element[],
  colorMap: Map<string, RawColor>,
  typographySet: Map<string, TypographyToken>,
  spacingMap: Map<string, SpacingToken>,
): void {
  for (const el of elements) {
    // One getComputedStyle call per element — do NOT call it inside loops
    const style = window.getComputedStyle(el);
    extractColors(style, colorMap);
    extractTypography(style, typographySet);
    extractSpacing(style, spacingMap);
  }
}

// ------------------------------------------------------------------
// Color extraction
// ------------------------------------------------------------------

function extractColors(
  style: CSSStyleDeclaration,
  colorMap: Map<string, RawColor>,
): void {
  for (const prop of COLOR_PROPS) {
    const raw = style.getPropertyValue(prop).trim();
    if (!raw || SKIP_COLOR_PATTERNS.test(raw)) continue;

    const rgba = parseColor(raw);
    if (!rgba) continue;

    // Skip fully transparent
    if (rgba.a === 0) continue;

    const hex = rgbaToHex(rgba);

    const existing = colorMap.get(hex);
    if (existing) {
      existing.frequency++;
      if (!existing.sources.includes(prop as ColorSource)) {
        existing.sources.push(prop as ColorSource);
      }
    } else {
      colorMap.set(hex, {
        original: raw,
        hex,
        rgba,
        frequency: 1,
        sources: [prop as ColorSource],
      });
    }
  }
}

// ------------------------------------------------------------------
// Typography extraction
// ------------------------------------------------------------------

function extractTypography(
  style: CSSStyleDeclaration,
  typographySet: Map<string, TypographyToken>,
): void {
  const fontFamily = style.getPropertyValue("font-family").trim();
  const fontSizeRaw = style.getPropertyValue("font-size").trim();
  const fontWeight = style.getPropertyValue("font-weight").trim();
  const lineHeight = style.getPropertyValue("line-height").trim();
  const letterSpacing = style.getPropertyValue("letter-spacing").trim();

  if (!fontFamily || !fontSizeRaw) return;

  const fontSizePx = parseFloat(fontSizeRaw);
  if (isNaN(fontSizePx) || fontSizePx <= 0) return;

  const fontSizeSnapped = snapToGrid(fontSizePx, 4);

  // Key by the combination that defines a unique text style
  const key = `${fontFamily}::${fontSizeSnapped}::${fontWeight}`;

  const existing = typographySet.get(key);
  if (existing) {
    existing.frequency++;
  } else {
    typographySet.set(key, {
      fontFamily: normaliseFontFamily(fontFamily),
      fontSizePx,
      fontSizeSnapped,
      fontWeight,
      lineHeight,
      letterSpacing,
      frequency: 1,
    });
  }
}

// ------------------------------------------------------------------
// Spacing extraction
// ------------------------------------------------------------------

function extractSpacing(
  style: CSSStyleDeclaration,
  spacingMap: Map<string, SpacingToken>,
): void {
  for (const prop of SPACING_PROPS) {
    const raw = style.getPropertyValue(prop).trim();
    if (!raw || raw === "0px" || raw === "auto" || raw === "normal") continue;

    const valuePx = parseFloat(raw);
    if (isNaN(valuePx) || valuePx <= 0) continue;

    const snappedPx = snapToGrid(valuePx, 4);
    const snappedRem = +(snappedPx / 16).toFixed(4);
    const key = `${prop}::${snappedPx}`;

    const existing = spacingMap.get(key);
    if (existing) {
      existing.frequency++;
    } else {
      spacingMap.set(key, {
        original: raw,
        valuePx,
        snappedPx,
        snappedRem,
        property: prop as SpacingProperty,
        frequency: 1,
      });
    }
  }
}

// ------------------------------------------------------------------
// Color parsing utilities
// ------------------------------------------------------------------

/**
 * Parses a CSS color string to RGBA.
 * Handles: rgb(), rgba(), and #hex forms.
 * Returns null for unparseable values.
 */
function parseColor(value: string): RGBA | null {
  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbMatch) {
    return {
      r: clamp(Math.round(parseFloat(rgbMatch[1]!)), 0, 255),
      g: clamp(Math.round(parseFloat(rgbMatch[2]!)), 0, 255),
      b: clamp(Math.round(parseFloat(rgbMatch[3]!)), 0, 255),
      a: rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1,
    };
  }

  // CSS Color Level 4: rgb(r g b / a)
  const rgb4Match = value.match(
    /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/,
  );
  if (rgb4Match) {
    const alpha = rgb4Match[4]
      ? rgb4Match[4].endsWith("%")
        ? parseFloat(rgb4Match[4]) / 100
        : parseFloat(rgb4Match[4])
      : 1;
    return {
      r: clamp(Math.round(parseFloat(rgb4Match[1]!)), 0, 255),
      g: clamp(Math.round(parseFloat(rgb4Match[2]!)), 0, 255),
      b: clamp(Math.round(parseFloat(rgb4Match[3]!)), 0, 255),
      a: clamp(alpha, 0, 1),
    };
  }

  // #rrggbb or #rrggbbaa or #rgb or #rgba
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    return hexToRGBA(hexMatch[1]!);
  }

  return null;
}

function hexToRGBA(hex: string): RGBA | null {
  let h = hex;
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length === 4)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length === 6) h += "ff";
  if (h.length !== 8) return null;

  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16) / 255,
  };
}

function rgbaToHex({ r, g, b }: RGBA): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase()
  );
}

// ------------------------------------------------------------------
// Maths utilities
// ------------------------------------------------------------------

/** Snap a pixel value to the nearest multiple of `grid` (default 4px) */
export function snapToGrid(value: number, grid: number = 4): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ------------------------------------------------------------------
// Font family normalisation
// ------------------------------------------------------------------

/** Returns the first (primary) font family, unquoted */
function normaliseFontFamily(raw: string): string {
  const first = raw.split(",")[0]?.trim() ?? raw;
  return first.replace(/^["']|["']$/g, "");
}

// ------------------------------------------------------------------
// Scheduler yield
// ------------------------------------------------------------------

/**
 * Yields to the main thread to allow rendering/input between chunks.
 * Uses scheduler.postTask when available (Chrome 94+), falls back to
 * setTimeout(0) which is the universal option.
 */
function yieldToMain(): Promise<void> {
  if (
    typeof globalThis.scheduler !== "undefined" &&
    typeof (globalThis.scheduler as { postTask?: unknown }).postTask ===
      "function"
  ) {
    return (
      globalThis.scheduler as {
        postTask: (cb: () => void, opts: { priority: string }) => Promise<void>;
      }
    ).postTask(() => {}, { priority: "background" });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
