import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Express } from "express";
import express from "express";
import { startPollingWorker, isPollingWorkerRunning } from "../features/sync/services/pollingWorker.js";
import { vacuumService, archiveService } from "../features/maintenance/services/index.js";
import { initializePreflight, getPreflightResult, getActiveSchedulerConfig, type PreflightResult, type SchedulerConfig } from "./preflight.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BootstrapConfig {
  enableSchedulers: boolean;
  isProduction: boolean;
}

export interface SchedulerStatus {
  polling: { enabled: boolean; running: boolean };
  archive: { enabled: boolean; running: boolean; lastRunDate: string | null };
  vacuum: { enabled: boolean; running: boolean; lastRunDate: string | null };
}

let schedulerStatus: SchedulerStatus = {
  polling: { enabled: false, running: false },
  archive: { enabled: false, running: false, lastRunDate: null },
  vacuum: { enabled: false, running: false, lastRunDate: null },
};

export function getSchedulerStatus(): SchedulerStatus {
  const archiveStatus = archiveService.getSchedulerStatus();
  const vacuumStatus = vacuumService.getStatus();

  return {
    polling: {
      enabled: schedulerStatus.polling.enabled,
      running: isPollingWorkerRunning(),
    },
    archive: {
      enabled: schedulerStatus.archive.enabled,
      running: archiveStatus.isRunning,
      lastRunDate: archiveStatus.lastRunDate,
    },
    vacuum: {
      enabled: schedulerStatus.vacuum.enabled,
      running: vacuumStatus.isRunning,
      lastRunDate: vacuumStatus.lastRunDate,
    },
  };
}

export function getBootstrapHealth(): {
  preflight: PreflightResult | null;
  schedulerConfig: SchedulerConfig | null;
  schedulerStatus: SchedulerStatus;
} {
  return {
    preflight: getPreflightResult(),
    schedulerConfig: getActiveSchedulerConfig(),
    schedulerStatus: getSchedulerStatus(),
  };
}

export function configureStaticFiles(app: Express): void {
  const publicPath = path.resolve(__dirname, "public");
  const indexPath = path.join(publicPath, "index.html");
  console.log(`[Bootstrap] Looking for static files at: ${publicPath}`);
  
  const isApiRoute = (path: string) => 
    path.startsWith("/api") || 
    path.startsWith("/webhook") || 
    path === "/health" || 
    path === "/ready";

  if (!fs.existsSync(indexPath)) {
    console.warn("[Bootstrap] WARNING: dist/public/index.html not found - frontend build may be missing");
    app.get("*", (req, res, next) => {
      if (isApiRoute(req.path)) {
        return next();
      }
      res.status(503).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Build Missing</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Frontend Build Missing</h1>
          <p>The application frontend has not been built yet.</p>
          <p>Run <code>npm run build</code> to generate the frontend files.</p>
        </body>
        </html>
      `);
    });
    return;
  }
  
  app.use(express.static(publicPath, {
    maxAge: "1d",
    etag: true,
  }));
  
  app.get("*", (req, res, next) => {
    if (isApiRoute(req.path)) {
      return next();
    }
    res.sendFile(indexPath);
  });
  
  console.log(`[Bootstrap] Static files configured from: ${publicPath}`);
}

export async function startBackgroundWorkers(config: SchedulerConfig): Promise<void> {
  console.log("[Bootstrap] Starting background workers...");

  if (config.enablePolling) {
    startPollingWorker();
    schedulerStatus.polling = { enabled: true, running: true };
    console.log("[Bootstrap] Polling worker started");
  } else {
    console.log("[Bootstrap] Polling worker disabled");
  }

  if (config.enableVacuum) {
    vacuumService.start();
    schedulerStatus.vacuum = { enabled: true, running: false, lastRunDate: null };
    console.log("[Bootstrap] Vacuum service started");
  } else {
    console.log("[Bootstrap] Vacuum service disabled");
  }

  if (config.enableArchive) {
    await archiveService.start();
    schedulerStatus.archive = { enabled: true, running: false, lastRunDate: null };
    console.log("[Bootstrap] Archive service started");
  } else {
    console.log("[Bootstrap] Archive service disabled");
  }

  console.log("[Bootstrap] Background workers initialization complete");
}

export async function bootstrap(app: Express, config: BootstrapConfig): Promise<void> {
  if (config.isProduction) {
    configureStaticFiles(app);
  }

  if (config.enableSchedulers) {
    const { preflight, config: schedulerConfig } = initializePreflight();
    
    if (preflight.canRunSchedulers) {
      await startBackgroundWorkers(schedulerConfig);
    } else {
      console.warn("[Bootstrap] Schedulers disabled due to preflight failures - running in API-only mode");
    }
  } else {
    console.log("[Bootstrap] Schedulers disabled via DISABLE_SCHEDULERS env var");
  }
}
