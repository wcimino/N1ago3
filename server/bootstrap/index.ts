import path from "path";
import type { Express } from "express";
import express from "express";
import { startPollingWorker } from "../features/sync/services/pollingWorker.js";
import { vacuumService, archiveService } from "../features/maintenance/services/index.js";

export interface BootstrapConfig {
  enableSchedulers: boolean;
  isProduction: boolean;
}

export function configureStaticFiles(app: Express): void {
  const publicPath = path.join(process.cwd(), "dist", "public");
  app.use(express.static(publicPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
  console.log("[Bootstrap] Static files configured");
}

export function startBackgroundWorkers(): void {
  console.log("[Bootstrap] Starting background workers...");
  startPollingWorker();
  vacuumService.start();
  archiveService.start();
  console.log("[Bootstrap] Background workers started");
}

export function bootstrap(app: Express, config: BootstrapConfig): void {
  if (config.isProduction) {
    configureStaticFiles(app);
  }

  if (config.enableSchedulers) {
    startBackgroundWorkers();
  } else {
    console.log("[Bootstrap] Schedulers disabled via DISABLE_SCHEDULERS env var");
  }
}
