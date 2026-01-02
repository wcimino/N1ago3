import { ZendeskApiService } from "../../external-sources/zendesk/services/zendeskApiService.js";
import { SendMessageService } from "../../send-message/services/sendMessageService.js";
import { conversationStorage } from "../../conversations/storage/conversationStorage.js";
import { TargetResolver, type ValidTarget } from "./targetResolver.js";

export type TransferSource = "manual_transfer" | "orchestrator" | "routing" | "inbound_routing";

export interface TransferOptions {
  conversationId: number;
  externalConversationId: string;
  target: ValidTarget;
  source: TransferSource;
  reason?: string;
  tags?: string[];
  skipFarewell?: boolean;
  skipWelcome?: boolean;
  skipTags?: boolean;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  farewellSent?: boolean;
  welcomeSent?: boolean;
  tagsAdded?: boolean;
  handlerUpdated?: boolean;
}

const DEFAULT_N1AGO_WELCOME_MESSAGE = "Olá! Sou o Niago, assistente virtual do iFood Pago. Como posso ajudar você hoje?";
const DEFAULT_HUMAN_FAREWELL_MESSAGE = "Vou te transferir para um humano continuar o atendimento, aguarde um momento...";
const DEFAULT_N1AGO_TAGS = ["teste_n1ago"];

async function transfer(options: TransferOptions): Promise<TransferResult> {
  const {
    conversationId,
    externalConversationId,
    target,
    source,
    reason,
    tags,
    skipFarewell = false,
    skipWelcome = false,
    skipTags = false,
  } = options;

  const result: TransferResult = {
    success: false,
  };

  const contextId = `conversation:${conversationId}`;
  const isTargetN1ago = TargetResolver.isN1ago(target);
  const isTargetHuman = TargetResolver.isHuman(target);

  console.log(`[TransferService] Starting transfer for conversation ${conversationId} to ${target} (source: ${source})`);

  try {
    if (!skipFarewell && isTargetHuman) {
      console.log(`[TransferService] Sending farewell message before transfer to human`);
      const sendResult = await SendMessageService.send({
        conversationId,
        externalConversationId,
        message: DEFAULT_HUMAN_FAREWELL_MESSAGE,
        type: "transfer",
        source: "orchestrator",
        skipFormatting: true,
      });
      result.farewellSent = sendResult.sent;
      if (sendResult.sent) {
        console.log(`[TransferService] Farewell message sent successfully`);
      } else {
        console.log(`[TransferService] Farewell message not sent: ${sendResult.reason}`);
      }
    }

    const targetIntegrationId = TargetResolver.getIntegrationId(target);
    if (!targetIntegrationId) {
      result.error = `Could not resolve integration ID for target: ${target}`;
      console.error(`[TransferService] ${result.error}`);
      return result;
    }

    const passControlResult = await ZendeskApiService.passControl(
      externalConversationId,
      targetIntegrationId,
      { reason: reason || `transfer_to_${target}`, source },
      source,
      contextId
    );

    if (!passControlResult.success) {
      result.error = `passControl failed: ${passControlResult.error}`;
      console.error(`[TransferService] ${result.error}`);
      return result;
    }

    console.log(`[TransferService] passControl succeeded for conversation ${conversationId}`);

    const handlerName = TargetResolver.getHandlerName(target);
    try {
      await conversationStorage.updateConversationHandler(
        externalConversationId,
        targetIntegrationId,
        handlerName || target
      );
      result.handlerUpdated = true;
      console.log(`[TransferService] Handler updated to ${handlerName || target} for conversation ${conversationId}`);
    } catch (handlerError) {
      const errorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
      result.error = `Failed to update handler: ${errorMessage}`;
      result.handlerUpdated = false;
      console.error(`[TransferService] ${result.error}`);
      return result;
    }

    if (!skipTags && isTargetN1ago) {
      const tagsToAdd = tags || DEFAULT_N1AGO_TAGS;
      const tagResult = await ZendeskApiService.addConversationTags(
        externalConversationId,
        tagsToAdd,
        source,
        contextId
      );
      result.tagsAdded = tagResult.success;
      if (tagResult.success) {
        console.log(`[TransferService] Tags ${tagsToAdd.join(", ")} added to conversation ${conversationId}`);
      } else {
        console.error(`[TransferService] Failed to add tags to conversation ${conversationId}: ${tagResult.error}`);
      }
    }

    if (!skipWelcome && isTargetN1ago) {
      const welcomeResult = await ZendeskApiService.sendMessage(
        externalConversationId,
        DEFAULT_N1AGO_WELCOME_MESSAGE,
        source,
        contextId
      );
      result.welcomeSent = welcomeResult.success;
      if (welcomeResult.success) {
        console.log(`[TransferService] Welcome message sent to conversation ${conversationId}`);
      } else {
        console.error(`[TransferService] Failed to send welcome message to conversation ${conversationId}: ${welcomeResult.error}`);
      }
    }

    result.success = true;
    console.log(`[TransferService] Transfer completed successfully for conversation ${conversationId}`);
    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`[TransferService] Transfer failed for conversation ${conversationId}:`, error);
    return result;
  }
}

async function transferToHuman(options: {
  conversationId: number;
  externalConversationId: string;
  source: TransferSource;
  reason?: string;
}): Promise<TransferResult> {
  return transfer({
    conversationId: options.conversationId,
    externalConversationId: options.externalConversationId,
    target: "human",
    source: options.source,
    reason: options.reason,
  });
}

async function transferToN1ago(options: {
  conversationId: number;
  externalConversationId: string;
  source: TransferSource;
  reason?: string;
  tags?: string[];
}): Promise<TransferResult> {
  return transfer({
    conversationId: options.conversationId,
    externalConversationId: options.externalConversationId,
    target: "n1ago",
    source: options.source,
    reason: options.reason,
    tags: options.tags,
  });
}

async function transferToBot(options: {
  conversationId: number;
  externalConversationId: string;
  source: TransferSource;
  reason?: string;
}): Promise<TransferResult> {
  return transfer({
    conversationId: options.conversationId,
    externalConversationId: options.externalConversationId,
    target: "bot",
    source: options.source,
    reason: options.reason,
    skipWelcome: true,
    skipTags: true,
  });
}

export const TransferService = {
  transfer,
  transferToHuman,
  transferToN1ago,
  transferToBot,
  DEFAULT_N1AGO_WELCOME_MESSAGE,
  DEFAULT_HUMAN_FAREWELL_MESSAGE,
  DEFAULT_N1AGO_TAGS,
};
