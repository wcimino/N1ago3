import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import { storage } from "../../../storage.js";
import { generateEnrichmentSuggestions, type EnrichmentConfig } from "../services/enrichment/index.js";
import { callOpenAIForIntent } from "../services/enrichment/enrichmentOpenAICaller.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import type { IntentWithArticle } from "../storage/knowledgeBaseStorage.js";

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

router.post("/api/ai/enrichment/inline", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { intentId, articleId, currentData } = req.body;

    if (!intentId) {
      return res.status(400).json({ 
        success: false,
        error: "É necessário ter uma intenção associada para enriquecer o artigo." 
      });
    }

    const dbConfig = await storage.getOpenaiApiConfig("enrichment");
    
    if (!dbConfig) {
      return res.status(404).json({ 
        success: false,
        error: "Configuração de enriquecimento não encontrada. Configure os prompts primeiro." 
      });
    }
    
    if (!dbConfig.promptTemplate?.trim() || !dbConfig.promptSystem?.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Prompts de enriquecimento não configurados." 
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

    let intentWithArticle: IntentWithArticle | null = null;

    if (articleId) {
      intentWithArticle = await knowledgeBaseStorage.getIntentWithArticleByArticleId(articleId);
    }

    if (!intentWithArticle) {
      const intents = await knowledgeBaseStorage.getIntentsWithArticles({
        limit: 100,
      });
      intentWithArticle = intents.find(i => i.intent.id === intentId) || null;
    }

    if (!intentWithArticle) {
      return res.status(404).json({
        success: false,
        error: "Intenção não encontrada."
      });
    }

    if (currentData && intentWithArticle) {
      const sanitizeString = (val: any, maxLen: number): string => {
        if (typeof val !== 'string') return '';
        return val.trim().slice(0, maxLen);
      };
      const sanitizeStringArray = (val: any, maxLen: number): string[] => {
        if (!Array.isArray(val)) return [];
        return val.filter(v => typeof v === 'string').map(v => v.trim().slice(0, maxLen)).slice(0, 20);
      };

      const sanitizedData = {
        question: sanitizeString(currentData.question, 5000),
        answer: sanitizeString(currentData.answer, 10000),
        keywords: sanitizeString(currentData.keywords, 1000),
        questionVariation: sanitizeStringArray(currentData.questionVariation, 500),
      };

      const now = new Date();
      intentWithArticle = {
        ...intentWithArticle,
        article: intentWithArticle.article ? {
          ...intentWithArticle.article,
          question: sanitizedData.question || intentWithArticle.article.question,
          answer: sanitizedData.answer || intentWithArticle.article.answer,
          keywords: sanitizedData.keywords || intentWithArticle.article.keywords,
          questionVariation: sanitizedData.questionVariation.length > 0 ? sanitizedData.questionVariation : intentWithArticle.article.questionVariation,
        } : {
          id: articleId || 0,
          question: sanitizedData.question,
          answer: sanitizedData.answer,
          keywords: sanitizedData.keywords,
          questionVariation: sanitizedData.questionVariation,
          productId: null,
          subjectId: null,
          intentId: intentId,
          createdAt: now,
          updatedAt: now,
        }
      };
    }

    if (!intentWithArticle) {
      return res.status(404).json({
        success: false,
        error: "Intenção não encontrada após processamento."
      });
    }

    console.log(`[Enrichment Inline] Processing intent #${intentId} for inline enrichment`);

    const payload = await callOpenAIForIntent(intentWithArticle, config);

    if (!payload.success) {
      return res.json({
        success: false,
        error: payload.error || "Erro ao processar enriquecimento"
      });
    }

    if (payload.action === "skip") {
      return res.json({
        success: true,
        action: "skip",
        skipReason: payload.skipReason || "O artigo já está adequado",
        confidenceScore: payload.confidenceScore
      });
    }

    const normalizeVariations = (variations: any): string[] => {
      if (!variations) return [];
      if (typeof variations === 'string') {
        return variations.split(',').map(v => v.trim()).filter(Boolean);
      }
      if (Array.isArray(variations)) {
        return variations.map(v => String(v).trim()).filter(Boolean);
      }
      return [];
    };

    res.json({
      success: true,
      action: "update",
      suggestion: {
        question: payload.question || "",
        answer: payload.answer || "",
        keywords: payload.keywords || "",
        questionVariation: normalizeVariations(payload.questionVariation),
        updateReason: payload.updateReason || "",
        confidenceScore: payload.confidenceScore ?? null,
        sourceArticles: payload.sourceArticles || []
      }
    });

  } catch (error: any) {
    console.error("[Enrichment Inline] Error:", error.message);
    res.status(500).json({ 
      success: false,
      error: error.message || "Erro ao gerar sugestão de enriquecimento" 
    });
  }
});

export default router;
