import type { Express } from "express";

import authRoutes from "../features/auth/routes/auth.js";
import { conversationsRoutes } from "../features/conversations/routes/index.js";
import productsRoutes from "../features/products/routes/products.js";
import productCatalogRoutes from "../features/products/routes/productCatalog.js";

import webhooksRoutes from "../features/export/routes/webhooks.js";
import webhookLogsRoutes from "../features/export/routes/webhookLogs.js";
import exportRoutes from "../features/export/routes/export.js";

import eventsRoutes from "../features/events/routes/events.js";

import usersStandardRoutes from "../features/cadastro/routes/usersStandard.js";
import organizationsStandardRoutes from "../features/cadastro/routes/organizationsStandard.js";

import openaiConfigRoutes from "../features/ai/routes/openaiConfig.js";
import generalSettingsRoutes from "../features/ai/routes/generalSettings.js";
import openaiLogsRoutes from "../features/ai/routes/openaiLogs.js";
import openaiStatsRoutes from "../features/ai/routes/openaiStats.js";
import knowledgeBaseRoutes from "../features/ai/routes/knowledgeBase.js";
import knowledgeSuggestionsRoutes from "../features/ai/routes/knowledgeSuggestions.js";
import learningAttemptsRoutes from "../features/ai/routes/learningAttempts.js";
import knowledgeSubjectsRoutes from "../features/knowledge/routes/knowledgeSubjectsRoutes.js";
import knowledgeIntentsRoutes from "../features/knowledge/routes/knowledgeIntentsRoutes.js";

import maintenanceRoutes from "../features/maintenance/routes/maintenance.js";
import { zendeskArticlesRouter } from "../features/zendesk-articles/index.js";
import routingRulesRoutes from "../features/routing/routes/routing.js";
import transferRoutes from "../features/routing/routes/transfer.js";
import favoritesRoutes from "../features/favorites/routes/favorites.js";

export function registerRoutes(app: Express) {
  app.use(webhooksRoutes);
  app.use(authRoutes);
  app.use(webhookLogsRoutes);
  app.use(conversationsRoutes);
  app.use(eventsRoutes);
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
  app.use(knowledgeSubjectsRoutes);
  app.use(knowledgeIntentsRoutes);
  app.use("/api/zendesk-articles", zendeskArticlesRouter);
  app.use(routingRulesRoutes);
  app.use(transferRoutes);
  app.use(favoritesRoutes);
}
