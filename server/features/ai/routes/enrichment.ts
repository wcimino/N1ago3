import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions } from "../services/enrichmentAgentAdapter.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";

const router = Router();

router.post("/api/ai/enrichment/generate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, subproduct, limit = 3 } = req.body;

    const config = await storage.getOpenaiApiConfig("enrichment");
    if (!config || !config.enabled) {
      return res.status(400).json({ 
        error: "Enrichment is not enabled. Please configure it in the AI settings." 
      });
    }

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
