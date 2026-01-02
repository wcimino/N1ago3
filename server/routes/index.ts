import type { Express } from "express";

import authRoutes from "../features/auth/routes/auth.js";

import webhooksRoutes from "../features/export/routes/webhooks.js";
import webhookLogsRoutes from "../features/export/routes/webhookLogs.js";
import exportRoutes from "../features/export/routes/export.js";

import eventsRoutes from "../features/events/routes/events.js";
import externalEventSourcesRoutes from "../features/events/routes/externalEventSources.js";
import eventIngestRoutes from "../features/events/routes/eventIngest.js";
import docsDownloadRoutes from "../features/events/routes/docsDownload.js";

import conversationsRoutes from "../features/conversations/routes/conversations.js";

import openaiConfigRoutes from "../features/ai/routes/openaiConfig.js";
import generalSettingsRoutes from "../features/ai/routes/generalSettings.js";
import openaiLogsRoutes from "../features/ai/routes/openaiLogs.js";
import openaiStatsRoutes from "../features/ai/routes/openaiStats.js";

import { zendeskSupportUsersRouter } from "../features/external-sources/zendesk/index.js";

import usersStandardRoutes from "../features/cadastro/routes/usersStandard.js";
import organizationsStandardRoutes from "../features/cadastro/routes/organizationsStandard.js";

import productCatalogRoutes from "../features/products/routes/productCatalog.js";

import routingRulesRoutes from "../features/routing/routes/routing.js";
import transferRoutes from "../features/routing/routes/transfer.js";

import maintenanceRoutes from "../features/maintenance/routes/maintenance.js";

import favoritesRoutes from "../features/favorites/routes/favorites.js";
import reportsRoutes from "../features/reports/routes/reports.js";
import dashboardRoutes from "../features/dashboard/routes/dashboardRoutes.js";

function registerAuthRoutes(app: Express) {
  app.use(authRoutes);
}

function registerExportRoutes(app: Express) {
  app.use(webhooksRoutes);
  app.use(webhookLogsRoutes);
  app.use(exportRoutes);
}

function registerEventsRoutes(app: Express) {
  app.use(eventsRoutes);
  app.use(externalEventSourcesRoutes);
  app.use(eventIngestRoutes);
  app.use(docsDownloadRoutes);
}

function registerConversationsRoutes(app: Express) {
  app.use(conversationsRoutes);
}

function registerAiRoutes(app: Express) {
  app.use(openaiConfigRoutes);
  app.use(generalSettingsRoutes);
  app.use(openaiLogsRoutes);
  app.use(openaiStatsRoutes);
}

function registerExternalSourcesRoutes(app: Express) {
  app.use("/api/external-data/zendesk-users", zendeskSupportUsersRouter);
}

function registerCadastroRoutes(app: Express) {
  app.use("/api/users-standard", usersStandardRoutes);
  app.use("/api/organizations-standard", organizationsStandardRoutes);
}

function registerProductsRoutes(app: Express) {
  app.use(productCatalogRoutes);
}

function registerRoutingRoutes(app: Express) {
  app.use(routingRulesRoutes);
  app.use(transferRoutes);
}

function registerMaintenanceRoutes(app: Express) {
  app.use(maintenanceRoutes);
}

function registerAnalyticsRoutes(app: Express) {
  app.use(favoritesRoutes);
  app.use(reportsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
}

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerExportRoutes(app);
  registerEventsRoutes(app);
  registerConversationsRoutes(app);
  registerAiRoutes(app);
  registerExternalSourcesRoutes(app);
  registerCadastroRoutes(app);
  registerProductsRoutes(app);
  registerRoutingRoutes(app);
  registerMaintenanceRoutes(app);
  registerAnalyticsRoutes(app);
}
