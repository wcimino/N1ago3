import { processPendingRaws } from "../features/events/services/eventProcessor.js";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const POLLING_INTERVAL_MS = 10000;
const MAX_RETRIES = 5;

export function startPollingWorker(intervalMs: number = POLLING_INTERVAL_MS) {
  if (isRunning) {
    console.log("Polling worker already running");
    return;
  }

  isRunning = true;
  console.log(`Starting polling worker with ${intervalMs}ms interval`);

  intervalId = setInterval(async () => {
    try {
      const processed = await processPendingRaws();
      if (processed > 0) {
        console.log(`Polling worker processed ${processed} pending events`);
      }
    } catch (error) {
      console.error("Polling worker error:", error);
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
  console.log("Polling worker stopped");
}

export function isPollingWorkerRunning(): boolean {
  return isRunning;
}
