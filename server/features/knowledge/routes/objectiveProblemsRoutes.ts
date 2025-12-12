import { Router } from "express";
import {
  getAllObjectiveProblems,
  getObjectiveProblemById,
  createObjectiveProblem,
  updateObjectiveProblem,
  deleteObjectiveProblem,
  getAllProducts,
} from "../storage/objectiveProblemsStorage.js";

const router = Router();

router.get("/api/knowledge/objective-problems", async (_req, res) => {
  try {
    const problems = await getAllObjectiveProblems();
    res.json(problems);
  } catch (error) {
    console.error("Error fetching objective problems:", error);
    res.status(500).json({ error: "Failed to fetch objective problems" });
  }
});

router.get("/api/knowledge/objective-problems/products", async (_req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/api/knowledge/objective-problems/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const problem = await getObjectiveProblemById(id);
    if (!problem) {
      return res.status(404).json({ error: "Objective problem not found" });
    }
    res.json(problem);
  } catch (error) {
    console.error("Error fetching objective problem:", error);
    res.status(500).json({ error: "Failed to fetch objective problem" });
  }
});

router.post("/api/knowledge/objective-problems", async (req, res) => {
  try {
    const { name, description, synonyms, examples, presentedBy, isActive, productIds } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    const validPresentedBy = ["customer", "system", "both"];
    if (presentedBy && !validPresentedBy.includes(presentedBy)) {
      return res.status(400).json({ error: "presentedBy must be 'customer', 'system', or 'both'" });
    }

    const problem = await createObjectiveProblem({
      name,
      description,
      synonyms: synonyms || [],
      examples: examples || [],
      presentedBy: presentedBy || "customer",
      isActive: isActive !== undefined ? isActive : true,
    }, productIds);

    res.status(201).json(problem);
  } catch (error: any) {
    console.error("Error creating objective problem:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "A problem with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create objective problem" });
  }
});

router.put("/api/knowledge/objective-problems/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, synonyms, examples, presentedBy, isActive, productIds } = req.body;

    const validPresentedBy = ["customer", "system", "both"];
    if (presentedBy && !validPresentedBy.includes(presentedBy)) {
      return res.status(400).json({ error: "presentedBy must be 'customer', 'system', or 'both'" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (synonyms !== undefined) updateData.synonyms = synonyms;
    if (examples !== undefined) updateData.examples = examples;
    if (presentedBy !== undefined) updateData.presentedBy = presentedBy;
    if (isActive !== undefined) updateData.isActive = isActive;

    const problem = await updateObjectiveProblem(id, updateData, productIds);
    if (!problem) {
      return res.status(404).json({ error: "Objective problem not found" });
    }

    res.json(problem);
  } catch (error: any) {
    console.error("Error updating objective problem:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "A problem with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update objective problem" });
  }
});

router.delete("/api/knowledge/objective-problems/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await deleteObjectiveProblem(id);
    if (!deleted) {
      return res.status(404).json({ error: "Objective problem not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting objective problem:", error);
    res.status(500).json({ error: "Failed to delete objective problem" });
  }
});

export default router;
