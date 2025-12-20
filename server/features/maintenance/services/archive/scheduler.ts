const ARCHIVE_HOUR_UTC = 5;

export interface SchedulerConfig {
  hourUTC: number;
  onRun: () => Promise<void>;
}

export class ArchiveScheduler {
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private lastRunDate: string | null = null;
  private config: SchedulerConfig;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      hourUTC: config.hourUTC ?? ARCHIVE_HOUR_UTC,
      onRun: config.onRun ?? (async () => {}),
    };
  }

  start(): void {
    console.log(`[ArchiveScheduler] Starting scheduler for daily archive at ${this.config.hourUTC}:00 UTC`);
    this.scheduleNextRun();
  }

  stop(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    console.log("[ArchiveScheduler] Scheduler stopped");
  }

  getStatus(): { lastRunDate: string | null; nextRunHourUTC: number } {
    return {
      lastRunDate: this.lastRunDate,
      nextRunHourUTC: this.config.hourUTC,
    };
  }

  setLastRunDate(date: string): void {
    this.lastRunDate = date;
  }

  getLastRunDate(): string | null {
    return this.lastRunDate;
  }

  private scheduleNextRun(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(this.config.hourUTC, 0, 0, 0);

    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();
    const hoursUntilNextRun = (msUntilNextRun / (1000 * 60 * 60)).toFixed(1);

    console.log(`[ArchiveScheduler] Next archive scheduled for ${nextRun.toISOString()} (in ${hoursUntilNextRun} hours)`);

    this.scheduledTimeout = setTimeout(() => {
      this.runScheduledArchive();
    }, msUntilNextRun);
  }

  private async runScheduledArchive(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    if (this.lastRunDate === today) {
      console.log(`[ArchiveScheduler] Archive already ran today (${today}), skipping`);
      this.scheduleNextRun();
      return;
    }

    console.log(`[ArchiveScheduler] Starting scheduled archive at ${new Date().toISOString()}`);

    try {
      await this.config.onRun();
      this.lastRunDate = today;
      console.log(`[ArchiveScheduler] Scheduled archive completed at ${new Date().toISOString()}`);
    } catch (err: any) {
      console.error("[ArchiveScheduler] Scheduled archive failed:", err.message);
    } finally {
      this.scheduleNextRun();
    }
  }
}
