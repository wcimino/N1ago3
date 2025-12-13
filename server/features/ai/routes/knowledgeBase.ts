import { Router } from "express";
import { knowledgeBaseStorage } from "../../../storage/index.js";
import { runKnowledgeBaseSearch } from "../services/knowledgeBaseSearchHelper.js";
import { batchGenerateEmbeddings, generateArticleEmbedding, generateContentHash } from "../services/knowledgeBaseEmbeddingService.js";
import { KnowledgeBaseStatisticsStorage } from "../storage/knowledgeBaseStatisticsStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import type { InsertKnowledgeBaseArticle } from "../../../../shared/schema.js";
import { runCombinedKnowledgeSearch } from "../services/tools/combinedKnowledgeSearchTool.js";

const router = Router();

router.get("/api/knowledge/articles", async (req, res) => {
  try {
    const { search, productStandard, subjectId, intentId } = req.query;
    const articles = await knowledgeBaseStorage.getAllArticles({
      search: search as string | undefined,
      productStandard: productStandard as string | undefined,
      subjectId: subjectId ? parseInt(subjectId as string) : undefined,
      intentId: intentId ? parseInt(intentId as string) : undefined,
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching knowledge base articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.get("/api/knowledge/articles/filters", async (req, res) => {
  try {
    const products = await knowledgeBaseStorage.getDistinctProducts();
    res.json({ products });
  } catch (error) {
    console.error("Error fetching filters:", error);
    res.status(500).json({ error: "Failed to fetch filters" });
  }
});

router.get("/api/knowledge/articles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const article = await knowledgeBaseStorage.getArticleById(id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

router.post("/api/knowledge/articles", async (req, res) => {
  try {
    const data: InsertKnowledgeBaseArticle = req.body;
    
    if (!data.productStandard || !data.description || !data.resolution) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const article = await knowledgeBaseStorage.createArticle(data);
    res.status(201).json(article);
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

router.put("/api/knowledge/articles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const data: Partial<InsertKnowledgeBaseArticle> = req.body;
    const article = await knowledgeBaseStorage.updateArticle(id, data);
    
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.json(article);
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.delete("/api/knowledge/articles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const deleted = await knowledgeBaseStorage.deleteArticle(id);
    if (!deleted) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

router.get("/api/knowledge/search", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { product, keywords, limit } = req.query;

    const keywordsArray = keywords 
      ? (keywords as string).split(",").map(k => k.trim()).filter(k => k.length > 0)
      : undefined;

    const result = await runKnowledgeBaseSearch({
      product: product as string | undefined,
      keywords: keywordsArray,
      limit: parseInt(limit as string) || 10
    });

    res.json({
      results: result.articles,
      total: result.articles.length,
      query: { product, keywords: keywordsArray },
      resolvedFilters: {
        product: result.resolvedProduct,
        subproduct: result.resolvedSubproduct
      }
    });
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    res.status(500).json({ error: "Failed to search knowledge base" });
  }
});

router.get("/api/knowledge/search/product", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const result = await runKnowledgeBaseSearch({
      product: q as string,
      limit: parseInt(limit as string) || 10
    });

    res.json({ 
      results: result.articles, 
      total: result.articles.length 
    });
  } catch (error) {
    console.error("Error searching by product:", error);
    res.status(500).json({ error: "Failed to search by product" });
  }
});


router.get("/api/knowledge/search/keywords", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const keywords = (q as string).split(",").map(k => k.trim()).filter(k => k.length > 0);

    const result = await runKnowledgeBaseSearch({
      keywords,
      limit: parseInt(limit as string) || 10
    });

    res.json({ 
      results: result.articles, 
      total: result.articles.length, 
      keywords 
    });
  } catch (error) {
    console.error("Error searching by keywords:", error);
    res.status(500).json({ error: "Failed to search by keywords" });
  }
});

router.get("/api/knowledge/embeddings/stats", async (req, res) => {
  try {
    const stats = await knowledgeBaseStorage.getEmbeddingStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching embedding stats:", error);
    res.status(500).json({ error: "Failed to fetch embedding stats" });
  }
});

router.post("/api/knowledge/embeddings/generate", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { limit = 50, includeOutdated = true } = req.body;
    
    const articlesWithoutEmbedding = await knowledgeBaseStorage.getArticlesWithoutEmbedding(limit);
    
    let articlesToProcess = [...articlesWithoutEmbedding];
    
    if (includeOutdated) {
      const outdatedArticles = await knowledgeBaseStorage.getArticlesWithChangedContent(limit);
      const existingIds = new Set(articlesToProcess.map(a => a.id));
      for (const article of outdatedArticles) {
        if (!existingIds.has(article.id)) {
          articlesToProcess.push(article);
        }
      }
    }
    
    articlesToProcess = articlesToProcess.slice(0, limit);
    
    if (articlesToProcess.length === 0) {
      return res.json({
        message: "No articles need embedding generation",
        processed: 0,
        total: 0,
      });
    }
    
    const result = await batchGenerateEmbeddings(
      articlesToProcess,
      async (articleId, embeddingStr, contentHash, logId, tokensUsed) => {
        const embeddingArray = JSON.parse(embeddingStr) as number[];
        await knowledgeBaseStorage.upsertEmbedding({
          articleId,
          contentHash,
          embedding: embeddingArray,
          modelUsed: 'text-embedding-3-small',
          tokensUsed,
          openaiLogId: logId,
        });
      },
      { batchSize: 5, delayMs: 200 }
    );
    
    res.json({
      message: result.success 
        ? `Successfully generated embeddings for ${result.processed} articles` 
        : `Processed ${result.processed} articles with ${result.errors.length} errors`,
      processed: result.processed,
      total: articlesToProcess.length,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Error generating embeddings:", error);
    res.status(500).json({ error: "Failed to generate embeddings" });
  }
});

router.post("/api/knowledge/embeddings/regenerate/:id", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const article = await knowledgeBaseStorage.getArticleById(id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    const { embedding, logId, tokensUsed } = await generateArticleEmbedding(article);
    const contentHash = generateContentHash(article);
    
    await knowledgeBaseStorage.upsertEmbedding({
      articleId: article.id,
      contentHash,
      embedding,
      modelUsed: 'text-embedding-3-small',
      tokensUsed,
      openaiLogId: logId,
    });
    
    res.json({
      message: `Successfully regenerated embedding for article ${id}`,
      articleId: id,
      tokensUsed,
    });
  } catch (error) {
    console.error("Error regenerating embedding:", error);
    res.status(500).json({ error: "Failed to regenerate embedding" });
  }
});

router.get("/api/knowledge/articles/statistics", async (req, res) => {
  try {
    const { limit } = req.query;
    const results = await KnowledgeBaseStatisticsStorage.getViewCountByArticle({
      limit: limit ? parseInt(limit as string) : 1000,
    });
    res.json(results);
  } catch (error) {
    console.error("Error fetching article statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/api/knowledge/articles/statistics/by-intent", async (req, res) => {
  try {
    const intentViewMap = await KnowledgeBaseStatisticsStorage.getViewCountByIntent();
    const results = Array.from(intentViewMap.entries()).map(([intentId, viewCount]) => ({
      intentId,
      viewCount,
    }));
    res.json(results);
  } catch (error) {
    console.error("Error fetching intent statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/api/ai/tools/combined-search", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { product, subproduct, keywords, limit } = req.query;

    if (!product) {
      return res.status(400).json({ error: "Product parameter is required" });
    }

    const result = await runCombinedKnowledgeSearch({
      product: product as string,
      subproduct: subproduct as string | undefined,
      keywords: keywords as string | undefined,
      limit: limit ? parseInt(limit as string) : 10,
    });

    res.json(result);
  } catch (error) {
    console.error("Error in combined knowledge search:", error);
    res.status(500).json({ error: "Failed to search knowledge base" });
  }
});

export default router;
