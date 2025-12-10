import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions, type EnrichmentConfig } from "../services/enrichment/index.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";

const router = Router();

router.post("/api/ai/enrichment/generate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, subproduct, limit = 3, articleId } = req.body;

    const dbConfig = await storage.getOpenaiApiConfig("enrichment");
    
    if (!dbConfig) {
      return res.status(404).json({ 
        error: "Enrichment configuration not found in database. Please configure the enrichment prompts first." 
      });
    }
    
    if (!dbConfig.promptTemplate || !dbConfig.promptTemplate.trim()) {
      return res.status(400).json({ 
        error: "Enrichment prompt template is not configured. Please set the prompt template in the enrichment configuration." 
      });
    }
    
    if (!dbConfig.promptSystem || !dbConfig.promptSystem.trim()) {
      return res.status(400).json({ 
        error: "Enrichment system prompt is not configured. Please set the system prompt in the enrichment configuration." 
      });
    }

    const config: EnrichmentConfig = {
      enabled: dbConfig.enabled,
      promptSystem: dbConfig.promptSystem,
      promptTemplate: dbConfig.promptTemplate,
      responseFormat: dbConfig.responseFormat || null,
      modelName: dbConfig.modelName || "gpt-4o-mini",
      useKnowledgeBaseTool: dbConfig.useKnowledgeBaseTool || false,
      useZendeskKnowledgeBaseTool: dbConfig.useZendeskKnowledgeBaseTool ?? true,
    };

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
    res.status(500).json({ error: error.message || "Failed to generate enrichment suggestions" });
  }
});

export default router;
