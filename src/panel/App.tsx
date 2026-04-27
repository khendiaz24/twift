import { useEffect, useReducer, useState } from "react";
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
import { SERVER_URL, FREE_AI_EXPORTS_PER_MONTH } from "../shared/config";
import { ScanProgress } from "./components/ScanProgress";
import { ColorPalette } from "./components/ColorPalette";
import { ThemeBlock } from "./components/ThemeBlock";
import { TokenExporter } from "./components/TokenExporter";
import { AuthGate } from "./components/AuthGate";
import { ProBadge } from "./components/ProBadge";
import { UpgradeModal } from "./components/UpgradeModal";
import { AiUsageIndicator } from "./components/AiUsageIndicator";
import { useAuth } from "./hooks/useAuth";

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
      return { status: "scanning", phase: action.phase, progress: action.progress };
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
  const [useAI, setUseAI] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { session, isLoading, login, logout, incrementAiUsage } = useAuth();

  // Listen for messages from the service worker relay
  useEffect(() => {
    const handler = (message: ExtensionMessage) => {
      if (message.type === "SCAN_PROGRESS") {
        dispatch({ type: "PROGRESS", phase: message.payload.phase, progress: message.payload.progress });
      } else if (message.type === "SCAN_COMPLETE") {
        dispatch({ type: "SCAN_COMPLETE", raw: message.payload });
        handleEnrich(message.payload);
      } else if (message.type === "SCAN_ERROR") {
        dispatch({ type: "ERROR", message: message.payload.message });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAI, session]);

  async function handleEnrich(raw: ScanResult) {
    try {
      let result: EnrichedScanResult;

      if (useAI && session) {
        // Server-side AI enrichment
        result = await serverEnrich(raw, session.token, incrementAiUsage);
      } else {
        // Client-side heuristic (free, no server round-trip)
        result = await heuristicEnrich(raw);
      }

      dispatch({ type: "ENRICH_COMPLETE", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enrichment failed";
      // If quota exceeded, show upgrade modal instead of error
      if (message === "AI_QUOTA_EXCEEDED") {
        setShowUpgrade(true);
        // Fall back to heuristic result
        const fallback = await heuristicEnrich(raw);
        dispatch({ type: "ENRICH_COMPLETE", result: fallback });
        setUseAI(false);
      } else {
        dispatch({ type: "ERROR", message });
      }
    }
  }

  function triggerScan() {
    dispatch({ type: "START_SCAN" });
    chrome.runtime.sendMessage<ExtensionMessage>({ type: "TRIGGER_SCAN" });
  }

  function handleAiToggle() {
    if (!session) return;
    if (!useAI && session.tier === "free" && session.aiExportsUsed >= FREE_AI_EXPORTS_PER_MONTH) {
      setShowUpgrade(true);
      return;
    }
    setUseAI((v) => !v);
  }

  const scanning = state.status === "scanning" || state.status === "enriching";

  return (
    <AuthGate session={session} isLoading={isLoading} onLogin={login}>
      <div className="panel-root">
        {showUpgrade && session && (
          <UpgradeModal session={session} onClose={() => setShowUpgrade(false)} />
        )}

        <Header
          onScan={triggerScan}
          scanning={scanning}
          useAI={useAI}
          onAiToggle={handleAiToggle}
          session={session}
          onLogout={logout}
        />

        {session && (
          <AiUsageIndicator session={session} />
        )}

        {state.status === "idle" && <IdleScreen onScan={triggerScan} />}

        {scanning && (
          <ScanProgress
            phase={state.status === "enriching" ? "done" : (state as { phase: ScanPhase }).phase}
            progress={state.status === "enriching" ? 100 : (state as { progress: number }).progress}
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
    </AuthGate>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

interface HeaderProps {
  onScan: () => void;
  scanning: boolean;
  useAI: boolean;
  onAiToggle: () => void;
  session: ReturnType<typeof useAuth>["session"];
  onLogout: () => void;
}

function Header({ onScan, scanning, useAI, onAiToggle, session, onLogout }: HeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-logo">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
          <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
          <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4" />
          <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.2" />
        </svg>
        <span>Twift</span>
      </div>

      <div className="header-actions">
        {/* AI toggle */}
        <button
          id="ai-toggle-btn"
          className={`ai-toggle ${useAI ? "ai-toggle--on" : ""}`}
          onClick={onAiToggle}
          title={useAI ? "AI labelling ON — click to disable" : "Enable AI labelling (Pro feature)"}
        >
          <span className="ai-toggle-star">★</span>
          AI
        </button>

        <button
          id="scan-btn"
          className="scan-btn"
          onClick={onScan}
          disabled={scanning}
        >
          {scanning ? (
            <><span className="spin">⟳</span> Scanning…</>
          ) : (
            <><span>◎</span> Scan page</>
          )}
        </button>

        {session && <ProBadge session={session} onLogout={onLogout} />}
      </div>
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
        <li>★ AI labels (Pro)</li>
      </ul>
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
        <span className="meta-pill">{result.nodesScanned.toLocaleString()} nodes</span>
        <span className="meta-pill">{result.colors.length} colors</span>
        <span className="meta-pill">{result.typography.length} type styles</span>
        <span className="meta-pill">{result.spacing.length} spacing values</span>
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

      <button className="rescan-btn" onClick={onRescan}>↺ Rescan page</button>
    </div>
  );
}

// ─── Enrichment helpers ───────────────────────────────────────────────────────

async function heuristicEnrich(raw: ScanResult): Promise<EnrichedScanResult> {
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

async function serverEnrich(
  raw: ScanResult,
  token: string,
  onAiSuccess: () => void
): Promise<EnrichedScanResult> {
  const res = await fetch(`${SERVER_URL}/api/tokens/enrich`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scan: raw, useAI: true }),
  });

  if (res.status === 402) {
    throw new Error("AI_QUOTA_EXCEEDED");
  }

  if (!res.ok) {
    throw new Error("Server enrichment failed");
  }

  onAiSuccess();

  const data = (await res.json()) as { result: EnrichedScanResult };
  return data.result;
}
