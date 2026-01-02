import { processPendingRaws } from "../../events/services/eventProcessor.js";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const POLLING_INTERVAL_MS = 10000;
const MAX_RETRIES = 5;

export function startPollingWorker(intervalMs: number = POLLING_INTERVAL_MS) {
  if (isRunning) {
    console.log("[PollingWorker] Already running");
    return;
  }

  isRunning = true;
  console.log(`[PollingWorker] Starting with ${intervalMs}ms interval`);

  intervalId = setInterval(async () => {
    try {
      const processed = await processPendingRaws();
      if (processed > 0) {
        console.log(`[PollingWorker] Processed ${processed} pending events`);
      }
    } catch (error) {
      console.error("[PollingWorker] Error:", error);
    }
  }, intervalMs);
}

export function stopPollingWorker() {
  if (!isRunning || !intervalId) {
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
  isRunning = false;
  console.log("[PollingWorker] Stopped");
}

export function isPollingWorkerRunning(): boolean {
  return isRunning;
}
