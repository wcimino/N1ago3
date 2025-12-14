import { storage } from "../../../../../storage/index.js";
import { callOpenAI } from "../../openaiApiService.js";
import { generalSettingsStorage } from "../../../storage/generalSettingsStorage.js";
import type { SolutionProviderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "solution_provider";

export class SolutionProviderAgent {
  static async process(context: OrchestratorContext): Promise<SolutionProviderAgentResult> {
    const { event, conversationId, summary, classification, demand, searchResults } = context;

    try {
      const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
      
      if (!config || !config.enabled) {
        console.log(`[SolutionProviderAgent] Disabled or no config for conversation ${conversationId}, skipping`);
        return { 
          success: true, 
          resolved: false,
          needsEscalation: false,
        };
      }

      const last20Messages = await storage.getLast20MessagesForConversation(conversationId);
      const reversedMessages = [...last20Messages].reverse();

      let effectivePromptSystem = config.promptSystem || "";
      if (config.useGeneralSettings) {
        const generalSettings = await generalSettingsStorage.getConcatenatedContent();
        if (generalSettings) {
          effectivePromptSystem = generalSettings + "\n\n" + effectivePromptSystem;
        }
      }

      const conversationContext = reversedMessages.map(m => 
        `[${m.authorType}] ${m.authorName || "Unknown"}: ${m.contentText || ""}`
      ).join("\n");

      const knowledgeContext = searchResults && searchResults.length > 0
        ? searchResults.map(r => `- [${r.source}] ${r.name}: ${r.description}`).join("\n")
        : "Nenhum artigo encontrado na base de conhecimento.";

      const userPrompt = `
## Contexto da Conversa
${summary ? `### Resumo:\n${summary}\n` : ""}
${classification?.product ? `### Produto: ${classification.product}` : ""}
${classification?.subject ? `### Assunto: ${classification.subject}` : ""}
${classification?.intent ? `### Intenção: ${classification.intent}` : ""}
${demand ? `### Demanda Identificada:\n${demand}\n` : ""}

### Base de Conhecimento Relevante:
${knowledgeContext}

### Mensagens Recentes:
${conversationContext}

### Nova Mensagem:
[${event.authorType}] ${event.authorName || "Unknown"}: ${event.contentText || ""}

Com base na demanda do cliente e no conhecimento disponível, forneça uma solução adequada. Se não for possível resolver, indique que precisa de escalação humana.
`;

      console.log(`[SolutionProviderAgent] Processing conversation ${conversationId}`);

      const toolFlags = {
        useKnowledgeBaseTool: config.useKnowledgeBaseTool ?? false,
        useProductCatalogTool: config.useProductCatalogTool ?? false,
        useSubjectIntentTool: config.useSubjectIntentTool ?? false,
        useZendeskKnowledgeBaseTool: config.useZendeskKnowledgeBaseTool ?? false,
        useObjectiveProblemTool: config.useObjectiveProblemTool ?? false,
        useCombinedKnowledgeSearchTool: config.useCombinedKnowledgeSearchTool ?? false,
      };

      const response = await callOpenAI({
        requestType: CONFIG_KEY,
        modelName: config.modelName || "gpt-4o",
        promptSystem: effectivePromptSystem,
        promptUser: userPrompt,
        contextType: "conversation",
        contextId: String(conversationId),
        toolFlags,
      });

      if (!response.success) {
        return {
          success: false,
          resolved: false,
          needsEscalation: true,
          error: response.error || "Failed to call OpenAI",
        };
      }

      let parsedContent: any = {};
      if (response.responseContent) {
        try {
          parsedContent = JSON.parse(response.responseContent);
        } catch {
          parsedContent = { 
            solution: response.responseContent, 
            resolved: true,
            needsEscalation: false,
            suggestedResponse: response.responseContent,
          };
        }
      }

      return {
        success: true,
        resolved: parsedContent.resolved ?? true,
        solution: parsedContent.solution,
        confidence: parsedContent.confidence,
        needsEscalation: parsedContent.needsEscalation ?? false,
        escalationReason: parsedContent.escalationReason,
        suggestedResponse: parsedContent.suggestedResponse,
      };
    } catch (error: any) {
      console.error(`[SolutionProviderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        resolved: false,
        needsEscalation: true,
        error: error.message || "Failed to provide solution",
      };
    }
  }
}
