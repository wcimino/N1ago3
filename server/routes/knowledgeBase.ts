import { Router } from "express";
import { knowledgeBaseStorage } from "../storage/index.js";
import type { InsertKnowledgeBaseArticle } from "../../shared/schema.js";

const router = Router();

router.get("/api/knowledge-base", async (req, res) => {
  try {
    const { search, productStandard, intent } = req.query;
    const articles = await knowledgeBaseStorage.getAllArticles({
      search: search as string | undefined,
      productStandard: productStandard as string | undefined,
      intent: intent as string | undefined,
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching knowledge base articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

router.get("/api/knowledge-base/filters", async (req, res) => {
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

router.get("/api/knowledge-base/:id", async (req, res) => {
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

router.post("/api/knowledge-base", async (req, res) => {
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

router.put("/api/knowledge-base/:id", async (req, res) => {
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

router.delete("/api/knowledge-base/:id", async (req, res) => {
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

export default router;
