import { db } from "../../../db.js";
import { sql } from "drizzle-orm";

const VACUUM_HOUR_UTC = 6;
const TABLES_TO_VACUUM = [
  "zendesk_conversations_webhook_raw",
  "openai_api_logs",
  "events_standard",
];

class VacuumService {
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastRunDate: string | null = null;

  start(): void {
    console.log(`[VacuumService] Starting scheduler for daily VACUUM FULL at ${VACUUM_HOUR_UTC}:00 UTC`);
    this.scheduleNextRun();
  }

  stop(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    console.log("[VacuumService] Scheduler stopped");
  }

  private scheduleNextRun(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(VACUUM_HOUR_UTC, 0, 0, 0);

    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();
    const hoursUntilNextRun = (msUntilNextRun / (1000 * 60 * 60)).toFixed(1);

    console.log(`[VacuumService] Next VACUUM FULL scheduled for ${nextRun.toISOString()} (in ${hoursUntilNextRun} hours)`);

    this.scheduledTimeout = setTimeout(() => {
      this.runVacuumFull();
    }, msUntilNextRun);
  }

  async runVacuumFull(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    if (this.lastRunDate === today) {
      console.log(`[VacuumService] VACUUM FULL already ran today (${today}), skipping`);
      this.scheduleNextRun();
      return;
    }

    if (this.isRunning) {
      console.log("[VacuumService] VACUUM FULL already running, skipping");
      this.scheduleNextRun();
      return;
    }

    this.isRunning = true;
    console.log(`[VacuumService] Starting daily VACUUM FULL at ${new Date().toISOString()}`);

    for (const tableName of TABLES_TO_VACUUM) {
      try {
        const startTime = Date.now();
        console.log(`[VacuumService] Running VACUUM FULL on ${tableName}...`);
        
        await db.execute(sql.raw(`VACUUM FULL ${tableName}`));
        
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[VacuumService] VACUUM FULL completed on ${tableName} in ${durationSec}s`);
      } catch (err: any) {
        console.error(`[VacuumService] VACUUM FULL failed on ${tableName}:`, err.message);
      }
    }

    this.lastRunDate = today;
    this.isRunning = false;
    console.log(`[VacuumService] Daily VACUUM FULL completed at ${new Date().toISOString()}`);

    this.scheduleNextRun();
  }

  getStatus(): { isRunning: boolean; lastRunDate: string | null; nextRunHourUTC: number } {
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      nextRunHourUTC: VACUUM_HOUR_UTC,
    };
  }

  async runManualVacuumFull(): Promise<{ message: string }> {
    if (this.isRunning) {
      return { message: "VACUUM FULL já está em execução" };
    }

    this.runVacuumFull().catch(console.error);
    return { message: "VACUUM FULL iniciado manualmente" };
  }
}

export const vacuumService = new VacuumService();
