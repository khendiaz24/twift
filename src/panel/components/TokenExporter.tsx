import { useState } from "react";
import type { EnrichedScanResult } from "../../../shared/types";

interface Props {
  result: EnrichedScanResult;
}

export function TokenExporter({ result }: Props) {
  const [cssState, setCssState] = useState<"idle" | "done">("idle");

  function copyCSS() {
    navigator.clipboard.writeText(result.themeBlock).then(() => {
      setCssState("done");
      setTimeout(() => setCssState("idle"), 1500);
    });
  }

  function downloadJSON() {
    const blob = new Blob(
      [JSON.stringify(result.designTokens, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const pageSlug = new URL(result.pageUrl).hostname.replace(/\W/g, "-");
    a.href = url;
    a.download = `${pageSlug}-tokens.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="exporter-row">
      <button
        className="export-btn export-btn-primary"
        onClick={copyCSS}
      >
        {cssState === "done" ? "✓ Copied!" : "⎘ Copy @theme CSS"}
      </button>
      <button
        className="export-btn export-btn-secondary"
        onClick={downloadJSON}
      >
        ↓ JSON tokens
      </button>
    </div>
  );
}
