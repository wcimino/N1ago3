import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import { storage } from "../../../storage.js";
import { generateArticleEnrichmentSuggestions, ArticleEnrichmentAgent } from "../services/articleEnrichment/index.js";
import { knowledgeBaseStorage } from "../storage/knowledgeBaseStorage.js";
import type { IntentWithArticle } from "../storage/knowledgeBaseTypes.js";

const router = Router();

const CONFIG_KEY = "article_enrichment";

router.post("/api/ai/article-enrichment/generate", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, subproduct, limit = 3, articleId } = req.body;

    const dbConfig = await storage.getOpenaiApiConfig(CONFIG_KEY);
    
    if (!dbConfig) {
      return res.status(404).json({ 
        error: "Article enrichment configuration not found in database. Please configure the prompts first." 
      });
    }
    
    if (!dbConfig.promptTemplate || !dbConfig.promptTemplate.trim()) {
      return res.status(400).json({ 
        error: "Article enrichment prompt template is not configured. Please set the prompt template in the configuration." 
      });
    }
    
    if (!dbConfig.promptSystem || !dbConfig.promptSystem.trim()) {
      return res.status(400).json({ 
        error: "Article enrichment system prompt is not configured. Please set the system prompt in the configuration." 
      });
    }

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
      console.log(`[ArticleEnrichment] Processing single article #${articleId} for improvement`);
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
          articlesUpdated: 0,
          suggestionsGenerated: 0,
          skipped: 0,
          suggestions: [],
          message: "Nenhuma intenção encontrada com os filtros aplicados. Cadastre intenções primeiro na aba 'Assuntos e Intenções'."
        });
      }

      console.log(`[ArticleEnrichment] Processing ${intentsWithArticles.length} intents (with/without articles)`);
    }

    const result = await generateArticleEnrichmentSuggestions({
      intentsWithArticles,
    });

    res.json(result);
  } catch (error: any) {
    console.error("[ArticleEnrichment] Error generating suggestions:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate article enrichment suggestions" });
  }
});

router.post("/api/ai/article-enrichment/inline", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { intentId, articleId, currentData } = req.body;

    if (!intentId) {
      return res.status(400).json({ 
        success: false,
        error: "É necessário ter uma intenção associada para enriquecer o artigo." 
      });
    }

    const dbConfig = await storage.getOpenaiApiConfig(CONFIG_KEY);
    
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

    const sanitizeString = (val: any, maxLen: number): string => {
      if (typeof val !== 'string') return '';
      return val.trim().slice(0, maxLen);
    };
    const sanitizeStringArray = (val: any, maxLen: number): string[] => {
      if (!Array.isArray(val)) return [];
      return val.filter(v => typeof v === 'string').map(v => v.trim().slice(0, maxLen)).slice(0, 20);
    };

    let intentWithArticle: IntentWithArticle | null = null;

    if (articleId) {
      intentWithArticle = await knowledgeBaseStorage.getIntentWithArticleByArticleId(articleId);
      
      if (intentWithArticle) {
        console.log(`[ArticleEnrichment Inline] Found article #${articleId} with intent #${intentWithArticle.intent.id}`);
      }
    }

    if (!intentWithArticle) {
      console.log(`[ArticleEnrichment Inline] Article #${articleId || 'N/A'} not found with intent in DB, fetching intent metadata only`);
      
      if (!currentData || (!currentData.question && !currentData.answer)) {
        console.warn(`[ArticleEnrichment Inline] No currentData provided for article #${articleId || 'N/A'} without DB record`);
        return res.status(400).json({
          success: false,
          error: "Dados do artigo não fornecidos. Preencha a pergunta e/ou resposta antes de enriquecer."
        });
      }
      
      const intentMetadata = await knowledgeBaseStorage.getIntentMetadataById(intentId);
      
      if (!intentMetadata) {
        return res.status(404).json({
          success: false,
          error: "Intenção não encontrada."
        });
      }

      const sanitizedData = {
        question: sanitizeString(currentData?.question, 5000),
        answer: sanitizeString(currentData?.answer, 10000),
        keywords: sanitizeString(currentData?.keywords, 1000),
        questionVariation: sanitizeStringArray(currentData?.questionVariation, 500),
      };

      if (!sanitizedData.question && !sanitizedData.answer) {
        console.warn(`[ArticleEnrichment Inline] Empty content after sanitization for article #${articleId || 'N/A'}`);
        return res.status(400).json({
          success: false,
          error: "Conteúdo do artigo está vazio. Preencha a pergunta e/ou resposta antes de enriquecer."
        });
      }

      const now = new Date();
      intentWithArticle = {
        intent: intentMetadata,
        article: {
          id: articleId || 0,
          question: sanitizedData.question,
          questionNormalized: null,
          answer: sanitizedData.answer,
          keywords: sanitizedData.keywords,
          questionVariation: sanitizedData.questionVariation,
          productId: null,
          subjectId: null,
          intentId: intentId,
          visibleInSearch: true,
          availableForAutoReply: true,
          createdAt: now,
          updatedAt: now,
        }
      };
      
      console.log(`[ArticleEnrichment Inline] Built article from currentData for intent #${intentId}`);
    } else if (currentData) {
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
          questionNormalized: null,
          answer: sanitizedData.answer,
          keywords: sanitizedData.keywords,
          questionVariation: sanitizedData.questionVariation,
          productId: null,
          subjectId: null,
          intentId: intentId,
          visibleInSearch: true,
          availableForAutoReply: true,
          createdAt: now,
          updatedAt: now,
        }
      };
    }

    console.log(`[ArticleEnrichment Inline] Processing intent #${intentId} for inline enrichment`);

    const result = await ArticleEnrichmentAgent.process(intentWithArticle);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error || "Erro ao processar enriquecimento"
      });
    }

    if (result.action === "skip") {
      return res.json({
        success: true,
        action: "skip",
        skipReason: result.skipReason || "O artigo já está adequado",
        confidenceScore: result.confidenceScore
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
        answer: result.answer || "",
        keywords: result.keywords || "",
        questionVariation: normalizeVariations(result.questionVariation),
        questionNormalized: normalizeVariations(result.questionNormalized),
        updateReason: result.updateReason || "",
        confidenceScore: result.confidenceScore ?? null,
        sourceArticles: result.sourceArticles || []
      }
    });

  } catch (error: any) {
    console.error("[ArticleEnrichment Inline] Error:", error.message);
    res.status(500).json({ 
      success: false,
      error: error.message || "Erro ao gerar sugestão de enriquecimento" 
    });
  }
});

export default router;
