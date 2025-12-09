import { Router } from "express";
import { ZendeskGuideService } from "../services/zendeskGuideService.js";
import { ZendeskArticlesStorage } from "../storage/zendeskArticlesStorage.js";
import { ZendeskArticleStatisticsStorage } from "../storage/zendeskArticleStatisticsStorage.js";

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
