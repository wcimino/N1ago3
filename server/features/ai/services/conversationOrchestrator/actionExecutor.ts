import { conversationStorage } from "../../../conversations/storage/index.js";
import { AutoPilotService } from "../../../autoPilot/services/autoPilotService.js";
import { SendMessageService } from "../../../send-message/index.js";
import { ZendeskApiService } from "../../../external-sources/zendesk/services/zendeskApiService.js";
import { isN1agoHandler } from "./helpers.js";
import type { OrchestratorAction, OrchestratorContext } from "./types.js";
import { ORCHESTRATOR_STATUS } from "./types.js";

export class ActionExecutor {
  static async execute(context: OrchestratorContext, actions: OrchestratorAction[]): Promise<void> {
    const { conversationId } = context;

    if (actions.length === 0) {
      console.log(`[ActionExecutor] No actions to execute for conversation ${conversationId}`);
      return;
    }

    console.log(`[ActionExecutor] Executing ${actions.length} action(s) for conversation ${conversationId}`);

    for (const action of actions) {
      await this.executeAction(context, action);
    }
  }

  private static async executeAction(context: OrchestratorContext, action: OrchestratorAction): Promise<void> {
    const { conversationId } = context;

    switch (action.type) {
      case "SEND_MESSAGE":
        await this.executeSendMessage(conversationId, action.payload);
        break;

      case "TRANSFER_TO_HUMAN":
        await this.executeTransferToHuman(context, action.payload);
        break;

      default:
        console.log(`[ActionExecutor] Unknown or unsupported action type: ${(action as any).type} - skipping`);
    }
  }

  private static async executeSendMessage(
    conversationId: number, 
    payload: { suggestionId: number; responsePreview: string }
  ): Promise<void> {
    console.log(`[ActionExecutor] SEND_MESSAGE for conversation ${conversationId}`);
    console.log(`[ActionExecutor] Response preview: "${payload.responsePreview.substring(0, 100)}..."`);

    const isN1ago = await isN1agoHandler(conversationId);
    if (!isN1ago) {
      console.log(`[ActionExecutor] SEND_MESSAGE skipped - handler is not N1ago (observation-only mode)`);
      console.log(`[ActionExecutor] Response saved as suggestion ${payload.suggestionId} but not sent`);
      return;
    }

    console.log(`[ActionExecutor] Sending suggestion ${payload.suggestionId} via AutoPilot`);
    const result = await AutoPilotService.processSuggestion(payload.suggestionId);

    if (result.action === "sent") {
      console.log(`[ActionExecutor] SEND_MESSAGE completed successfully`);
    } else {
      console.log(`[ActionExecutor] SEND_MESSAGE not sent - action=${result.action}, reason=${result.reason}`);
    }
  }

  private static async executeTransferToHuman(
    context: OrchestratorContext,
    payload: { reason: string; message: string }
  ): Promise<void> {
    const { conversationId, event } = context;
    console.log(`[ActionExecutor] TRANSFER_TO_HUMAN for conversation ${conversationId}: ${payload.reason}`);

    const isN1ago = await isN1agoHandler(conversationId);
    if (!isN1ago) {
      console.log(`[ActionExecutor] TRANSFER_TO_HUMAN skipped - handler is not N1ago (observation-only mode)`);
      return;
    }

    const externalConversationId = event.externalConversationId;
    if (!externalConversationId) {
      console.error(`[ActionExecutor] TRANSFER_TO_HUMAN failed - missing externalConversationId`);
      return;
    }

    const sendResult = await SendMessageService.send({
      conversationId,
      externalConversationId,
      message: payload.message,
      type: "transfer",
      source: "orchestrator",
    });

    if (sendResult.sent) {
      console.log(`[ActionExecutor] Transfer message sent successfully`);
    } else {
      console.log(`[ActionExecutor] Transfer message not sent: ${sendResult.reason}`);
    }

    const agentWorkspaceId = ZendeskApiService.getAgentWorkspaceIntegrationId();
    const passControlResult = await ZendeskApiService.passControl(
      externalConversationId,
      agentWorkspaceId,
      { reason: payload.reason },
      "transfer",
      `transfer:${conversationId}`
    );

    if (passControlResult.success) {
      console.log(`[ActionExecutor] Control passed to agent workspace successfully`);
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
      console.log(`[ActionExecutor] Status updated to ESCALATED after successful transfer`);
    } else {
      console.error(`[ActionExecutor] Failed to pass control: ${passControlResult.error}`);
    }
  }
}
