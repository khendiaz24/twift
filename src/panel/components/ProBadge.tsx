// ============================================================
// panel/components/ProBadge.tsx
// Pill badge shown next to the logo when user is Pro.
// Also shows the user avatar + logout on click.
// ============================================================

import { useState } from "react";
import type { UserSession } from "../../shared/types";

interface Props {
  session: UserSession;
  onLogout: () => void;
}

export function ProBadge({ session, onLogout }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pro-badge-wrap">
      <button
        className={`pro-badge ${session.tier === "pro" ? "pro-badge--pro" : "pro-badge--free"}`}
        onClick={() => setOpen((o) => !o)}
        title={session.email}
      >
        {session.picture ? (
          <img
            className="pro-avatar"
            src={session.picture}
            alt={session.name}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="pro-avatar-fallback">
            {session.email[0]?.toUpperCase()}
          </span>
        )}
        <span className="pro-tier-label">
          {session.tier === "pro" ? "Pro" : "Free"}
        </span>
      </button>

      {open && (
        <div className="pro-dropdown">
          <div className="pro-dropdown-email">{session.email}</div>
          <button className="pro-dropdown-logout" onClick={() => { setOpen(false); onLogout(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
