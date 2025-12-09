import { Router } from "express";
import { knowledgeBaseStorage } from "../../../storage/index.js";
import { knowledgeBaseService } from "../services/knowledgeBaseService.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import type { InsertKnowledgeBaseArticle } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/articles", async (req, res) => {
  try {
    const { search, productStandard, intent, subjectId, intentId } = req.query;
    const articles = await knowledgeBaseStorage.getAllArticles({
      search: search as string | undefined,
      productStandard: productStandard as string | undefined,
      intent: intent as string | undefined,
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
    const [products, intents] = await Promise.all([
      knowledgeBaseStorage.getDistinctProducts(),
      knowledgeBaseStorage.getDistinctIntents(),
    ]);
    res.json({ products, intents });
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
    
    if (!data.productStandard || !data.intent || !data.description || !data.resolution) {
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
    const { product, intent, keywords, limit } = req.query;

    const keywordsArray = keywords 
      ? (keywords as string).split(",").map(k => k.trim()).filter(k => k.length > 0)
      : undefined;

    const results = await knowledgeBaseService.findRelatedArticles(
      product as string | undefined,
      intent as string | undefined,
      keywordsArray,
      { limit: parseInt(limit as string) || 10 }
    );

    res.json({
      results,
      total: results.length,
      query: { product, intent, keywords: keywordsArray },
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

    const results = await knowledgeBaseService.searchByProduct(
      q as string,
      { limit: parseInt(limit as string) || 10 }
    );

    res.json({ results, total: results.length });
  } catch (error) {
    console.error("Error searching by product:", error);
    res.status(500).json({ error: "Failed to search by product" });
  }
});

router.get("/api/knowledge/search/category", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { category1, category2, limit } = req.query;

    if (!category1) {
      return res.status(400).json({ error: "Query parameter 'category1' is required" });
    }

    const results = await knowledgeBaseService.searchByCategory(
      category1 as string,
      category2 as string | undefined,
      { limit: parseInt(limit as string) || 10 }
    );

    res.json({ results, total: results.length });
  } catch (error) {
    console.error("Error searching by category:", error);
    res.status(500).json({ error: "Failed to search by category" });
  }
});

router.get("/api/knowledge/search/keywords", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const keywords = (q as string).split(",").map(k => k.trim()).filter(k => k.length > 0);

    const results = await knowledgeBaseService.searchByKeywords(
      keywords,
      { limit: parseInt(limit as string) || 10 }
    );

    res.json({ results, total: results.length, keywords });
  } catch (error) {
    console.error("Error searching by keywords:", error);
    res.status(500).json({ error: "Failed to search by keywords" });
  }
});

export default router;
