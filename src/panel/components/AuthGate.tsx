// ============================================================
// panel/components/AuthGate.tsx
// Wraps the app — shows LoginView when no valid session exists.
// ============================================================

import type { ReactNode } from "react";
import type { UserSession } from "../../shared/types";
import { LoginView } from "./LoginView";

interface Props {
  session: UserSession | null;
  isLoading: boolean;
  onLogin: () => void;
  children: ReactNode;
}

export function AuthGate({ session, isLoading, onLogin, children }: Props) {
  // Still reading from storage
  if (isLoading) {
    return (
      <div className="auth-loading">
        <span className="auth-spinner" />
      </div>
    );
  }

  // No session → show login
  if (!session) {
    return <LoginView onLogin={onLogin} isLoading={false} />;
  }

  return <>{children}</>;
}
