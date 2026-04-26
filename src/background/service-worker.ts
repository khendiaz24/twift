// ============================================================
// background/service-worker.ts
//
// Manages the extension lifecycle:
//  - Opens the side panel when the toolbar icon is clicked
//  - Injects the content script into the active tab
//  - Relays messages between content script ↔ side panel
// ============================================================

import type { ExtensionMessage } from "../shared/types";

// ------------------------------------------------------------------
// Side panel: open on action click
// ------------------------------------------------------------------

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ------------------------------------------------------------------
// Relay: content script → panel (and vice-versa)
// The background acts as a router because content scripts and the
// side panel cannot communicate directly.
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender) => {
    const isFromContent = !!sender.tab;

    if (isFromContent) {
      // Forward content-script events to all extension contexts (the panel)
      chrome.runtime.sendMessage(message).catch(() => {
        // Panel may not be open yet — that is fine
      });
    }

    // Allow synchronous callers to get a response
    return false;
  }
);

// ------------------------------------------------------------------
// When the panel requests a scan, inject content script + trigger
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  async (message: ExtensionMessage) => {
    if (message.type !== "TRIGGER_SCAN") return;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    // Ensure the content script is injected (idempotent in MV3)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/index.js"],
    }).catch(() => {
      // Already injected — ignore
    });

    // Tell the content script to start scanning
    chrome.tabs.sendMessage<ExtensionMessage>(tab.id, {
      type: "TRIGGER_SCAN",
    });
  }
);
