import type { ScanPhase } from "../../shared/types";

const PHASE_LABELS: Record<ScanPhase, string> = {
  "collecting-nodes": "Collecting nodes",
  "extracting-colors": "Extracting colors",
  "extracting-typography": "Extracting typography",
  "extracting-spacing": "Extracting spacing",
  "deduplicating": "Deduplicating",
  "done": "Finalising",
};

interface Props {
  phase: ScanPhase;
  progress: number;
  enriching: boolean;
}

export function ScanProgress({ phase, progress, enriching }: Props) {
  return (
    <div className="progress-wrap">
      <p className="progress-phase">{PHASE_LABELS[phase]}</p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-pct">{progress}%</p>
      {enriching && (
        <p className="progress-enriching">
          <span className="spin" style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
          Labelling tokens…
        </p>
      )}
    </div>
  );
}
