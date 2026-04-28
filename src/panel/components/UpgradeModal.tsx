// ============================================================
// panel/components/UpgradeModal.tsx
// Inline modal shown when a free user tries to use AI labelling.
// ============================================================

import { useState } from "react";
import type { UserSession } from "../../shared/types";
import { SERVER_URL, PRO_PRICE_DISPLAY } from "../../shared/config";

interface Props {
  session: UserSession;
  onClose: () => void;
}

export function UpgradeModal({ session, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/lemonsqueezy/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to create checkout session");
      }

      // Open Stripe Checkout in a new tab
      chrome.tabs.create({ url: data.url });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-pro-icon">★</div>
          <h2 className="modal-title">Upgrade to Pro</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="modal-sub">
          You've used all 3 free AI exports this month.
          <br />
          Upgrade for <strong>unlimited AI labelling</strong>.
        </p>

        {/* Feature comparison */}
        <div className="modal-features">
          <div className="modal-tier modal-tier--free">
            <div className="modal-tier-name">Free</div>
            <ul>
              <li>✓ Unlimited heuristic scans</li>
              <li>✓ Copy CSS &amp; JSON export</li>
              <li>✓ 3 AI exports / month</li>
              <li className="feat-missing">✗ Unlimited AI labels</li>
              <li className="feat-missing">✗ Scan history</li>
            </ul>
          </div>
          <div className="modal-tier modal-tier--pro">
            <div className="modal-tier-name">
              Pro <span className="modal-price">{PRO_PRICE_DISPLAY}</span>
            </div>
            <ul>
              <li>✓ Everything in Free</li>
              <li>
                ✓ <strong>Unlimited AI labels</strong>
              </li>
              <li>✓ Scan history (last 20)</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </div>

        {error && <p className="modal-error">⚠ {error}</p>}

        <button
          id="upgrade-btn"
          className="modal-cta"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? <span className="login-spinner" /> : "★"}
          {loading ? "Redirecting…" : `Upgrade to Pro — ${PRO_PRICE_DISPLAY}`}
        </button>

        <p className="modal-guarantee">
          Cancel any time. Billed monthly via Stripe.
        </p>
      </div>
    </div>
  );
}
