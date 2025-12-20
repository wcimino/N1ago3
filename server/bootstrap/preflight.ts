export interface PreflightResult {
  canRunSchedulers: boolean;
  errors: string[];
  warnings: string[];
}

export interface SchedulerConfig {
  enablePolling: boolean;
  enableArchive: boolean;
  enableVacuum: boolean;
}

export function runPreflight(): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("[Preflight] Checking required environment variables...");

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL not set - database connection will fail");
  }

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    errors.push("PRIVATE_OBJECT_DIR not set - archive service requires object storage bucket");
  }

  if (errors.length > 0) {
    console.error("[Preflight] CRITICAL ERRORS:");
    errors.forEach(e => console.error(`  - ${e}`));
  }

  if (warnings.length > 0) {
    console.warn("[Preflight] WARNINGS:");
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  const canRunSchedulers = errors.length === 0;

  if (canRunSchedulers) {
    console.log("[Preflight] All critical checks passed");
  } else {
    console.error("[Preflight] Schedulers will be disabled due to critical errors");
  }

  return { canRunSchedulers, errors, warnings };
}

export function getSchedulerConfig(): SchedulerConfig {
  const disableAll = process.env.DISABLE_SCHEDULERS === "true";

  if (disableAll) {
    return {
      enablePolling: false,
      enableArchive: false,
      enableVacuum: false,
    };
  }

  return {
    enablePolling: process.env.ENABLE_POLLING !== "false",
    enableArchive: process.env.ENABLE_ARCHIVE !== "false",
    enableVacuum: process.env.ENABLE_VACUUM !== "false",
  };
}

let preflightResult: PreflightResult | null = null;
let schedulerConfig: SchedulerConfig | null = null;

export function getPreflightResult(): PreflightResult | null {
  return preflightResult;
}

export function getActiveSchedulerConfig(): SchedulerConfig | null {
  return schedulerConfig;
}

export function initializePreflight(): { preflight: PreflightResult; config: SchedulerConfig } {
  preflightResult = runPreflight();
  schedulerConfig = getSchedulerConfig();
  
  if (!preflightResult.canRunSchedulers) {
    schedulerConfig = {
      enablePolling: false,
      enableArchive: false,
      enableVacuum: false,
    };
  }

  console.log("[Preflight] Scheduler configuration:");
  console.log(`  - Polling: ${schedulerConfig.enablePolling ? "enabled" : "disabled"}`);
  console.log(`  - Archive: ${schedulerConfig.enableArchive ? "enabled" : "disabled"}`);
  console.log(`  - Vacuum: ${schedulerConfig.enableVacuum ? "enabled" : "disabled"}`);

  return { preflight: preflightResult, config: schedulerConfig };
}
