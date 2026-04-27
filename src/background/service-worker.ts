// ============================================================
// background/service-worker.ts
//
// Manages the extension lifecycle:
//  - Opens the side panel when the toolbar icon is clicked
//  - Injects the content script into the active tab
//  - Relays messages between content script ↔ side panel
//  - Handles Google OAuth flow via chrome.identity
// ============================================================

import type { ExtensionMessage, UserSession } from "../shared/types";

const SERVER_URL = "http://localhost:3000";

// ------------------------------------------------------------------
// Side panel: open on action click
// ------------------------------------------------------------------

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ------------------------------------------------------------------
// Relay: content script → panel (and vice-versa)
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender) => {
    const isFromContent = !!sender.tab;

    if (isFromContent) {
      chrome.runtime.sendMessage(message).catch(() => {
        // Panel may not be open yet — fine
      });
    }

    return false;
  }
);

// ------------------------------------------------------------------
// Main message router
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  async (message: ExtensionMessage) => {
    // ── Scan trigger ────────────────────────────────────────────
    if (message.type === "TRIGGER_SCAN") {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;

      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["src/content/index.js"],
        })
        .catch(() => {
          // Already injected — ignore
        });

      chrome.tabs.sendMessage<ExtensionMessage>(tab.id, {
        type: "TRIGGER_SCAN",
      });
      return;
    }

    // ── Google OAuth ────────────────────────────────────────────
    if (message.type === "GOOGLE_AUTH_START") {
      await handleGoogleAuth();
      return;
    }

    // ── Logout ──────────────────────────────────────────────────
    if (message.type === "LOGOUT") {
      await chrome.storage.local.remove("twift_session");
      return;
    }
  }
);

// ------------------------------------------------------------------
// Google OAuth via chrome.identity.launchWebAuthFlow
// ------------------------------------------------------------------

async function handleGoogleAuth(): Promise<void> {
  try {
    const clientId = await getGoogleClientId();
    const redirectUri = chrome.identity.getRedirectURL();

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    if (!responseUrl) throw new Error("OAuth flow cancelled");

    // Extract access_token from the fragment
    const fragment = new URL(responseUrl).hash.slice(1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    if (!accessToken) throw new Error("No access_token in response");

    // Exchange with our server for a Twift JWT
    const res = await fetch(`${SERVER_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? "Server auth failed");
    }

    const data = (await res.json()) as {
      token: string;
      email: string;
      name: string;
      picture: string;
      tier: "free" | "pro";
      aiExportsUsed: number;
      aiExportsResetAt: string;
      exp: number;
    };

    const session: UserSession = {
      token: data.token,
      email: data.email,
      name: data.name,
      picture: data.picture,
      tier: data.tier,
      aiExportsUsed: data.aiExportsUsed,
      aiExportsResetAt: data.aiExportsResetAt,
      exp: data.exp,
    };

    // Persist session
    await chrome.storage.local.set({ twift_session: session });

    // Notify panel
    chrome.runtime.sendMessage<ExtensionMessage>({
      type: "AUTH_SUCCESS",
      payload: session,
    }).catch(() => {});
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    console.error("[service-worker] Google auth error:", message);
    chrome.runtime.sendMessage<ExtensionMessage>({
      type: "AUTH_ERROR",
      payload: { message },
    }).catch(() => {});
  }
}

async function getGoogleClientId(): Promise<string> {
  const manifest = chrome.runtime.getManifest() as chrome.runtime.Manifest & {
    oauth2?: { client_id?: string };
  };
  const clientId = manifest.oauth2?.client_id;
  if (!clientId || clientId === "__GOOGLE_CLIENT_ID__") {
    throw new Error(
      "Google Client ID not configured. Set it in manifest.json oauth2.client_id"
    );
  }
  return clientId;
}
