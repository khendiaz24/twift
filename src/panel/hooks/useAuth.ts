// ============================================================
// panel/hooks/useAuth.ts
// Manages UserSession from chrome.storage.local.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type { UserSession, ExtensionMessage } from "../../shared/types";

export interface AuthState {
  session: UserSession | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    isLoading: true,
  });

  // Load persisted session on mount
  useEffect(() => {
    chrome.storage.local.get("twift_session", (result) => {
      const stored = result["twift_session"] as UserSession | undefined;

      if (stored && isSessionValid(stored)) {
        setState({ session: stored, isLoading: false });
      } else {
        // Expired or missing
        chrome.storage.local.remove("twift_session");
        setState({ session: null, isLoading: false });
      }
    });
  }, []);

  // Listen for AUTH_SUCCESS / AUTH_ERROR messages from service worker
  useEffect(() => {
    const handler = (message: ExtensionMessage) => {
      if (message.type === "AUTH_SUCCESS") {
        setState({ session: message.payload, isLoading: false });
      } else if (message.type === "AUTH_ERROR") {
        setState({ session: null, isLoading: false });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const login = useCallback(() => {
    setState((s) => ({ ...s, isLoading: true }));
    chrome.runtime.sendMessage<ExtensionMessage>({ type: "GOOGLE_AUTH_START" });
  }, []);

  const logout = useCallback(() => {
    chrome.storage.local.remove("twift_session");
    chrome.runtime.sendMessage<ExtensionMessage>({ type: "LOGOUT" });
    setState({ session: null, isLoading: false });
  }, []);

  /** Update AI usage count locally after a successful AI export */
  const incrementAiUsage = useCallback(() => {
    setState((prev) => {
      if (!prev.session) return prev;
      const updated: UserSession = {
        ...prev.session,
        aiExportsUsed: prev.session.aiExportsUsed + 1,
      };
      chrome.storage.local.set({ twift_session: updated });
      return { ...prev, session: updated };
    });
  }, []);

  return { ...state, login, logout, incrementAiUsage };
}

function isSessionValid(session: UserSession): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  return session.exp > nowSec;
}
