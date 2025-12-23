import { Router, type Request, type Response } from "express";
import { productCatalogStorage, subproductCatalogStorage } from "../storage/productCatalogStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import crypto from "crypto";

const router = Router();

router.get("/api/product-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const products = await productCatalogStorage.getAll();
    res.json(products);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching:", error.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/api/product-catalog/distinct/produtos", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const produtos = await productCatalogStorage.getDistinctProdutos();
    res.json(produtos);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching distinct produtos:", error.message);
    res.status(500).json({ error: "Failed to fetch distinct produtos" });
  }
});

router.get("/api/product-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const product = await productCatalogStorage.getById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching by ID:", error.message);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/api/product-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { name, icon, color } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    const product = await productCatalogStorage.create({
      externalId: crypto.randomUUID(),
      name: name.trim(),
      icon: icon || null,
      color: color || null,
    });

    res.status(201).json(product);
  } catch (error: any) {
    console.error("[Product Catalog] Error creating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This product already exists" });
    }
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/api/product-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { name, icon, color } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    const product = await productCatalogStorage.update(id, {
      name: name.trim(),
      icon: icon || null,
      color: color || null,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error: any) {
    console.error("[Product Catalog] Error updating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This product already exists" });
    }
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/api/product-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const deleted = await productCatalogStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Product Catalog] Error deleting:", error.message);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/api/subproduct-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { produtoId } = req.query;
    
    if (produtoId && typeof produtoId === "string") {
      const subproducts = await subproductCatalogStorage.getByProdutoId(produtoId);
      return res.json(subproducts);
    }
    
    const subproducts = await subproductCatalogStorage.getAll();
    res.json(subproducts);
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error fetching:", error.message);
    res.status(500).json({ error: "Failed to fetch subproducts" });
  }
});

router.get("/api/subproduct-catalog/distinct", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { produtoId } = req.query;
    const subprodutos = await subproductCatalogStorage.getDistinctSubprodutos(produtoId as string);
    res.json(subprodutos);
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error fetching distinct:", error.message);
    res.status(500).json({ error: "Failed to fetch distinct subprodutos" });
  }
});

router.get("/api/subproduct-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const subproduct = await subproductCatalogStorage.getById(id);
    if (!subproduct) {
      return res.status(404).json({ error: "Subproduct not found" });
    }
    
    res.json(subproduct);
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error fetching by ID:", error.message);
    res.status(500).json({ error: "Failed to fetch subproduct" });
  }
});

router.post("/api/subproduct-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { name, produtoId } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!produtoId || typeof produtoId !== "string") {
      return res.status(400).json({ error: "Produto ID is required" });
    }

    const subproduct = await subproductCatalogStorage.create({
      externalId: crypto.randomUUID(),
      name: name.trim(),
      produtoId,
    });

    res.status(201).json(subproduct);
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error creating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This subproduct already exists" });
    }
    res.status(500).json({ error: "Failed to create subproduct" });
  }
});

router.put("/api/subproduct-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { name, produtoId } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }

    const subproduct = await subproductCatalogStorage.update(id, {
      name: name.trim(),
      produtoId,
    });

    if (!subproduct) {
      return res.status(404).json({ error: "Subproduct not found" });
    }

    res.json(subproduct);
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error updating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This subproduct already exists" });
    }
    res.status(500).json({ error: "Failed to update subproduct" });
  }
});

router.delete("/api/subproduct-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const deleted = await subproductCatalogStorage.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Subproduct not found" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Subproduct Catalog] Error deleting:", error.message);
    res.status(500).json({ error: "Failed to delete subproduct" });
  }
});

export default router;
