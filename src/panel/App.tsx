import { useEffect, useReducer } from "react";
import type {
  EnrichedScanResult,
  ExtensionMessage,
  ScanPhase,
  ScanResult,
} from "../shared/types";
import { labelColors } from "../shared/color-labeller";
import {
  generateThemeBlock,
  generateDesignTokens,
} from "../shared/theme-generator";
import { ScanProgress } from "./components/ScanProgress";
import { ColorPalette } from "./components/ColorPalette";
import { ThemeBlock } from "./components/ThemeBlock";
import { TokenExporter } from "./components/TokenExporter";
import { DonateButton } from "./components/DonateButton";

// ─── State ───────────────────────────────────────────────────────────────────

type AppState =
  | { status: "idle" }
  | { status: "scanning"; phase: ScanPhase; progress: number }
  | { status: "enriching" }
  | { status: "done"; result: EnrichedScanResult }
  | { status: "error"; message: string };

type Action =
  | { type: "START_SCAN" }
  | { type: "PROGRESS"; phase: ScanPhase; progress: number }
  | { type: "SCAN_COMPLETE"; raw: ScanResult }
  | { type: "ENRICH_COMPLETE"; result: EnrichedScanResult }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "START_SCAN":
      return { status: "scanning", phase: "collecting-nodes", progress: 0 };
    case "PROGRESS":
      return {
        status: "scanning",
        phase: action.phase,
        progress: action.progress,
      };
    case "SCAN_COMPLETE":
      return { status: "enriching" };
    case "ENRICH_COMPLETE":
      return { status: "done", result: action.result };
    case "ERROR":
      return { status: "error", message: action.message };
    case "RESET":
      return { status: "idle" };
    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function App() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  // Listen for messages from the service worker relay
  useEffect(() => {
    const handler = (message: ExtensionMessage) => {
      if (message.type === "SCAN_PROGRESS") {
        dispatch({
          type: "PROGRESS",
          phase: message.payload.phase,
          progress: message.payload.progress,
        });
      } else if (message.type === "SCAN_COMPLETE") {
        dispatch({ type: "SCAN_COMPLETE", raw: message.payload });
        // Enrich on the panel side — no round-trip needed for heuristic labelling
        enrichResult(message.payload)
          .then((result) => {
            dispatch({ type: "ENRICH_COMPLETE", result });
          })
          .catch((err) => {
            dispatch({
              type: "ERROR",
              message: err instanceof Error ? err.message : "Enrichment failed",
            });
          });
      } else if (message.type === "SCAN_ERROR") {
        dispatch({ type: "ERROR", message: message.payload.message });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  function triggerScan() {
    dispatch({ type: "START_SCAN" });
    chrome.runtime.sendMessage<ExtensionMessage>({ type: "TRIGGER_SCAN" });
  }

  return (
    <div className="panel-root">
      <Header
        onScan={triggerScan}
        scanning={state.status === "scanning" || state.status === "enriching"}
      />

      {state.status === "idle" && <IdleScreen onScan={triggerScan} />}

      {(state.status === "scanning" || state.status === "enriching") && (
        <ScanProgress
          phase={state.status === "enriching" ? "done" : state.phase}
          progress={state.status === "enriching" ? 100 : state.progress}
          enriching={state.status === "enriching"}
        />
      )}

      {state.status === "error" && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <p>{state.message}</p>
          <button onClick={() => dispatch({ type: "RESET" })}>Dismiss</button>
        </div>
      )}

      {state.status === "done" && (
        <ResultView result={state.result} onRescan={triggerScan} />
      )}
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function Header({
  onScan,
  scanning,
}: {
  onScan: () => void;
  scanning: boolean;
}) {
  return (
    <header className="panel-header">
      <div className="panel-logo">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect
            x="2"
            y="2"
            width="7"
            height="7"
            rx="1.5"
            fill="currentColor"
            opacity="0.9"
          />
          <rect
            x="11"
            y="2"
            width="7"
            height="7"
            rx="1.5"
            fill="currentColor"
            opacity="0.6"
          />
          <rect
            x="2"
            y="11"
            width="7"
            height="7"
            rx="1.5"
            fill="currentColor"
            opacity="0.4"
          />
          <rect
            x="11"
            y="11"
            width="7"
            height="7"
            rx="1.5"
            fill="currentColor"
            opacity="0.2"
          />
        </svg>
        <span>Twift</span>
      </div>
      <button className="scan-btn" onClick={onScan} disabled={scanning}>
        {scanning ? (
          <>
            <span className="spin">⟳</span> Scanning…
          </>
        ) : (
          <>
            <span>◎</span> Scan page
          </>
        )}
      </button>
    </header>
  );
}

function IdleScreen({ onScan }: { onScan: () => void }) {
  return (
    <div className="idle-screen">
      <div className="idle-art">
        <div className="idle-swatch" style={{ background: "#3b82f6" }} />
        <div className="idle-swatch" style={{ background: "#8b5cf6" }} />
        <div className="idle-swatch" style={{ background: "#10b981" }} />
        <div className="idle-swatch" style={{ background: "#f59e0b" }} />
        <div className="idle-swatch" style={{ background: "#ef4444" }} />
      </div>
      <h2>
        Extract design tokens
        <br />
        from any page
      </h2>
      <p>
        Scan computed styles and export a production-ready Tailwind v4{" "}
        <code>@theme</code> block.
      </p>
      <button className="scan-btn-large" onClick={onScan}>
        ◎ Scan this page
      </button>
      <ul className="feature-list">
        <li>✦ Semantic color naming</li>
        <li>✦ Typography scale extraction</li>
        <li>✦ 4px spacing snapper</li>
        <li>✦ Copy CSS or export JSON</li>
      </ul>
      <DonateButton />
    </div>
  );
}

function ResultView({
  result,
  onRescan,
}: {
  result: EnrichedScanResult;
  onRescan: () => void;
}) {
  return (
    <div className="result-view">
      <div className="result-meta">
        <span className="meta-pill">
          {result.nodesScanned.toLocaleString()} nodes
        </span>
        <span className="meta-pill">{result.colors.length} colors</span>
        <span className="meta-pill">
          {result.typography.length} type styles
        </span>
        <span className="meta-pill">
          {result.spacing.length} spacing values
        </span>
      </div>

      <section className="result-section">
        <h3 className="section-title">Color Palette</h3>
        <ColorPalette colors={result.colors} />
      </section>

      <section className="result-section">
        <h3 className="section-title">Theme Block</h3>
        <ThemeBlock code={result.themeBlock} />
      </section>

      <section className="result-section">
        <h3 className="section-title">Export</h3>
        <TokenExporter result={result} />
      </section>

      <button className="rescan-btn" onClick={onRescan}>
        ↺ Rescan page
      </button>
      <DonateButton />
    </div>
  );
}

// ─── Enrichment (client-side heuristic, Phase 1) ─────────────────────────────

async function enrichResult(raw: ScanResult): Promise<EnrichedScanResult> {
  const colors = labelColors(raw.colors);
  const themeBlock = generateThemeBlock({
    ...raw,
    colors,
    themeBlock: "",
    designTokens: { color: {}, fontSize: {}, fontFamily: {}, spacing: {} },
  });
  const designTokens = generateDesignTokens({
    ...raw,
    colors,
    themeBlock,
    designTokens: { color: {}, fontSize: {}, fontFamily: {}, spacing: {} },
  });
  return { ...raw, colors, themeBlock, designTokens };
}
