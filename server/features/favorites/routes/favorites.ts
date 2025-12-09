import { Router, type Request, type Response } from "express";
import { favoritesStorage } from "../storage/favoritesStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

router.get("/api/favorites", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.claims?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const favorites = await favoritesStorage.getFavoriteConversations(authUserId);
    res.json({ favorites });
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/favorites/ids", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.claims?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const conversationIds = await favoritesStorage.getFavoriteConversationIds(authUserId);
    res.json({ conversationIds });
  } catch (error: any) {
    console.error("Error fetching favorite ids:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/favorites/:conversationId", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.claims?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const conversationId = parseInt(req.params.conversationId);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const favorite = await favoritesStorage.addFavorite({
      authUserId,
      conversationId,
    });
    res.status(201).json(favorite);
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/favorites/:conversationId", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.claims?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const conversationId = parseInt(req.params.conversationId);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    await favoritesStorage.removeFavorite(authUserId, conversationId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/favorites/:conversationId/check", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.claims?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const conversationId = parseInt(req.params.conversationId);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const isFavorite = await favoritesStorage.isFavorite(authUserId, conversationId);
    res.json({ isFavorite });
  } catch (error: any) {
    console.error("Error checking favorite:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
