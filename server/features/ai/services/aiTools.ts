export interface ToolFlagsContext {
  conversationId?: number;
}

export interface ToolFlags {
  useObjectiveProblemTool?: boolean;
  useCombinedKnowledgeSearchTool?: boolean;
}
