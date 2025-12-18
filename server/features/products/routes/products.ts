import { Router, type Request, type Response } from "express";
import { storage } from "../../../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";

const router = Router();

router.get("/api/product-standards", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const products = await storage.getProductStandards();
    res.json(products);
  } catch (error: any) {
    console.error("[Product Standards] Error fetching:", error.message);
    res.status(500).json({ error: "Failed to fetch product standards" });
  }
});

router.put("/api/product-standards", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { product, productStandard } = req.body;

    if (!product || typeof product !== "string") {
      return res.status(400).json({ error: "Product is required" });
    }
    if (!productStandard || typeof productStandard !== "string") {
      return res.status(400).json({ error: "Product standard is required" });
    }

    const updatedCount = await storage.updateProductStandard(product, productStandard);
    res.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("[Product Standards] Error updating:", error.message);
    res.status(500).json({ error: "Failed to update product standard" });
  }
});

export default router;
