import { conversationStorage } from "../../../conversations/storage/index.js";
import { AutoPilotService } from "../../../autoPilot/services/autoPilotService.js";
import { TransferService } from "../../../routing/services/transferService.js";
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

      case "INSTRUCTION":
        console.log(`[ActionExecutor] INSTRUCTION action: ${action.payload.name}`);
        console.log(`[ActionExecutor] Value: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        break;

      case "LINK":
        console.log(`[ActionExecutor] LINK action: ${action.payload.name}`);
        console.log(`[ActionExecutor] URL: ${action.payload.url}`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        break;

      case "API_CALL":
        console.log(`[ActionExecutor] API_CALL action: ${action.payload.name}`);
        console.log(`[ActionExecutor] Endpoint: ${action.payload.endpoint}`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        break;

      case "INTERNAL_ACTION":
        console.log(`[ActionExecutor] INTERNAL_ACTION: ${action.payload.name}`);
        console.log(`[ActionExecutor] Description: ${action.payload.description}`);
        console.log(`[ActionExecutor] Value: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
        break;

      case "QUERY_CUSTOMER_PROFILE":
        await this.executeQueryCustomerProfile(context, action.payload);
        break;

      case "ASK_CUSTOMER":
        console.log(`[ActionExecutor] ASK_CUSTOMER: ${action.payload.name}`);
        console.log(`[ActionExecutor] Question: ${action.payload.value?.substring(0, 100)}...`);
        if (action.payload.agentInstructions) {
          console.log(`[ActionExecutor] Agent Instructions: ${action.payload.agentInstructions.substring(0, 100)}...`);
        }
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

  private static async executeQueryCustomerProfile(
    context: OrchestratorContext,
    payload: { caseActionId: number; name: string; description: string; agentInstructions?: string }
  ): Promise<void> {
    const { conversationId } = context;
    console.log(`[ActionExecutor] QUERY_CUSTOMER_PROFILE: ${payload.name}`);
    console.log(`[ActionExecutor] Description: ${payload.description}`);
    if (payload.agentInstructions) {
      console.log(`[ActionExecutor] Agent Instructions: ${payload.agentInstructions.substring(0, 100)}...`);
    }

    const clientHubData = await conversationStorage.getClientHubData(conversationId);

    if (clientHubData) {
      console.log(`[ActionExecutor] Client Hub Data found for conversation ${conversationId}`);
      console.log(`[ActionExecutor] CNPJ: ${clientHubData.cnpj || "N/A"}`);
      console.log(`[ActionExecutor] CNPJ Valid: ${clientHubData.cnpjValido ?? "N/A"}`);
      console.log(`[ActionExecutor] Fields count: ${clientHubData.campos ? Object.keys(clientHubData.campos).length : 0}`);
      console.log(`[ActionExecutor] Fetched at: ${clientHubData.fetchedAt || "N/A"}`);
      
      context.providedInputs = {
        ...(context.providedInputs || {}),
        clientHubData,
      };
    } else {
      console.log(`[ActionExecutor] No Client Hub Data found for conversation ${conversationId}`);
    }
  }
}
