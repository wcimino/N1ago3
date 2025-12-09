import { Router } from "express";
import { knowledgeSubjectsStorage } from "../storage/knowledgeSubjectsStorage.js";
import type { InsertKnowledgeSubject } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/subjects", async (req, res) => {
  try {
    const { search, productCatalogId, withProduct } = req.query;
    
    if (withProduct === "true") {
      const subjects = await knowledgeSubjectsStorage.getAllWithProduct();
      return res.json(subjects);
    }
    
    const subjects = await knowledgeSubjectsStorage.getAll({
      search: search as string | undefined,
      productCatalogId: productCatalogId ? parseInt(productCatalogId as string) : undefined,
    });
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching knowledge subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

router.get("/api/knowledge/subjects/search/term", async (req, res) => {
  try {
    const { q, productCatalogId } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    const subjects = await knowledgeSubjectsStorage.findByNameOrSynonym(
      q as string,
      productCatalogId ? parseInt(productCatalogId as string) : undefined
    );
    
    res.json(subjects);
  } catch (error) {
    console.error("Error searching subjects:", error);
    res.status(500).json({ error: "Failed to search subjects" });
  }
});

router.get("/api/knowledge/subjects/by-product/:productCatalogId", async (req, res) => {
  try {
    const productCatalogId = parseInt(req.params.productCatalogId);
    if (isNaN(productCatalogId)) {
      return res.status(400).json({ error: "Invalid product catalog ID" });
    }
    const subjects = await knowledgeSubjectsStorage.getByProductCatalogId(productCatalogId);
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects by product:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

router.get("/api/knowledge/subjects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const subject = await knowledgeSubjectsStorage.getById(id);
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }
    res.json(subject);
  } catch (error) {
    console.error("Error fetching subject:", error);
    res.status(500).json({ error: "Failed to fetch subject" });
  }
});

router.get("/api/knowledge/subjects/by-product/:productCatalogId", async (req, res) => {
  try {
    const productCatalogId = parseInt(req.params.productCatalogId);
    if (isNaN(productCatalogId)) {
      return res.status(400).json({ error: "Invalid product catalog ID" });
    }
    const subjects = await knowledgeSubjectsStorage.getByProductCatalogId(productCatalogId);
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects by product:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

router.post("/api/knowledge/subjects", async (req, res) => {
  try {
    const data: InsertKnowledgeSubject = req.body;
    
    if (!data.productCatalogId || !data.name) {
      return res.status(400).json({ error: "Missing required fields: productCatalogId and name" });
    }
    
    const subject = await knowledgeSubjectsStorage.create(data);
    res.status(201).json(subject);
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

router.put("/api/knowledge/subjects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const data: Partial<InsertKnowledgeSubject> = req.body;
    const subject = await knowledgeSubjectsStorage.update(id, data);
    
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }
    
    res.json(subject);
  } catch (error) {
    console.error("Error updating subject:", error);
    res.status(500).json({ error: "Failed to update subject" });
  }
});

router.delete("/api/knowledge/subjects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const deleted = await knowledgeSubjectsStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Subject not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting subject:", error);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

router.post("/api/knowledge/subjects/:id/synonyms", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { synonym } = req.body;
    if (!synonym || typeof synonym !== "string") {
      return res.status(400).json({ error: "Synonym is required" });
    }
    
    const subject = await knowledgeSubjectsStorage.addSynonym(id, synonym);
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }
    
    res.json(subject);
  } catch (error) {
    console.error("Error adding synonym:", error);
    res.status(500).json({ error: "Failed to add synonym" });
  }
});

router.delete("/api/knowledge/subjects/:id/synonyms/:synonym", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { synonym } = req.params;
    const subject = await knowledgeSubjectsStorage.removeSynonym(id, decodeURIComponent(synonym));
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }
    
    res.json(subject);
  } catch (error) {
    console.error("Error removing synonym:", error);
    res.status(500).json({ error: "Failed to remove synonym" });
  }
});

export default router;
