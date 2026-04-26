# Twift — Chrome Extension

> Scan any page → extract design tokens → export a production-ready Tailwind v4 `@theme` block.

---

## Directory Structure

```
tailwind-token-architect/
│
├── manifest.json                   # MV3 manifest
├── package.json                    # Bun + Vite + React deps
├── tsconfig.json                   # Strict TS (noUncheckedIndexedAccess etc.)
├── vite.config.ts                  # Multi-entry build (panel + SW + content)
│
├── assets/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
└── src/
    │
    ├── shared/                     # Zero-dependency, shared by all contexts
    │   ├── types.ts                # ★ Single source of truth for all types
    │   ├── color-labeller.ts       # HSL analysis → semantic CSS var names
    │   └── theme-generator.ts      # tokens → @theme block + JSON
    │
    ├── content/                    # Injected into the page's DOM context
    │   ├── index.ts                # Message listener, orchestrates scan
    │   └── scanner.ts              # ★ Core: chunked getComputedStyle scanner
    │
    ├── background/                 # MV3 service worker
    │   └── service-worker.ts       # Opens side panel, relays messages
    │
    └── panel/                      # Side panel React app
        ├── index.html
        ├── main.tsx
        ├── App.tsx
        ├── app.css                 # Tailwind v4 @import
        └── components/
            ├── ColorPalette.tsx    # Colour swatches grid
            ├── ThemeBlock.tsx      # Syntax-highlighted @theme output
            ├── TokenExporter.tsx   # Copy + JSON download buttons
            └── ScanProgress.tsx    # Phase progress bar
```

---

## Architecture — Message Flow

```
[Side Panel]  ──TRIGGER_SCAN──►  [Service Worker]
                                        │
                                        ▼
                               chrome.scripting.executeScript
                                        │
                                        ▼
                               [Content Script: scanner.ts]
                                        │
                                  chunked scan
                              (50 nodes / yield tick)
                                        │
                               SCAN_PROGRESS events
                                        │
                               [Service Worker relay]
                                        │
                                        ▼
                                [Side Panel UI updates]
                                        │
                               SCAN_COMPLETE payload
                                        │
                               color-labeller.ts  (heuristic)
                               theme-generator.ts
                                        │
                                @theme block + JSON tokens
```

---

## Key Design Decisions

### Non-Blocking Scanner

The scanner uses a **chunked iterator** — processing 50 DOM nodes then yielding
via `scheduler.postTask({ priority: 'background' })` (Chrome 94+) or `setTimeout(0)`.
This keeps the page interactive and FPS high even on 5,000+ node DOMs.

### Single `getComputedStyle` call per element

All CSS property reads are batched from a **single** `getComputedStyle(el)` call.
Calling it multiple times for the same element forces re-layout; batching avoids this.

### Hex normalisation as the dedup key

All colours are normalised to 6-digit lowercase hex (`#rrggbb`) before deduplication.
`rgb(59, 130, 246)` and `#3b82f6` and `#3B82F6` all resolve to the same token.

### Spacing snapper formula

```
snapped = Math.round(raw / 4) * 4
```

`15.8px` → `16px` → `1rem`. Tailwind's spacing scale is multiples of 4px.

---

## Running locally

```bash
# Install (Bun)
bun install

# Dev mode — rebuilds on save
bun run dev

# Production build
bun run build
```

Then open `chrome://extensions` → **Load unpacked** → select `dist/`.

---

## Next Steps (MVP roadmap)

| Phase | Feature                               |
| ----- | ------------------------------------- |
| ✅ 1  | Scanner: colours, typography, spacing |
| 🔲 2  | Side Panel UI with colour swatches    |
| 🔲 3  | @theme block renderer + copy button   |
| 🔲 4  | JSON export (W3C DTCG format)         |
| 🔲 5  | AI colour labelling via Anthropic API |
| 🔲 6  | Dark-mode aware scanning              |
| 🔲 7  | Ignore-list for unwanted colours      |
