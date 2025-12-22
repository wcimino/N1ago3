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
