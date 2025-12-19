import { Router } from "express";
import { reprocessingService, type ReprocessingType } from "../../sync/services/reprocessingService.js";
import { autoCloseService } from "../../conversations/services/autoCloseService.js";
import { duplicatesService } from "../services/duplicatesService.js";
import { archiveService } from "../services/archiveService.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";

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

router.get("/api/maintenance/auto-close/status", async (req, res) => {
  try {
    const status = await autoCloseService.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/auto-close/enable", async (req, res) => {
  try {
    autoCloseService.enable();
    const status = await autoCloseService.getStatus();
    res.json({ message: "Encerramento automático ativado", status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/auto-close/disable", async (req, res) => {
  try {
    autoCloseService.disable();
    const status = await autoCloseService.getStatus();
    res.json({ message: "Encerramento automático pausado", status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/auto-close/close-inactive", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const closed = await autoCloseService.closeManual(limit);
    const status = await autoCloseService.getStatus();
    res.json({ 
      message: `${closed.length} conversas encerradas`, 
      closedCount: closed.length,
      closedConversations: closed.map(c => ({ id: c.id, externalId: c.externalConversationId })),
      status 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/maintenance/duplicates/stats", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const stats = await duplicatesService.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/maintenance/duplicates/list", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const duplicates = await duplicatesService.findDuplicates(limit);
    res.json(duplicates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/duplicates/cleanup", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const dryRun = req.query.dryRun !== "false";
    const batchSize = parseInt(req.query.batchSize as string) || 1000;
    const result = await duplicatesService.deleteDuplicates(dryRun, batchSize);
    res.json({
      message: dryRun 
        ? `Simulação: ${result.deletedCount} duplicados seriam removidos de ${result.groups} grupos`
        : `${result.deletedCount} duplicados removidos de ${result.groups} grupos`,
      dryRun,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/maintenance/archive/stats", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const stats = await archiveService.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/maintenance/archive/progress", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const progress = archiveService.getProgress();
    const isRunning = archiveService.isArchiveRunning();
    res.json({ isRunning, progress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/maintenance/archive/history", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await archiveService.getHistory(limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/maintenance/archive/start", isAuthenticated, requireAuthorizedUser, async (req, res) => {
  try {
    const result = await archiveService.startArchive();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
