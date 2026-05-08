# Changelog

All notable changes to **Twift** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Planned features and improvements go here.

---

## [0.1.0] - 2026-05-08

### Added

- Initial release of the Twift Chrome extension (Manifest V3).
- Side panel React UI built with Vite, React 18, and Tailwind CSS v4.
- Chunked `getComputedStyle` page scanner (`content/scanner.ts`) for non-blocking token extraction.
- Semantic color labelling via HSL analysis (`shared/color-labeller.ts`).
- Tailwind v4 `@theme` block and JSON export generation (`shared/theme-generator.ts`).
- `ColorPalette` component — color swatch grid display.
- `ThemeBlock` component — syntax-highlighted `@theme` output.
- `TokenExporter` component — copy-to-clipboard and JSON download.
- `ScanProgress` component — phase-based progress bar during scanning.
- `DonateButton` component.
- Background service worker that opens the side panel and relays messages.
- Hono-based server with JWT auth middleware and token routes.
- Stripe integration scaffold (`stripe.ts`).
- Strict TypeScript configuration (`noUncheckedIndexedAccess`, etc.).
- Multi-entry Vite build (panel + service worker + content script).

[Unreleased]: https://github.com/your-org/twift/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/twift/releases/tag/v0.1.0
