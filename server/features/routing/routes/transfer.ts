import { Router, type Request, type Response } from "express";
import { db } from "../../../db.js";
import { conversations } from "../../../../shared/schema.js";
import { eq } from "drizzle-orm";
import { isAuthenticated, requireAuthorizedUser } from "../../../middleware/auth.js";
import { ZendeskApiService } from "../../../services/zendeskApiService.js";

const router = Router();

const TARGET_INTEGRATIONS: Record<string, () => string> = {
  n1ago: ZendeskApiService.getN1agoIntegrationId,
  human: ZendeskApiService.getAgentWorkspaceIntegrationId,
  bot: ZendeskApiService.getAnswerBotIntegrationId,
};

router.post("/api/conversations/:conversationId/transfer", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { target, reason } = req.body;

    if (!target || !TARGET_INTEGRATIONS[target]) {
      return res.status(400).json({ 
        error: "Invalid target. Must be one of: n1ago, human, bot" 
      });
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parseInt(conversationId)));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const externalConversationId = conversation.externalConversationId;
    const targetIntegrationId = TARGET_INTEGRATIONS[target]();

    const result = await ZendeskApiService.passControl(
      externalConversationId,
      targetIntegrationId,
      { reason: reason || `transfer_to_${target}` },
      "manual_transfer",
      `conversation:${conversationId}`
    );

    if (!result.success) {
      return res.status(500).json({ 
        error: "Failed to transfer conversation",
        details: result.error 
      });
    }

    const handlerNameMap: Record<string, string> = {
      n1ago: "n1ago",
      human: "zd-agentWorkspace",
      bot: "zd-answerBot",
    };

    const updateData: Record<string, any> = { 
      currentHandler: targetIntegrationId,
      currentHandlerName: handlerNameMap[target],
      updatedAt: new Date() 
    };
    
    if (target === "n1ago") {
      updateData.handledByN1ago = true;
    }
    
    await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, parseInt(conversationId)));

    res.json({ 
      success: true, 
      message: `Conversation transferred to ${target}`,
      newHandler: handlerNameMap[target]
    });
  } catch (error) {
    console.error("[TransferRoutes] Error transferring conversation:", error);
    res.status(500).json({ error: "Failed to transfer conversation" });
  }
});

router.post("/api/conversations/:conversationId/close", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { reason = "manual" } = req.body;

    const validReasons = ["inactivity", "new_conversation", "manual", "external"] as const;
    type ValidReason = typeof validReasons[number];
    
    if (!validReasons.includes(reason as ValidReason)) {
      return res.status(400).json({ 
        error: `Invalid reason. Must be one of: ${validReasons.join(", ")}` 
      });
    }

    const { conversationCrud } = await import("../../conversations/storage/conversationCrud.js");
    
    const result = await conversationCrud.closeConversation(parseInt(conversationId), reason as ValidReason);

    if (!result) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ 
      success: true, 
      message: "Conversation closed successfully",
      conversation: {
        id: result.id,
        status: result.status,
        closedAt: result.closedAt,
        closedReason: result.closedReason,
      }
    });
  } catch (error) {
    console.error("[TransferRoutes] Error closing conversation:", error);
    res.status(500).json({ error: "Failed to close conversation" });
  }
});

router.get("/api/conversations/:conversationId/handler", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parseInt(conversationId)));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({
      conversationId: conversation.id,
      handlerId: conversation.currentHandler,
      handlerName: conversation.currentHandlerName,
    });
  } catch (error) {
    console.error("[TransferRoutes] Error fetching handler:", error);
    res.status(500).json({ error: "Failed to fetch conversation handler" });
  }
});

export default router;
