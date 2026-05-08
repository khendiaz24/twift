// ============================================================
// content/index.ts
//
// Content script entry point.
// Listens for TRIGGER_SCAN messages from the background service
// worker and streams progress back, then posts the full result.
// ============================================================

import type { ExtensionMessage, ScanPhase } from "../shared/types";
import { scanPage } from "./scanner";

// Guard against duplicate injection when executeScript is called multiple times.
// Each call would otherwise register an extra listener in the same content world.
if (!(globalThis as unknown as Record<string, boolean>)["__twiftRegistered"]) {
  (globalThis as unknown as Record<string, boolean>)["__twiftRegistered"] =
    true;

  let scanInProgress = false;

  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type !== "TRIGGER_SCAN") return false;

      if (scanInProgress) {
        sendResponse({ ok: false, reason: "scan-in-progress" });
        return false;
      }

      // We need to keep the message channel open for async work,
      // so we return true and call sendResponse ourselves.
      (async () => {
        scanInProgress = true;
        try {
          const result = await scanPage(
            (phase: ScanPhase, progress: number) => {
              // Fire-and-forget progress events to the panel via background
              chrome.runtime.sendMessage<ExtensionMessage>({
                type: "SCAN_PROGRESS",
                payload: { phase, progress },
              });
            },
          );

          chrome.runtime.sendMessage<ExtensionMessage>({
            type: "SCAN_COMPLETE",
            payload: result,
          });

          sendResponse({ ok: true });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown scan error";
          chrome.runtime.sendMessage<ExtensionMessage>({
            type: "SCAN_ERROR",
            payload: { message },
          });
          sendResponse({ ok: false, reason: message });
        } finally {
          scanInProgress = false;
        }
      })();

      return true; // keep channel open for async sendResponse
    },
  );
} // end __twiftRegistered guard
