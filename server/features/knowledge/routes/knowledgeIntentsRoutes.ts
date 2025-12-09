import { Router } from "express";
import { knowledgeIntentsStorage } from "../storage/knowledgeIntentsStorage.js";
import type { InsertKnowledgeIntent } from "../../../../shared/schema.js";

const router = Router();

router.get("/api/knowledge/intents", async (req, res) => {
  try {
    const { search, subjectId, withSubject } = req.query;
    
    if (withSubject === "true") {
      const intents = await knowledgeIntentsStorage.getAllWithSubject();
      return res.json(intents);
    }
    
    const intents = await knowledgeIntentsStorage.getAll({
      search: search as string | undefined,
      subjectId: subjectId ? parseInt(subjectId as string) : undefined,
    });
    res.json(intents);
  } catch (error) {
    console.error("Error fetching knowledge intents:", error);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

router.get("/api/knowledge/intents/search/term", async (req, res) => {
  try {
    const { q, subjectId } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    const intents = await knowledgeIntentsStorage.findByNameOrSynonym(
      q as string,
      subjectId ? parseInt(subjectId as string) : undefined
    );
    
    res.json(intents);
  } catch (error) {
    console.error("Error searching intents:", error);
    res.status(500).json({ error: "Failed to search intents" });
  }
});

router.get("/api/knowledge/intents/by-subject/:subjectId", async (req, res) => {
  try {
    const subjectId = parseInt(req.params.subjectId);
    if (isNaN(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }
    const intents = await knowledgeIntentsStorage.getBySubjectId(subjectId);
    res.json(intents);
  } catch (error) {
    console.error("Error fetching intents by subject:", error);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

router.get("/api/knowledge/intents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const intent = await knowledgeIntentsStorage.getById(id);
    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }
    res.json(intent);
  } catch (error) {
    console.error("Error fetching intent:", error);
    res.status(500).json({ error: "Failed to fetch intent" });
  }
});

router.get("/api/knowledge/intents/by-subject/:subjectId", async (req, res) => {
  try {
    const subjectId = parseInt(req.params.subjectId);
    if (isNaN(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }
    const intents = await knowledgeIntentsStorage.getBySubjectId(subjectId);
    res.json(intents);
  } catch (error) {
    console.error("Error fetching intents by subject:", error);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

router.post("/api/knowledge/intents", async (req, res) => {
  try {
    const data: InsertKnowledgeIntent = req.body;
    
    if (!data.subjectId || !data.name) {
      return res.status(400).json({ error: "Missing required fields: subjectId and name" });
    }
    
    const intent = await knowledgeIntentsStorage.create(data);
    res.status(201).json(intent);
  } catch (error) {
    console.error("Error creating intent:", error);
    res.status(500).json({ error: "Failed to create intent" });
  }
});

router.put("/api/knowledge/intents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const data: Partial<InsertKnowledgeIntent> = req.body;
    const intent = await knowledgeIntentsStorage.update(id, data);
    
    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }
    
    res.json(intent);
  } catch (error) {
    console.error("Error updating intent:", error);
    res.status(500).json({ error: "Failed to update intent" });
  }
});

router.delete("/api/knowledge/intents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const deleted = await knowledgeIntentsStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Intent not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting intent:", error);
    res.status(500).json({ error: "Failed to delete intent" });
  }
});

router.post("/api/knowledge/intents/:id/synonyms", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { synonym } = req.body;
    if (!synonym || typeof synonym !== "string") {
      return res.status(400).json({ error: "Synonym is required" });
    }
    
    const intent = await knowledgeIntentsStorage.addSynonym(id, synonym);
    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }
    
    res.json(intent);
  } catch (error) {
    console.error("Error adding synonym:", error);
    res.status(500).json({ error: "Failed to add synonym" });
  }
});

router.delete("/api/knowledge/intents/:id/synonyms/:synonym", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const { synonym } = req.params;
    const intent = await knowledgeIntentsStorage.removeSynonym(id, decodeURIComponent(synonym));
    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }
    
    res.json(intent);
  } catch (error) {
    console.error("Error removing synonym:", error);
    res.status(500).json({ error: "Failed to remove synonym" });
  }
});

export default router;
