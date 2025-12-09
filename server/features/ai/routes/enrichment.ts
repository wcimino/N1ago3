import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions, EnrichmentConfig } from "../services/enrichmentAgentAdapter.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import { ENRICHMENT_SYSTEM_PROMPT, ENRICHMENT_USER_PROMPT_TEMPLATE, ENRICHMENT_RESPONSE_FORMAT } from "../constants/enrichmentAgentPrompts.js";

const router = Router();

function getDefaultEnrichmentConfig(): EnrichmentConfig {
  return {
    enabled: false,
    promptSystem: ENRICHMENT_SYSTEM_PROMPT,
    promptTemplate: ENRICHMENT_USER_PROMPT_TEMPLATE,
    responseFormat: ENRICHMENT_RESPONSE_FORMAT,
    modelName: "gpt-4o-mini",
    useKnowledgeBaseTool: false,
    useZendeskKnowledgeBaseTool: true,
  };
}

router.post("/api/ai/enrichment/generate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, subproduct, limit = 3 } = req.body;

    const dbConfig = await storage.getOpenaiApiConfig("enrichment");
    
    // Use database config if exists, otherwise use default config
    // This allows manual execution even before the config is saved to database
    const config: EnrichmentConfig = dbConfig ? {
      enabled: dbConfig.enabled,
      promptSystem: dbConfig.promptSystem || ENRICHMENT_SYSTEM_PROMPT,
      promptTemplate: dbConfig.promptTemplate || ENRICHMENT_USER_PROMPT_TEMPLATE,
      responseFormat: dbConfig.responseFormat || ENRICHMENT_RESPONSE_FORMAT,
      modelName: dbConfig.modelName || "gpt-4o-mini",
      useKnowledgeBaseTool: dbConfig.useKnowledgeBaseTool || false,
      useZendeskKnowledgeBaseTool: dbConfig.useZendeskKnowledgeBaseTool ?? true,
    } : getDefaultEnrichmentConfig();
    
    // Note: Manual execution works even if config.enabled is false
    // The enabled flag controls automatic triggers only

    const articles = await knowledgeBaseStorage.getAllArticles({
      productStandard: product,
      subproductStandard: subproduct,
      limit: Math.min(limit, 50),
    });

    if (articles.length === 0) {
      return res.json({
        success: true,
        suggestionsGenerated: 0,
        suggestions: [],
        message: "Nenhum artigo encontrado na base local com os filtros aplicados."
      });
    }

    console.log(`[Enrichment] Processing ${articles.length} articles from local KB`);

    const result = await generateEnrichmentSuggestions({
      articles,
      config
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Enrichment] Error generating suggestions:", error.message);
    res.status(500).json({ error: "Failed to generate enrichment suggestions" });
  }
});

export default router;
