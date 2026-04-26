import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { ScanResult, EnrichedScanResult } from "../../shared/types";
import { labelColors } from "../../shared/color-labeller";
import { generateThemeBlock, generateDesignTokens } from "../../shared/theme-generator";

export const tokensRoute = new Hono();

// ── Schemas ──────────────────────────────────────────────────────────────────

const EnrichSchema = z.object({
  scan: z.object({
    scannedAt: z.string(),
    pageUrl: z.string().url(),
    pageTitle: z.string(),
    nodesScanned: z.number().int().nonnegative(),
    colors: z.array(z.any()),
    typography: z.array(z.any()),
    spacing: z.array(z.any()),
  }),
  useAI: z.boolean().default(false),
});

// ── POST /api/tokens/enrich ───────────────────────────────────────────────────
// Phase 1: heuristic labelling (free tier)
// Phase 2: AI labelling via Anthropic (pro tier, gated by useAI flag)
tokensRoute.post(
  "/enrich",
  zValidator("json", EnrichSchema),
  async (c) => {
    const { scan, useAI } = c.req.valid("json");
    const raw = scan as ScanResult;

    // Heuristic labelling (always runs)
    let colors = labelColors(raw.colors);

    // AI labelling (Pro tier only)
    if (useAI && isPro(c)) {
      colors = await aiLabelColors(colors, raw.pageTitle);
    }

    const partial = { ...raw, colors, themeBlock: "", designTokens: { color: {}, fontSize: {}, fontFamily: {}, spacing: {} } };
    const themeBlock = generateThemeBlock(partial);
    const designTokens = generateDesignTokens(partial);

    const result: EnrichedScanResult = { ...raw, colors, themeBlock, designTokens };
    return c.json({ ok: true, result });
  }
);

// ── GET /api/tokens/history ───────────────────────────────────────────────────
// Returns the 20 most recent scans for the authenticated user
tokensRoute.get("/history", async (c) => {
  const userId = c.get("userId") as string;
  // TODO: query from your DB (Turso / Postgres / etc.)
  // Returning stub for now
  return c.json({ ok: true, userId, scans: [] });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check if user context has an active Pro subscription */
function isPro(c: Parameters<typeof tokensRoute.post>[1]): boolean {
  // Populated by authMiddleware from the JWT / DB lookup
  return (c.get("tier") as string | undefined) === "pro";
}

/**
 * Phase 2: AI color labelling via Anthropic API.
 * Sends the palette to Claude and gets back richer semantic names.
 */
async function aiLabelColors(
  colors: ReturnType<typeof labelColors>,
  pageTitle: string
): Promise<ReturnType<typeof labelColors>> {
  const palette = colors.map((c) => ({
    hex: c.hex,
    currentVar: c.cssVar,
    sources: c.sources,
    frequency: c.frequency,
  }));

  const prompt = `You are a design systems expert. Given this color palette extracted from "${pageTitle}", assign the best semantic CSS variable names for a Tailwind v4 @theme block.

Return ONLY a valid JSON array where each item has: { "hex": string, "cssVar": string, "label": string }

Rules:
- CSS vars must start with --color-
- Use semantic roles: primary, secondary, accent, background, foreground, surface, muted, destructive, success, warning, info, border
- Prefer brand-aware names where obvious (e.g. --color-brand-blue)
- No duplicates

Palette:
${JSON.stringify(palette, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env["ANTHROPIC_API_KEY"] ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.warn("[aiLabelColors] Anthropic API error, falling back to heuristic");
    return colors;
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((b) => b.type === "text")?.text ?? "";

  try {
    const raw = text.replace(/```json|```/g, "").trim();
    const aiTokens = JSON.parse(raw) as Array<{ hex: string; cssVar: string; label: string }>;
    const map = new Map(aiTokens.map((t) => [t.hex, t]));

    return colors.map((c) => {
      const ai = map.get(c.hex);
      if (!ai) return c;
      return { ...c, cssVar: ai.cssVar, label: ai.label };
    });
  } catch {
    console.warn("[aiLabelColors] JSON parse failed, falling back");
    return colors;
  }
}
