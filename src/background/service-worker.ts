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
// Single message router: relay content → panel, and handle TRIGGER_SCAN
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  const isFromContent = !!sender.tab;

  if (isFromContent) {
    // Forward content-script events to all extension contexts (the panel)
    chrome.runtime.sendMessage(message).catch(() => {
      // Panel may not be open yet — that is fine
    });
    return false;
  }

  if (message.type === "TRIGGER_SCAN") {
    handleTriggerScan();
  }

  return false;
});

// ------------------------------------------------------------------
// Inject the content script and send TRIGGER_SCAN to it
// ------------------------------------------------------------------

function handleTriggerScan(): void {
  (async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      reportScanError("No active tab found.");
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/index.js"],
      });
    } catch (err) {
      reportScanError(
        `Could not inject into this page: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    chrome.tabs
      .sendMessage<ExtensionMessage>(tab.id, { type: "TRIGGER_SCAN" })
      .catch((err: unknown) => {
        reportScanError(
          `Could not reach content script: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  })();
}

function reportScanError(message: string): void {
  chrome.runtime
    .sendMessage<ExtensionMessage>({ type: "SCAN_ERROR", payload: { message } })
    .catch(() => {});
}
