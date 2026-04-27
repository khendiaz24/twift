// ============================================================
// panel/components/AiUsageIndicator.tsx
// Compact bar showing free-tier AI export usage.
// Hidden for Pro users.
// ============================================================

import { FREE_AI_EXPORTS_PER_MONTH } from "../../shared/config";
import type { UserSession } from "../../shared/types";

interface Props {
  session: UserSession;
}

export function AiUsageIndicator({ session }: Props) {
  if (session.tier === "pro") return null;

  const used = session.aiExportsUsed;
  const limit = FREE_AI_EXPORTS_PER_MONTH;
  const pct = Math.min((used / limit) * 100, 100);
  const resetDate = new Date(session.aiExportsResetAt);
  const resetLabel = resetDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="ai-usage-wrap">
      <div className="ai-usage-header">
        <span className="ai-usage-label">AI exports</span>
        <span className={`ai-usage-count ${used >= limit ? "ai-usage-count--exhausted" : ""}`}>
          {used}/{limit}
        </span>
      </div>
      <div className="ai-usage-track">
        <div
          className={`ai-usage-fill ${used >= limit ? "ai-usage-fill--exhausted" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="ai-usage-reset">Resets {resetLabel}</p>
    </div>
  );
}
