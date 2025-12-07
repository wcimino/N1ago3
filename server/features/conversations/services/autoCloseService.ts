import { conversationCrud } from "../storage/conversationCrud.js";
import { CONVERSATION_RULES } from "../../../config/conversationRules.js";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let autoCloseEnabled = CONVERSATION_RULES.AUTO_CLOSE_ENABLED;

const AUTO_CLOSE_INTERVAL_MS = 60000;

export const autoCloseService = {
  start() {
    if (isRunning) {
      console.log("Auto-close worker already running");
      return;
    }

    isRunning = true;
    console.log(`Starting auto-close worker with ${AUTO_CLOSE_INTERVAL_MS}ms interval`);

    intervalId = setInterval(async () => {
      if (!autoCloseEnabled) return;

      try {
        const closed = await conversationCrud.closeInactiveConversations(50);
        if (closed.length > 0) {
          console.log(`Auto-close worker closed ${closed.length} inactive conversations`);
        }
      } catch (error) {
        console.error("Auto-close worker error:", error);
      }
    }, AUTO_CLOSE_INTERVAL_MS);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
    autoCloseEnabled = false;
    console.log("Auto-close worker stopped");
  },

  isRunning(): boolean {
    return isRunning && autoCloseEnabled;
  },

  enable() {
    autoCloseEnabled = true;
    if (!isRunning) {
      this.start();
    }
    console.log("Auto-close enabled");
  },

  disable() {
    this.stop();
    console.log("Auto-close disabled and worker stopped");
  },

  async closeManual(limit: number) {
    const closed = await conversationCrud.closeInactiveConversationsManual(limit);
    console.log(`Manual close: ${closed.length} conversations closed`);
    return closed;
  },

  async getStatus() {
    const inactiveCount = await conversationCrud.countInactiveConversations();
    return {
      enabled: autoCloseEnabled,
      workerRunning: isRunning,
      inactiveConversationsCount: inactiveCount,
      inactivityTimeoutMinutes: CONVERSATION_RULES.INACTIVITY_TIMEOUT_MINUTES,
    };
  },
};
