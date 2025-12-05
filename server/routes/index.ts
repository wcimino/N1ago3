import type { Express } from "express";
import webhooksRoutes from "./webhooks.js";
import authRoutes from "./auth.js";
import webhookLogsRoutes from "./webhookLogs.js";
import conversationsRoutes from "./conversations.js";
import eventsRoutes from "./events.js";
import configRoutes from "./config.js";

export function registerRoutes(app: Express) {
  app.use(webhooksRoutes);
  app.use(authRoutes);
  app.use(webhookLogsRoutes);
  app.use(conversationsRoutes);
  app.use(eventsRoutes);
  app.use(configRoutes);
}
