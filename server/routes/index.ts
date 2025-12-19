import type { Express } from "express";

import authRoutes from "../features/auth/routes/auth.js";
import { conversationsRoutes } from "../features/conversations/routes/index.js";
import productsRoutes from "../features/products/routes/products.js";
import productCatalogRoutes from "../features/products/routes/productCatalog.js";

import webhooksRoutes from "../features/export/routes/webhooks.js";
import webhookLogsRoutes from "../features/export/routes/webhookLogs.js";
import exportRoutes from "../features/export/routes/export.js";

import eventsRoutes from "../features/events/routes/events.js";
import externalEventSourcesRoutes from "../features/events/routes/externalEventSources.js";
import eventIngestRoutes from "../features/events/routes/eventIngest.js";
import docsDownloadRoutes from "../features/events/routes/docsDownload.js";

import usersStandardRoutes from "../features/cadastro/routes/usersStandard.js";
import organizationsStandardRoutes from "../features/cadastro/routes/organizationsStandard.js";

import openaiConfigRoutes from "../features/ai/routes/openaiConfig.js";
import generalSettingsRoutes from "../features/ai/routes/generalSettings.js";
import openaiLogsRoutes from "../features/ai/routes/openaiLogs.js";
import openaiStatsRoutes from "../features/ai/routes/openaiStats.js";
import knowledgeBaseRoutes from "../features/ai/routes/knowledgeBase.js";
import knowledgeSuggestionsRoutes from "../features/ai/routes/knowledgeSuggestions.js";
import learningAttemptsRoutes from "../features/ai/routes/learningAttempts.js";
import enrichmentRoutes from "../features/ai/routes/enrichment.js";
import enrichmentLogsRoutes from "../features/ai/routes/enrichmentLogs.js";
import articleEnrichmentRoutes from "../features/ai/routes/articleEnrichment.js";
import articleEnrichmentLogsRoutes from "../features/ai/routes/articleEnrichmentLogs.js";
import knowledgeSubjectsRoutes from "../features/knowledge/routes/knowledgeSubjectsRoutes.js";
import knowledgeIntentsRoutes from "../features/knowledge/routes/knowledgeIntentsRoutes.js";
import objectiveProblemsRoutes from "../features/knowledge/routes/objectiveProblemsRoutes.js";
import actionsRoutes from "../features/knowledge/routes/actionsRoutes.js";
import knowledgeSolutionsRoutes from "../features/knowledge/routes/knowledgeSolutionsRoutes.js";
import rootCausesRoutes from "../features/knowledge/routes/rootCausesRoutes.js";

import maintenanceRoutes from "../features/maintenance/routes/maintenance.js";
import { zendeskArticlesRouter, zendeskSupportUsersRouter } from "../features/external-sources/zendesk/index.js";
import routingRulesRoutes from "../features/routing/routes/routing.js";
import transferRoutes from "../features/routing/routes/transfer.js";
import favoritesRoutes from "../features/favorites/routes/favorites.js";
import reportsRoutes from "../features/reports/routes/reports.js";
import dashboardRoutes from "../features/dashboard/routes/dashboardRoutes.js";
import queryMonitoringRoutes from "../features/monitoring/routes/queryMonitoringRoutes.js";

export function registerRoutes(app: Express) {
  app.use(webhooksRoutes);
  app.use(authRoutes);
  app.use(webhookLogsRoutes);
  app.use(conversationsRoutes);
  app.use(eventsRoutes);
  app.use(externalEventSourcesRoutes);
  app.use(eventIngestRoutes);
  app.use(docsDownloadRoutes);
  app.use(openaiConfigRoutes);
  app.use(generalSettingsRoutes);
  app.use(openaiLogsRoutes);
  app.use(openaiStatsRoutes);
  app.use(productsRoutes);
  app.use(productCatalogRoutes);
  app.use("/api/users-standard", usersStandardRoutes);
  app.use("/api/organizations-standard", organizationsStandardRoutes);
  app.use(maintenanceRoutes);
  app.use(exportRoutes);
  app.use(knowledgeBaseRoutes);
  app.use(knowledgeSuggestionsRoutes);
  app.use(learningAttemptsRoutes);
  app.use(enrichmentRoutes);
  app.use(enrichmentLogsRoutes);
  app.use(articleEnrichmentRoutes);
  app.use(articleEnrichmentLogsRoutes);
  app.use(knowledgeSubjectsRoutes);
  app.use(knowledgeIntentsRoutes);
  app.use(objectiveProblemsRoutes);
  app.use(actionsRoutes);
  app.use(knowledgeSolutionsRoutes);
  app.use(rootCausesRoutes);
  app.use("/api/zendesk-articles", zendeskArticlesRouter);
  app.use("/api/external-data/zendesk-users", zendeskSupportUsersRouter);
  app.use(routingRulesRoutes);
  app.use(transferRoutes);
  app.use(favoritesRoutes);
  app.use(reportsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/monitoring/queries", queryMonitoringRoutes);
}
