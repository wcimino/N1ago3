import { Router } from "express";
import { syncFromProd } from "../services/prodSyncService.js";

const router = Router();

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL;

router.post("/api/admin/sync-from-prod", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }

  const isDev = process.env.NODE_ENV !== "production" || 
                process.env.REPLIT_DEV_DOMAIN !== undefined;
  
  if (!isDev) {
    return res.status(403).json({ error: "Sync só disponível em ambiente de desenvolvimento" });
  }

  if (!PROD_DATABASE_URL) {
    return res.status(500).json({ error: "PROD_DATABASE_URL não configurada no servidor" });
  }

  try {
    const result = await syncFromProd(PROD_DATABASE_URL);
    
    if (result.success) {
      res.json({ 
        message: "Sincronização concluída com sucesso",
        stats: result.stats 
      });
    } else {
      res.status(500).json({ 
        error: result.error,
        stats: result.stats 
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

router.get("/api/admin/sync-status", (req, res) => {
  const isDev = process.env.NODE_ENV !== "production" || 
                process.env.REPLIT_DEV_DOMAIN !== undefined;
  
  const hasProdUrl = !!PROD_DATABASE_URL;
  
  res.json({ 
    available: isDev && hasProdUrl,
    environment: isDev ? "development" : "production",
    configured: hasProdUrl
  });
});

export default router;
