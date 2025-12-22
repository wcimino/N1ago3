import type { ToolDefinition } from "./openaiApiService.js";
import { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
import { createCombinedKnowledgeSearchToolWithContext } from "./tools/combinedKnowledgeSearchTool.js";

export { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
export { createCombinedKnowledgeSearchToolWithContext as createCombinedKnowledgeSearchTool } from "./tools/combinedKnowledgeSearchTool.js";

export interface ToolFlagsContext {
  conversationId?: number;
}

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useSubjectIntentTool?: boolean;
  useZendeskKnowledgeBaseTool?: boolean;
  useObjectiveProblemTool?: boolean;
  useCombinedKnowledgeSearchTool?: boolean;
  useKnowledgeSuggestionTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags, context?: ToolFlagsContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useObjectiveProblemTool) {
    tools.push(createProblemObjectiveTool());
  }
  
  if (flags.useCombinedKnowledgeSearchTool) {
    tools.push(createCombinedKnowledgeSearchToolWithContext(context?.conversationId));
  }
  
  return tools;
}
