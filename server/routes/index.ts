import type { Express } from "express";
import webhooksRoutes from "../features/events/webhooksRoutes.js";
import authRoutes from "../features/auth/routes.js";
import webhookLogsRoutes from "../features/events/webhookLogsRoutes.js";
import conversationsRoutes from "../features/conversations/routes.js";
import eventsRoutes from "../features/events/routes.js";
import openaiConfigRoutes from "../features/ai/routes.js";
import openaiLogsRoutes from "../features/ai/logsRoutes.js";
import productsRoutes from "../features/products/routes.js";
import usersStandardRoutes from "../features/users/routes.js";
import organizationsStandardRoutes from "../features/organizations/routes.js";
import maintenanceRoutes from "../features/maintenance/routes.js";
import exportRoutes from "../features/export/routes.js";

export function registerRoutes(app: Express) {
  app.use(webhooksRoutes);
  app.use(authRoutes);
  app.use(webhookLogsRoutes);
  app.use(conversationsRoutes);
  app.use(eventsRoutes);
  app.use(openaiConfigRoutes);
  app.use(openaiLogsRoutes);
  app.use(productsRoutes);
  app.use("/api/users-standard", usersStandardRoutes);
  app.use("/api/organizations-standard", organizationsStandardRoutes);
  app.use(maintenanceRoutes);
  app.use(exportRoutes);
}
