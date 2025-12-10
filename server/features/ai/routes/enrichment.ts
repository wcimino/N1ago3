import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions, type EnrichmentConfig } from "../services/enrichment/index.js";
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
    const { product, subproduct, limit = 3, articleId } = req.body;

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

    let intentsWithArticles;

    if (articleId) {
      const intentWithArticle = await knowledgeBaseStorage.getIntentWithArticleByArticleId(articleId);
      
      if (!intentWithArticle) {
        return res.json({
          success: false,
          error: "Artigo não encontrado ou não possui intenção associada. Associe uma intenção ao artigo primeiro."
        });
      }
      
      intentsWithArticles = [intentWithArticle];
      console.log(`[Enrichment] Processing single article #${articleId} for improvement`);
    } else {
      intentsWithArticles = await knowledgeBaseStorage.getIntentsWithArticles({
        product,
        subproduct,
        limit: Math.min(limit, 50),
      });

      if (intentsWithArticles.length === 0) {
        return res.json({
          success: true,
          intentsProcessed: 0,
          articlesCreated: 0,
          articlesUpdated: 0,
          suggestionsGenerated: 0,
          skipped: 0,
          suggestions: [],
          message: "Nenhuma intenção encontrada com os filtros aplicados. Cadastre intenções primeiro na aba 'Assuntos e Intenções'."
        });
      }

      console.log(`[Enrichment] Processing ${intentsWithArticles.length} intents (with/without articles)`);
    }

    const result = await generateEnrichmentSuggestions({
      intentsWithArticles,
      config
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Enrichment] Error generating suggestions:", error.message);
    res.status(500).json({ error: "Failed to generate enrichment suggestions" });
  }
});

export default router;
