// ============================================================
// server/routes/tokens.ts
// ============================================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { ScanResult, EnrichedScanResult } from "../../src/shared/types";
import { labelColors } from "../../src/shared/color-labeller";
import { generateThemeBlock, generateDesignTokens } from "../../src/shared/theme-generator";
import { checkAndIncrementAiUsage } from "../db";
import type { HonoVariables } from "../types";

export const tokensRoute = new Hono<{ Variables: HonoVariables }>();

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
tokensRoute.post(
  "/enrich",
  zValidator("json", EnrichSchema),
  async (c) => {
    const { scan, useAI } = c.req.valid("json");
    const raw = scan as ScanResult;
    const userId = c.get("userId");
    const tier = c.get("tier");

    // Heuristic labelling (always runs first)
    let colors = labelColors(raw.colors);

    // AI labelling path
    if (useAI) {
      if (tier === "pro") {
        colors = await aiLabelColors(colors, raw.pageTitle);
      } else {
        const usage = await checkAndIncrementAiUsage(userId);
        if (!usage.allowed) {
          return c.json(
            {
              error: "AI_QUOTA_EXCEEDED",
              message: `You've used all ${usage.limit} free AI exports this month. Upgrade to Pro for unlimited.`,
              used: usage.used,
              limit: usage.limit,
              resetAt: usage.resetAt,
            },
            402
          );
        }
        colors = await aiLabelColors(colors, raw.pageTitle);
        c.header("X-AI-Exports-Used", String(usage.used));
        c.header("X-AI-Exports-Limit", String(usage.limit));
        c.header("X-AI-Exports-Reset", usage.resetAt);
      }
    }

    const partial = {
      ...raw,
      colors,
      themeBlock: "",
      designTokens: { color: {}, fontSize: {}, fontFamily: {}, spacing: {} },
    };
    const themeBlock = generateThemeBlock(partial);
    const designTokens = generateDesignTokens(partial);

    const result: EnrichedScanResult = { ...raw, colors, themeBlock, designTokens };
    return c.json({ ok: true, result });
  }
);

// ── GET /api/tokens/history ───────────────────────────────────────────────────
tokensRoute.get("/history", async (c) => {
  const userId = c.get("userId");
  return c.json({ ok: true, userId, scans: [] });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function aiLabelColors(
  colors: ReturnType<typeof labelColors>,
  pageTitle: string
): Promise<ReturnType<typeof labelColors>> {
  const palette = colors.map((col) => ({
    hex: col.hex,
    currentVar: col.cssVar,
    sources: col.sources,
    frequency: col.frequency,
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

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env["GEMINI_API_KEY"] ?? ""}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    console.warn("[aiLabelColors] Gemini API error, falling back to heuristic");
    return colors;
  }

  const data = (await res.json()) as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const raw = text.replace(/```json|```/g, "").trim();
    const aiTokens = JSON.parse(raw) as Array<{ hex: string; cssVar: string; label: string }>;
    const map = new Map(aiTokens.map((t) => [t.hex, t]));

    return colors.map((col) => {
      const ai = map.get(col.hex);
      if (!ai) return col;
      return { ...col, cssVar: ai.cssVar, label: ai.label };
    });
  } catch {
    console.warn("[aiLabelColors] JSON parse failed, falling back");
    return colors;
  }
}
