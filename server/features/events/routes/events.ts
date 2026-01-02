import { Router, type Request, type Response } from "express";
import { eventStorage } from "../storage/eventStorage.js";
import { isAuthenticated, requireAuthorizedUser } from "../../auth/middleware/authMiddleware.js";

const router = Router();

router.get("/api/events/events_standard", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const conversationId = req.query.conversation_id ? parseInt(req.query.conversation_id as string) : undefined;
  const showInListOnly = req.query.show_all !== "true";

  const { events, total } = await eventStorage.getStandardEventsWithMappings(limit, offset, { source, eventType, conversationId, showInListOnly });

  res.json({
    total,
    offset,
    limit,
    events,
  });
});

router.get("/api/events/stats", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const stats = await eventStorage.getStandardEventsStats();
  res.json(stats);
});

router.get("/api/event-type-mappings", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const mappings = await eventStorage.getEventTypeMappings();
  res.json({
    mappings: mappings.map((m) => ({
      id: m.id,
      source: m.source,
      event_type: m.eventType,
      display_name: m.displayName,
      description: m.description,
      show_in_list: m.showInList,
      icon: m.icon,
      created_at: m.createdAt?.toISOString(),
      updated_at: m.updatedAt?.toISOString(),
    })),
  });
});

router.post("/api/event-type-mappings", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { source, event_type, display_name, description, show_in_list, icon } = req.body;

  if (!source || !event_type || !display_name) {
    return res.status(400).json({ error: "source, event_type, and display_name are required" });
  }

  const mapping = await eventStorage.upsertEventTypeMapping({
    source,
    eventType: event_type,
    displayName: display_name,
    description: description || null,
    showInList: show_in_list ?? true,
    icon: icon || null,
  });

  res.json({
    id: mapping.id,
    source: mapping.source,
    event_type: mapping.eventType,
    display_name: mapping.displayName,
    description: mapping.description,
    show_in_list: mapping.showInList,
    icon: mapping.icon,
  });
});

router.put("/api/event-type-mappings/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { display_name, description, show_in_list, icon } = req.body;

  const mapping = await eventStorage.updateEventTypeMapping(id, {
    displayName: display_name,
    description,
    showInList: show_in_list,
    icon,
  });

  if (!mapping) {
    return res.status(404).json({ error: "Mapping not found" });
  }

  res.json({
    id: mapping.id,
    source: mapping.source,
    event_type: mapping.eventType,
    display_name: mapping.displayName,
    description: mapping.description,
    show_in_list: mapping.showInList,
    icon: mapping.icon,
  });
});

router.delete("/api/event-type-mappings/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await eventStorage.deleteEventTypeMapping(id);
  res.json({ success: true });
});

export default router;
