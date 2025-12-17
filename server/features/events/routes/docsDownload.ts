import { Router, Request, Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import path from "path";
import fs from "fs";

const router = Router();

router.get("/api/docs/external-events-integration", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const filePath = path.join(process.cwd(), "docs", "external-events-integration.md");
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Documentação não encontrada" });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=n1ago-external-events-integration.md");
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error("[DocsDownload] Error:", error);
    res.status(500).json({ error: "Erro ao baixar documentação" });
  }
});

export default router;
