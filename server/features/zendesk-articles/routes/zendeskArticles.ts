import { Router } from "express";
import { ZendeskGuideService } from "../services/zendeskGuideService.js";
import { ZendeskArticlesStorage } from "../storage/zendeskArticlesStorage.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { search, sectionId, locale, limit, offset } = req.query;
    
    const articles = await ZendeskArticlesStorage.getAllArticles({
      search: search as string | undefined,
      sectionId: sectionId as string | undefined,
      locale: locale as string | undefined,
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
    res.status(500).json({ error: "Failed to sync articles" });
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
