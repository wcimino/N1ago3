import type { ToolDefinition } from "./openaiApiService.js";
import { createKnowledgeBaseTool } from "./tools/knowledgeBaseTool.js";
import { createProductCatalogTool } from "./tools/productCatalogTool.js";
import { createZendeskKnowledgeBaseTool } from "./tools/zendeskKnowledgeBaseTool.js";
import { createSubjectIntentTool } from "./tools/subjectIntentTool.js";

export { createKnowledgeBaseTool } from "./tools/knowledgeBaseTool.js";
export { createProductCatalogTool } from "./tools/productCatalogTool.js";
export { createZendeskKnowledgeBaseTool } from "./tools/zendeskKnowledgeBaseTool.js";
export { createSubjectIntentTool } from "./tools/subjectIntentTool.js";

export interface ToolFlags {
  useKnowledgeBaseTool?: boolean;
  useProductCatalogTool?: boolean;
  useSubjectIntentTool?: boolean;
  useZendeskKnowledgeBaseTool?: boolean;
}

export function buildToolsFromFlags(flags: ToolFlags): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (flags.useKnowledgeBaseTool) {
    tools.push(createKnowledgeBaseTool());
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
  
  return tools;
}
