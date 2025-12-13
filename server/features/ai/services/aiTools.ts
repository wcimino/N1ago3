import type { ToolDefinition } from "./openaiApiService.js";
import { createKnowledgeBaseArticlesTool } from "./tools/knowledgeBaseTool.js";
import { createProductCatalogTool } from "./tools/productCatalogTool.js";
import { createZendeskKnowledgeBaseTool, type ZendeskSearchContext } from "./tools/zendeskKnowledgeBaseTool.js";
import { createSubjectIntentTool } from "./tools/subjectIntentTool.js";
import { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
import { createCombinedKnowledgeSearchTool } from "./tools/combinedKnowledgeSearchTool.js";

export { createKnowledgeBaseArticlesTool } from "./tools/knowledgeBaseTool.js";
export { createProductCatalogTool } from "./tools/productCatalogTool.js";
export { createZendeskKnowledgeBaseTool, type ZendeskSearchContext } from "./tools/zendeskKnowledgeBaseTool.js";
export { createSubjectIntentTool } from "./tools/subjectIntentTool.js";
export { createProblemObjectiveTool } from "./tools/problemObjectiveTool.js";
export { createCombinedKnowledgeSearchTool } from "./tools/combinedKnowledgeSearchTool.js";

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useProductCatalogTool?: boolean;
  useSubjectIntentTool?: boolean;
  useZendeskKnowledgeBaseTool?: boolean;
  useObjectiveProblemTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useKnowledgeBaseTool) {
    tools.push(createKnowledgeBaseArticlesTool());
  }
  
  if (flags.useProductCatalogTool) {
    tools.push(createProductCatalogTool());
  }
  
  if (flags.useSubjectIntentTool) {
    tools.push(createSubjectIntentTool());
  }
  
  if (flags.useZendeskKnowledgeBaseTool) {
    tools.push(createZendeskKnowledgeBaseTool());
  }
  
  if (flags.useObjectiveProblemTool) {
    tools.push(createProblemObjectiveTool());
  }
  
  return tools;
}
