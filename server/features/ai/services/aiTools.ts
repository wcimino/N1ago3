import type { ToolDefinition } from "./openaiApiService.js";
import { createKnowledgeBaseArticlesTool } from "./tools/knowledgeBaseTool.js";
import { createSubjectIntentTool } from "./tools/subjectIntentTool.js";
import { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
import { createCombinedKnowledgeSearchToolWithContext } from "./tools/combinedKnowledgeSearchTool.js";

export { createKnowledgeBaseArticlesTool } from "./tools/knowledgeBaseTool.js";
export { createSubjectIntentTool } from "./tools/subjectIntentTool.js";
export { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
export { createCombinedKnowledgeSearchToolWithContext as createCombinedKnowledgeSearchTool } from "./tools/combinedKnowledgeSearchTool.js";

export interface ToolFlagsContext {
  conversationId?: number;
}

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useSubjectIntentTool?: boolean;
  useObjectiveProblemTool?: boolean;
  useCombinedKnowledgeSearchTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags, context?: ToolFlagsContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useKnowledgeBaseTool) {
    tools.push(createKnowledgeBaseArticlesTool());
  }
  
  if (flags.useSubjectIntentTool) {
    tools.push(createSubjectIntentTool());
  }
  
  if (flags.useObjectiveProblemTool) {
    tools.push(createProblemObjectiveTool());
  }
  
  if (flags.useCombinedKnowledgeSearchTool) {
    tools.push(createCombinedKnowledgeSearchToolWithContext(context?.conversationId));
  }
  
  return tools;
}
