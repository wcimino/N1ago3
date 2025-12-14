import { storage } from "../../../../../storage/index.js";
import { callOpenAI } from "../../openaiApiService.js";
import { generalSettingsStorage } from "../../../storage/generalSettingsStorage.js";
import { runCombinedKnowledgeSearch } from "../../tools/combinedKnowledgeSearchTool.js";
import type { DemandFinderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "demand_finder";

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { event, conversationId, summary, classification } = context;

    try {
      const config = await storage.getOpenaiApiConfig(CONFIG_KEY);
      
      if (!config || !config.enabled) {
        console.log(`[DemandFinderAgent] Disabled or no config for conversation ${conversationId}`);
        return { 
          success: true, 
          demandIdentified: false,
          needsMoreInfo: true,
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

      const userPrompt = `
## Contexto da Conversa
${summary ? `### Resumo Atual:\n${summary}\n` : ""}
${classification?.product ? `### Produto: ${classification.product}` : ""}
${classification?.subject ? `### Assunto: ${classification.subject}` : ""}
${classification?.intent ? `### Intenção: ${classification.intent}` : ""}

### Mensagens Recentes:
${conversationContext}

### Nova Mensagem:
[${event.authorType}] ${event.authorName || "Unknown"}: ${event.contentText || ""}

Analise a conversa e identifique qual é a demanda/necessidade do cliente. Se precisar de mais informações, indique qual pergunta fazer.
`;

      console.log(`[DemandFinderAgent] Processing conversation ${conversationId} with ${reversedMessages.length} messages`);

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
          demandIdentified: false,
          error: response.error || "Failed to call OpenAI",
        };
      }

      let searchResults: DemandFinderAgentResult["searchResults"] = undefined;

      if (config.useCombinedKnowledgeSearchTool && response.toolResult) {
        try {
          const toolData = response.toolResult;
          if (toolData.results && Array.isArray(toolData.results)) {
            searchResults = toolData.results.map((r: any) => ({
              source: r.source,
              id: r.id,
              name: r.name || "",
              description: r.description,
              matchScore: r.matchScore,
            }));
          }
        } catch (e: any) {
          console.error(`[DemandFinderAgent] Tool result parsing error:`, e);
        }
      }

      let parsedContent: any = {};
      if (response.responseContent) {
        try {
          parsedContent = JSON.parse(response.responseContent);
        } catch {
          parsedContent = { demand: response.responseContent, demandIdentified: true };
        }
      }

      return {
        success: true,
        demandIdentified: parsedContent.demandIdentified ?? (!!parsedContent.demand),
        demand: parsedContent.demand,
        searchResults,
        needsMoreInfo: parsedContent.needsMoreInfo ?? false,
        followUpQuestion: parsedContent.followUpQuestion,
      };
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        demandIdentified: false,
        error: error.message || "Failed to find demand",
      };
    }
  }
}
