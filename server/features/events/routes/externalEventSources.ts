import { Router, type Request, type Response } from "express";
import { externalEventSourcesStorage } from "../storage/externalEventSourcesStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";

const router = Router();

function maskApiKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.substring(0, 8) + "..." + key.substring(key.length - 4);
}

router.get("/api/external-event-sources", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const sources = await externalEventSourcesStorage.getAll();
    res.json({
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        source: s.source,
        channel_type: s.channelType,
        api_key_masked: maskApiKey(s.apiKey),
        is_active: s.isActive,
        created_at: s.createdAt?.toISOString(),
        updated_at: s.updatedAt?.toISOString(),
        created_by: s.createdBy,
      })),
    });
  } catch (error: any) {
    console.error("[ExternalEventSources] Error fetching sources:", error);
    res.status(500).json({ error: "Erro ao buscar sistemas externos" });
  }
});

router.post("/api/external-event-sources", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { name, source, channel_type } = req.body;
    const user = (req as any).user;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    if (!source || !source.trim()) {
      return res.status(400).json({ error: "Source é obrigatório" });
    }

    if (!channel_type || !channel_type.trim()) {
      return res.status(400).json({ error: "Channel type é obrigatório" });
    }

    const sourceSlug = source.trim().toLowerCase().replace(/\s+/g, "_");
    const channelTypeSlug = channel_type.trim().toLowerCase().replace(/\s+/g, "_");

    const existing = await externalEventSourcesStorage.getBySource(sourceSlug);
    if (existing) {
      return res.status(409).json({ error: `Já existe um sistema cadastrado com source '${sourceSlug}'` });
    }

    const created = await externalEventSourcesStorage.create({
      name: name.trim(),
      source: sourceSlug,
      channelType: channelTypeSlug,
      isActive: true,
      createdBy: user?.claims?.email || null,
    });

    res.status(201).json({
      id: created.id,
      name: created.name,
      source: created.source,
      channel_type: created.channelType,
      api_key: created.apiKey,
      is_active: created.isActive,
      created_at: created.createdAt?.toISOString(),
      created_by: created.createdBy,
    });
  } catch (error: any) {
    console.error("[ExternalEventSources] Error creating source:", error);
    res.status(500).json({ error: "Erro ao criar sistema externo" });
  }
});

router.put("/api/external-event-sources/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, channel_type, is_active } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const existing = await externalEventSourcesStorage.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Sistema externo não encontrado" });
    }

    const updateData: any = {};
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Nome não pode ser vazio" });
      }
      updateData.name = trimmedName;
    }
    if (channel_type !== undefined) {
      const trimmedChannelType = channel_type.trim();
      if (!trimmedChannelType) {
        return res.status(400).json({ error: "Channel type não pode ser vazio" });
      }
      updateData.channelType = trimmedChannelType.toLowerCase().replace(/\s+/g, "_");
    }
    if (is_active !== undefined) updateData.isActive = is_active;

    const updated = await externalEventSourcesStorage.update(id, updateData);

    res.json({
      id: updated!.id,
      name: updated!.name,
      source: updated!.source,
      channel_type: updated!.channelType,
      api_key_masked: maskApiKey(updated!.apiKey),
      is_active: updated!.isActive,
      created_at: updated!.createdAt?.toISOString(),
      updated_at: updated!.updatedAt?.toISOString(),
      created_by: updated!.createdBy,
    });
  } catch (error: any) {
    console.error("[ExternalEventSources] Error updating source:", error);
    res.status(500).json({ error: "Erro ao atualizar sistema externo" });
  }
});

router.post("/api/external-event-sources/:id/regenerate-key", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const existing = await externalEventSourcesStorage.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Sistema externo não encontrado" });
    }

    const updated = await externalEventSourcesStorage.regenerateApiKey(id);

    res.json({
      id: updated!.id,
      name: updated!.name,
      source: updated!.source,
      api_key: updated!.apiKey,
      is_active: updated!.isActive,
      updated_at: updated!.updatedAt?.toISOString(),
      message: "Nova chave gerada. Copie agora, ela não será exibida novamente.",
    });
  } catch (error: any) {
    console.error("[ExternalEventSources] Error regenerating API key:", error);
    res.status(500).json({ error: "Erro ao regenerar chave de API" });
  }
});

router.delete("/api/external-event-sources/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const existing = await externalEventSourcesStorage.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Sistema externo não encontrado" });
    }

    await externalEventSourcesStorage.delete(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ExternalEventSources] Error deleting source:", error);
    res.status(500).json({ error: "Erro ao excluir sistema externo" });
  }
});

export default router;
