import { Router } from "express";
import { ZendeskGuideService } from "../services/zendeskGuideService.js";
import { ZendeskArticlesStorage } from "../storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../storage/zendeskArticleStatisticsStorage.js";
import { batchGenerateEmbeddings, generateEmbedding } from "../services/embeddingService.js";
import { db } from "../../../db.js";
import { embeddingGenerationLogs } from "../../../../shared/schema.js";
import { desc, sql, eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { search, sectionId, locale, helpCenterSubdomain, limit, offset } = req.query;
    
    const articles = await ZendeskArticlesStorage.getAllArticles({
      search: search as string | undefined,
      sectionId: sectionId as string | undefined,
      locale: locale as string | undefined,
      helpCenterSubdomain: helpCenterSubdomain as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    
    res.json(articles);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.get("/sections", async (_req, res) => {
  try {
    const sections = await ZendeskArticlesStorage.getDistinctSections();
    res.json(sections);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching sections:", error);
    res.status(500).json({ error: "Failed to fetch sections" });
  }
});

router.get("/subdomains", async (_req, res) => {
  try {
    const subdomains = await ZendeskArticlesStorage.getDistinctSubdomains();
    res.json(subdomains);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching subdomains:", error);
    res.status(500).json({ error: "Failed to fetch subdomains" });
  }
});

router.get("/statistics", async (req, res) => {
  try {
    const { startDate, endDate, limit, offset } = req.query;
    
    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };
    
    const [viewCounts, totalViews] = await Promise.all([
      ZendeskArticleStatisticsStorage.getViewCountByArticle(filters),
      ZendeskArticleStatisticsStorage.getTotalViewCount(filters),
    ]);
    
    res.json({
      totalViews,
      articles: viewCounts,
    });
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/statistics/:articleId", async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId, 10);
    const { startDate, endDate, limit } = req.query;
    
    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
    };
    
    const [article, statistics] = await Promise.all([
      ZendeskArticlesStorage.getArticleById(articleId),
      ZendeskArticleStatisticsStorage.getStatisticsForArticle(articleId, filters),
    ]);
    
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    
    res.json({
      article: {
        id: article.id,
        title: article.title,
        sectionName: article.sectionName,
      },
      ...statistics,
    });
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching article statistics:", error);
    res.status(500).json({ error: "Failed to fetch article statistics" });
  }
});

router.get("/sync-info", async (_req, res) => {
  try {
    const info = await ZendeskGuideService.getLastSyncInfo();
    res.json(info);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching sync info:", error);
    res.status(500).json({ error: "Failed to fetch sync info" });
  }
});

router.post("/sync", async (_req, res) => {
  try {
    console.log("[ZendeskArticles] Starting manual sync...");
    const result = await ZendeskGuideService.syncArticles();
    res.json(result);
  } catch (error) {
    console.error("[ZendeskArticles] Error syncing articles:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync articles";
    const isConfigError = errorMessage.includes("ZENDESK_APP_API_KEY");
    res.status(isConfigError ? 503 : 500).json({ 
      error: errorMessage,
      type: isConfigError ? "configuration" : "sync_error"
    });
  }
});

router.get("/embeddings/stats", async (_req, res) => {
  try {
    const stats = await ZendeskArticlesStorage.getEmbeddingStats();
    res.json(stats);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching embedding stats:", error);
    res.status(500).json({ error: "Failed to fetch embedding stats" });
  }
});

router.post("/embeddings/generate", async (req, res) => {
  try {
    const { limit = 100 } = req.body;
    
    console.log(`[ZendeskArticles] Starting embedding generation for up to ${limit} articles...`);
    
    const articles = await ZendeskArticlesStorage.getArticlesWithoutEmbedding(limit);
    
    if (articles.length === 0) {
      res.json({
        success: true,
        message: "All articles already have embeddings",
        processed: 0,
        errors: [],
      });
      return;
    }
    
    console.log(`[ZendeskArticles] Generating embeddings for ${articles.length} articles...`);
    
    const result = await batchGenerateEmbeddings(
      articles,
      async (id, embedding) => {
        await ZendeskArticlesStorage.updateEmbedding(id, embedding);
      },
      { batchSize: 5, delayMs: 200 }
    );
    
    console.log(`[ZendeskArticles] Embedding generation complete: ${result.processed} processed, ${result.errors.length} errors`);
    
    res.json({
      success: result.success,
      message: `Generated embeddings for ${result.processed} articles`,
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[ZendeskArticles] Error generating embeddings:", error);
    res.status(500).json({ error: "Failed to generate embeddings" });
  }
});

router.post("/search/semantic", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query is required" });
      return;
    }
    
    console.log(`[ZendeskArticles] Semantic search for: "${query}"`);
    
    const queryEmbedding = await generateEmbedding(query);
    
    const results = await ZendeskArticlesStorage.searchBySimilarity(queryEmbedding, { limit });
    
    if (results.length === 0) {
      res.json({
        message: "No articles with embeddings found. Please generate embeddings first.",
        articles: [],
      });
      return;
    }
    
    const topArticles = results.map((a) => ({
      id: a.id,
      zendeskId: a.zendeskId,
      title: a.title,
      body: a.body ? a.body.substring(0, 500) + (a.body.length > 500 ? "..." : "") : null,
      sectionName: a.sectionName,
      categoryName: a.categoryName,
      htmlUrl: a.htmlUrl,
      similarity: a.similarity,
    }));
    
    console.log(`[ZendeskArticles] Found ${topArticles.length} relevant articles (pgvector)`);
    
    res.json({
      message: `Found ${topArticles.length} relevant articles`,
      articles: topArticles,
    });
  } catch (error) {
    console.error("[ZendeskArticles] Error in semantic search:", error);
    res.status(500).json({ error: "Failed to perform semantic search" });
  }
});

router.get("/embeddings/logs", async (req, res) => {
  try {
    const { status, limit = "100" } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 500);
    
    let logsQuery = db
      .select()
      .from(embeddingGenerationLogs)
      .orderBy(desc(embeddingGenerationLogs.createdAt))
      .limit(limitNum);
    
    if (status) {
      logsQuery = logsQuery.where(eq(embeddingGenerationLogs.status, status as string)) as typeof logsQuery;
    }
    
    const logs = await logsQuery;
    
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        success: sql<number>`count(CASE WHEN status = 'success' THEN 1 END)::int`,
        error: sql<number>`count(CASE WHEN status = 'error' THEN 1 END)::int`,
        avgProcessingTimeMs: sql<number>`ROUND(AVG(processing_time_ms))::int`,
        last24h: sql<number>`count(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int`,
        errors24h: sql<number>`count(CASE WHEN status = 'error' AND created_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int`,
      })
      .from(embeddingGenerationLogs);
    
    res.json({
      stats: {
        total: stats?.total ?? 0,
        success: stats?.success ?? 0,
        error: stats?.error ?? 0,
        avgProcessingTimeMs: stats?.avgProcessingTimeMs ?? 0,
        last24h: stats?.last24h ?? 0,
        errors24h: stats?.errors24h ?? 0,
      },
      logs,
    });
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching embedding logs:", error);
    res.status(500).json({ error: "Failed to fetch embedding logs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const article = await ZendeskArticlesStorage.getArticleById(id);
    
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    
    res.json(article);
  } catch (error) {
    console.error("[ZendeskArticles] Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

export default router;
