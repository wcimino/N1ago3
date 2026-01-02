import { conversationStorage } from "../../conversations/storage/conversationStorage.js";
import { AutoPilotService } from "../../autoPilot/services/autoPilotService.js";
import { TransferService } from "../../routing/services/transferService.js";
import { isN1agoHandler } from "./helpers.js";
import type { OrchestratorAction, OrchestratorContext } from "./types.js";
import { ORCHESTRATOR_STATUS } from "./types.js";

export interface ActionExecutorResult {
  messageSent: boolean;
  messageSkipped: boolean;
  skipReason?: string;
}

export class ActionExecutor {
  static async execute(context: OrchestratorContext, actions: OrchestratorAction[]): Promise<ActionExecutorResult> {
    const { conversationId } = context;
    const result: ActionExecutorResult = { messageSent: false, messageSkipped: false };

    if (actions.length === 0) {
      console.log(`[ActionExecutor] No actions to execute for conversation ${conversationId}`);
      return result;
    }

    console.log(`[ActionExecutor] Executing ${actions.length} action(s) for conversation ${conversationId}`);

    for (const action of actions) {
      const actionResult = await this.executeAction(context, action);
      if (actionResult.messageSent) result.messageSent = true;
      if (actionResult.messageSkipped) {
        result.messageSkipped = true;
        result.skipReason = actionResult.skipReason;
      }
    }

    return result;
  }

  private static async executeAction(context: OrchestratorContext, action: OrchestratorAction): Promise<ActionExecutorResult> {
    const { conversationId } = context;
    const result: ActionExecutorResult = { messageSent: false, messageSkipped: false };

    switch (action.type) {
      case "SEND_MESSAGE":
        const sendResult = await this.executeSendMessage(conversationId, action.payload);
        result.messageSent = sendResult.messageSent;
        result.messageSkipped = sendResult.messageSkipped;
        result.skipReason = sendResult.skipReason;
        return result;

      case "TRANSFER_TO_HUMAN":
        await this.executeTransferToHuman(context, action.payload);
        return result;

      case "INSTRUCTION":
        console.log(`[ActionExecutor] INSTRUCTION action: ${action.payload.name}`);
        console.log(`[ActionExecutor] Value: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        return result;

      case "LINK":
        console.log(`[ActionExecutor] LINK action: ${action.payload.name}`);
        console.log(`[ActionExecutor] URL: ${action.payload.url}`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        return result;

      case "API_CALL":
        console.log(`[ActionExecutor] API_CALL action: ${action.payload.name}`);
        console.log(`[ActionExecutor] Endpoint: ${action.payload.endpoint}`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        return result;

      case "INTERNAL_ACTION":
        console.log(`[ActionExecutor] INTERNAL_ACTION: ${action.payload.name}`);
        console.log(`[ActionExecutor] Description: ${action.payload.description}`);
        console.log(`[ActionExecutor] Value: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        return result;

      case "ASK_CUSTOMER":
        console.log(`[ActionExecutor] ASK_CUSTOMER: ${action.payload.name}`);
        console.log(`[ActionExecutor] Question: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        return result;

      default:
        console.log(`[ActionExecutor] Unknown or unsupported action type: ${(action as any).type} - skipping`);
        return result;
    }
  }

  private static async executeSendMessage(
    conversationId: number, 
    payload: { suggestionId: number; responsePreview: string }
  ): Promise<ActionExecutorResult> {
    console.log(`[ActionExecutor] SEND_MESSAGE for conversation ${conversationId}`);
    console.log(`[ActionExecutor] Response preview: "${payload.responsePreview.substring(0, 100)}..."`);

    const isN1ago = await isN1agoHandler(conversationId);
    if (!isN1ago) {
      console.log(`[ActionExecutor] SEND_MESSAGE skipped - handler is not N1ago (observation-only mode)`);
      console.log(`[ActionExecutor] Response saved as suggestion ${payload.suggestionId} but not sent`);
      return { messageSent: false, messageSkipped: true, skipReason: "handler_not_n1ago" };
    }

    console.log(`[ActionExecutor] Sending suggestion ${payload.suggestionId} via AutoPilot`);
    const result = await AutoPilotService.processSuggestion(payload.suggestionId);

    if (result.action === "sent") {
      console.log(`[ActionExecutor] SEND_MESSAGE completed successfully`);
      return { messageSent: true, messageSkipped: false };
    } else {
      console.log(`[ActionExecutor] SEND_MESSAGE not sent - action=${result.action}, reason=${result.reason}`);
      return { messageSent: false, messageSkipped: true, skipReason: result.reason };
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

    const result = await TransferService.transferToHuman({
      conversationId,
      externalConversationId,
      source: "orchestrator",
      reason: payload.reason,
    });

    if (result.success) {
      console.log(`[ActionExecutor] Transfer to human completed successfully`);
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
      console.log(`[ActionExecutor] Status updated to ESCALATED after successful transfer`);
    } else {
      console.error(`[ActionExecutor] Failed to transfer to human: ${result.error}`);
    }
  }
}
