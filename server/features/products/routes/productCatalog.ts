import { Router, type Request, type Response } from "express";
import { productCatalogStorage } from "../storage/productCatalogStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../auth/middleware/authMiddleware.js";

const router = Router();

router.get("/api/product-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const products = await productCatalogStorage.getAll();
    res.json(products);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching:", error.message);
    res.status(500).json({ error: "Failed to fetch iFood products" });
  }
});

router.get("/api/product-catalog/fullnames", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const fullNames = await productCatalogStorage.getFullNames();
    res.json(fullNames);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching fullnames:", error.message);
    res.status(500).json({ error: "Failed to fetch product names" });
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

router.get("/api/product-catalog/distinct/subprodutos", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { produto } = req.query;
    const subprodutos = await productCatalogStorage.getDistinctSubprodutos(produto as string);
    res.json(subprodutos);
  } catch (error: any) {
    console.error("[Product Catalog] Error fetching distinct subprodutos:", error.message);
    res.status(500).json({ error: "Failed to fetch distinct subprodutos" });
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
    res.status(500).json({ error: "Failed to fetch iFood product" });
  }
});

router.post("/api/product-catalog", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { produto, subproduto } = req.body;

    if (!produto || typeof produto !== "string" || produto.trim() === "") {
      return res.status(400).json({ error: "Produto is required" });
    }

    const parts = [produto.trim()];
    if (subproduto && subproduto.trim()) parts.push(subproduto.trim());
    const fullName = parts.join(" > ");

    const product = await productCatalogStorage.create({
      produto: produto.trim(),
      subproduto: subproduto?.trim() || null,
      fullName,
    });

    res.status(201).json(product);
  } catch (error: any) {
    console.error("[Product Catalog] Error creating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This product combination already exists" });
    }
    res.status(500).json({ error: "Failed to create iFood product" });
  }
});

router.put("/api/product-catalog/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { produto, subproduto } = req.body;

    if (!produto || typeof produto !== "string" || produto.trim() === "") {
      return res.status(400).json({ error: "Produto is required" });
    }

    const parts = [produto.trim()];
    if (subproduto && subproduto.trim()) parts.push(subproduto.trim());
    const fullName = parts.join(" > ");

    const product = await productCatalogStorage.update(id, {
      produto: produto.trim(),
      subproduto: subproduto?.trim() || null,
      fullName,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error: any) {
    console.error("[Product Catalog] Error updating:", error.message);
    if (error.message?.includes("unique constraint")) {
      return res.status(409).json({ error: "This product combination already exists" });
    }
    res.status(500).json({ error: "Failed to update iFood product" });
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
    res.status(500).json({ error: "Failed to delete iFood product" });
  }
});

export default router;
