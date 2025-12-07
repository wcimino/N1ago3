import type { Express } from "express";

import authRoutes from "./auth.js";
import conversationsRoutes from "./conversations.js";
import productsRoutes from "./products.js";

import webhooksRoutes from "../features/export/routes/webhooks.js";
import webhookLogsRoutes from "../features/export/routes/webhookLogs.js";
import exportRoutes from "../features/export/routes/export.js";

import eventsRoutes from "../features/events/routes/events.js";

import usersStandardRoutes from "../features/cadastro/routes/usersStandard.js";
import organizationsStandardRoutes from "../features/cadastro/routes/organizationsStandard.js";

import openaiConfigRoutes from "../features/ai/routes/openaiConfig.js";
import openaiLogsRoutes from "../features/ai/routes/openaiLogs.js";
import knowledgeBaseRoutes from "../features/ai/routes/knowledgeBase.js";

import maintenanceRoutes from "../features/maintenance/routes/maintenance.js";

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
  app.use(knowledgeBaseRoutes);
}
