import { Router } from "express";
import { reprocessingService, type ReprocessingType } from "../services/reprocessingService.js";

const router = Router();

router.get("/api/maintenance/reprocessing/progress", async (req, res) => {
  try {
    const progress = reprocessingService.getAllProgress();
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/reprocessing/start/:type", async (req, res) => {
  try {
    const type = req.params.type as ReprocessingType;
    if (type !== "users" && type !== "organizations") {
      return res.status(400).json({ error: "Tipo inválido. Use 'users' ou 'organizations'" });
    }

    await reprocessingService.start(type);
    res.json({ message: `Reprocessamento de ${type} iniciado`, progress: reprocessingService.getProgress(type) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/reprocessing/stop/:type", async (req, res) => {
  try {
    const type = req.params.type as ReprocessingType;
    if (type !== "users" && type !== "organizations") {
      return res.status(400).json({ error: "Tipo inválido. Use 'users' ou 'organizations'" });
    }

    await reprocessingService.stop(type);
    res.json({ message: `Reprocessamento de ${type} pausado`, progress: reprocessingService.getProgress(type) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/reprocessing/reset/:type", async (req, res) => {
  try {
    const type = req.params.type as ReprocessingType;
    if (type !== "users" && type !== "organizations") {
      return res.status(400).json({ error: "Tipo inválido. Use 'users' ou 'organizations'" });
    }

    await reprocessingService.reset(type);
    res.json({ message: `Reprocessamento de ${type} resetado`, progress: reprocessingService.getProgress(type) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
