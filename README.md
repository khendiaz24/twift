# Twift — Chrome Extension

> Scan any page → extract design tokens → export a production-ready Tailwind v4 `@theme` block.

---

## Directory Structure

```
twift/
│
├── manifest.json                   # MV3 manifest
├── package.json                    # Bun + Vite + React deps
├── tsconfig.json                   # Strict TS
├── vite.config.ts                  # Multi-entry build (panel + SW + content)
│
├── assets/icons/                   # Extension icons (16/32/48/128)
│
├── server/                         # Bun HTTP server (Hono)
│   ├── index.ts                    # App entrypoint, route registration
│   ├── db.ts                       # libsql/Turso database abstraction
│   ├── types.ts                    # Hono context variable types
│   ├── middleware/
│   │   └── auth.ts                 # JWT verification middleware
│   └── routes/
│       ├── auth.ts                 # Google OAuth callback + JWT issuance
│       ├── lemonsqueezy.ts         # LemonSqueezy checkout + webhook handler
│       ├── tokens.ts               # Token enrichment + AI labelling
│       └── user.ts                 # /api/user/me endpoint
│
└── src/
    ├── shared/                     # Zero-dependency, shared by all contexts
    │   ├── types.ts                # Single source of truth for all types
    │   ├── config.ts               # SERVER_URL, FREE_AI_EXPORTS_PER_MONTH
    │   ├── color-labeller.ts       # HSL analysis → semantic CSS var names
    │   └── theme-generator.ts      # tokens → @theme block + JSON
    │
    ├── content/                    # Injected into the page's DOM context
    │   ├── index.ts                # Message listener, orchestrates scan
    │   └── scanner.ts              # Chunked getComputedStyle scanner
    │
    ├── background/
    │   └── service-worker.ts       # MV3 service worker, relays messages
    │
    └── panel/                      # Side panel React app
        ├── index.html
        ├── main.tsx
        ├── App.tsx
        ├── app.css
        ├── hooks/
        │   └── useAuth.ts          # Session management + live tier refresh
        └── components/
            ├── AuthGate.tsx
            ├── LoginView.tsx
            ├── ColorPalette.tsx
            ├── ThemeBlock.tsx
            ├── TokenExporter.tsx
            ├── ScanProgress.tsx
            ├── AiUsageIndicator.tsx
            ├── ProBadge.tsx
            └── UpgradeModal.tsx    # LemonSqueezy checkout trigger
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
                         POST /api/tokens/enrich  (+ JWT)
                                        │
                               color-labeller.ts  (heuristic)
                           [optional] Gemini 2.0 Flash (AI)
                               theme-generator.ts
                                        │
                                @theme block + JSON tokens
```

---

## Subscription — LemonSqueezy

Twift uses **LemonSqueezy** for Pro subscriptions (replaces Stripe).

### Tiers

| Feature             | Free      | Pro         |
| ------------------- | --------- | ----------- |
| Heuristic scans     | Unlimited | Unlimited   |
| CSS / JSON export   | ✓         | ✓           |
| AI colour labelling | 3 / month | Unlimited   |
| Scan history        | ✗         | ✓ (last 20) |

### Checkout flow

1. User clicks **Upgrade to Pro** → panel calls `POST /lemonsqueezy/create-checkout`
2. Server creates a LemonSqueezy checkout session and returns the URL
3. Extension opens the checkout in a new tab
4. After payment, LemonSqueezy fires a `subscription_created` webhook
5. Server verifies the HMAC-SHA256 `X-Signature`, sets `tier = 'pro'` in the DB
6. Next time the panel opens, `useAuth` refreshes the session from `/api/user/me`

### Required environment variables

```env
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...   # max 40 chars
```

### Webhook events handled

- `subscription_created` / `subscription_updated` → set tier to `pro` or `free`
- `subscription_cancelled` / `subscription_expired` → downgrade to `free`

---

## Running locally

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Copy `.env` and fill in values:

```env
PORT=3000
SERVER_URL=https://<your-tunnel>.ngrok-free.app   # or localhost:3000 for local only

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

GEMINI_API_KEY=...

JWT_SECRET=<openssl rand -base64 32>

LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=<openssl rand -hex 20>

# Optional — Turso for production DB
TURSO_URL=
TURSO_AUTH_TOKEN=
```

### 3. Start the API server

```bash
bun run server:dev
```

### 4. Expose server for webhooks (dev only)

```bash
ngrok http 3000
# or: npx cloudflared tunnel --url http://localhost:3000
```

Set the ngrok URL as `SERVER_URL` in `.env` and as the LemonSqueezy webhook callback:

```
https://<tunnel>/lemonsqueezy/webhook
```

### 5. Build & load the extension

```bash
bun run build
```

Open `chrome://extensions` → **Load unpacked** → select `dist/`.

---

## Key Design Decisions

### Non-Blocking Scanner

The scanner uses a **chunked iterator** — processing 50 DOM nodes then yielding
via `scheduler.postTask({ priority: 'background' })` (Chrome 94+) or `setTimeout(0)`.
This keeps the page interactive even on 5,000+ node DOMs.

### Single `getComputedStyle` call per element

All CSS property reads are batched from a single `getComputedStyle(el)` call to avoid forced re-layouts.

### Hex normalisation as the dedup key

All colours are normalised to 6-digit lowercase hex before deduplication.
`rgb(59, 130, 246)` and `#3b82f6` and `#3B82F6` all resolve to the same token.

### Spacing snapper

```
snapped = Math.round(raw / 4) * 4
```

`15.8px` → `16px` → `1rem`. Aligns to Tailwind's 4px spacing scale.

### Live tier refresh

On every panel open, `useAuth` fetches `/api/user/me` and updates the cached session.
This ensures Pro status is reflected immediately after a successful payment without requiring re-login.

---

## Feature Status

| Phase | Feature                               |
| ----- | ------------------------------------- |
| ✅ 1  | Scanner: colours, typography, spacing |
| ✅ 2  | Side Panel UI with colour swatches    |
| ✅ 3  | @theme block renderer + copy button   |
| ✅ 4  | JSON export (W3C DTCG format)         |
| ✅ 5  | Google OAuth + JWT authentication     |
| ✅ 6  | AI colour labelling via Gemini        |
| ✅ 7  | Pro subscriptions via LemonSqueezy    |
| 🔲 8  | Dark-mode aware scanning              |
| 🔲 9  | Ignore-list for unwanted colours      |
