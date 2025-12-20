export type AgentConfigType = "summary" | "classification" | "response" | "enrichment" | "article_enrichment" | "demand_finder" | "solution_provider" | "topic_classification" | "closer";

export interface AgentToolsConfig {
  showKnowledgeBaseTool?: boolean;
  showZendeskKnowledgeBaseTool?: boolean;
  showSubjectIntentTool?: boolean;
  showObjectiveProblemTool?: boolean;
  showCombinedKnowledgeSearchTool?: boolean;
}

export interface AgentConfigMetadata {
  configType: AgentConfigType;
  title: string;
  description: string;
  enabledLabel: string;
  enabledDescription: string;
  promptRows: number;
  responseFormatRows: number;
  recommendedModel: string;
  tools: AgentToolsConfig;
}

const allToolsEnabled: AgentToolsConfig = {
  showKnowledgeBaseTool: true,
  showZendeskKnowledgeBaseTool: true,
  showSubjectIntentTool: true,
  showObjectiveProblemTool: true,
  showCombinedKnowledgeSearchTool: true,
};

export const agentConfigMetadata: Record<AgentConfigType, AgentConfigMetadata> = {
  summary: {
    configType: "summary",
    title: "Configuração do Resumo com OpenAI",
    description: "Configure a geração automática de resumos das conversas",
    enabledLabel: "Ativar geração de resumos",
    enabledDescription: "Quando ativado, resumos serão gerados automaticamente",
    promptRows: 16,
    responseFormatRows: 10,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  classification: {
    configType: "classification",
    title: "Configuração da Classificação de Produto",
    description: "Configure a classificação automática de produto e intenção das conversas",
    enabledLabel: "Ativar classificação",
    enabledDescription: "Quando ativado, conversas serão classificadas automaticamente",
    promptRows: 16,
    responseFormatRows: 6,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  response: {
    configType: "response",
    title: "Configuração de Sugestão de Resposta",
    description: "Configure a geração automática de sugestões de resposta e o ajuste de tom de voz para mensagens enviadas ao cliente",
    enabledLabel: "Ativar sugestão de resposta",
    enabledDescription: "Quando ativado, respostas serão sugeridas automaticamente e mensagens serão formatadas com o tom de voz configurado antes de enviar ao cliente",
    promptRows: 20,
    responseFormatRows: 4,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  enrichment: {
    configType: "enrichment",
    title: "Configuração de Enriquecimento (Legado)",
    description: "Configure a geração de sugestões de melhoria para artigos da base de conhecimento usando artigos do Zendesk como referência. Use 'Article Enrichment' para a nova implementação.",
    enabledLabel: "Ativar geração de sugestões de melhoria",
    enabledDescription: "Quando ativado, permite gerar sugestões comparando artigos da base de conhecimento com artigos do Zendesk",
    promptRows: 24,
    responseFormatRows: 12,
    recommendedModel: "gpt-4o",
    tools: allToolsEnabled,
  },

  article_enrichment: {
    configType: "article_enrichment",
    title: "Configuração de Enriquecimento de Artigos",
    description: "Configure a geração de sugestões de melhoria para artigos da base de conhecimento usando artigos do Zendesk como referência",
    enabledLabel: "Ativar geração de sugestões de melhoria",
    enabledDescription: "Quando ativado, permite gerar sugestões comparando artigos da base de conhecimento com artigos do Zendesk",
    promptRows: 24,
    responseFormatRows: 12,
    recommendedModel: "gpt-4o",
    tools: allToolsEnabled,
  },

  demand_finder: {
    configType: "demand_finder",
    title: "Configuração do Demand Finder",
    description: "Configure o agente que identifica e entende qual é a demanda/necessidade do cliente na conversa",
    enabledLabel: "Ativar Demand Finder",
    enabledDescription: "Quando ativado, o sistema identifica automaticamente o que o cliente precisa",
    promptRows: 20,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o",
    tools: allToolsEnabled,
  },

  solution_provider: {
    configType: "solution_provider",
    title: "Configuração do Solution Provider",
    description: "Configure o agente que fornece soluções para as demandas identificadas do cliente",
    enabledLabel: "Ativar Solution Provider",
    enabledDescription: "Quando ativado, o sistema sugere soluções baseadas na demanda identificada",
    promptRows: 20,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o",
    tools: allToolsEnabled,
  },

  topic_classification: {
    configType: "topic_classification",
    title: "Classificação de Temas",
    description: "Configure o agente que classifica perguntas dos clientes em temas para análise de relatórios",
    enabledLabel: "Ativar Classificação de Temas",
    enabledDescription: "Quando ativado, o sistema classifica perguntas em temas para relatórios analíticos",
    promptRows: 16,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o-mini",
    tools: {},
  },

  closer: {
    configType: "closer",
    title: "Configuração do Closer (Finalizador)",
    description: "Configure o agente que finaliza atendimentos, perguntando se o cliente precisa de mais ajuda e encerrando ou abrindo nova demanda",
    enabledLabel: "Ativar Closer",
    enabledDescription: "Quando ativado, o sistema pergunta se pode ajudar em mais alguma coisa após resolver uma demanda",
    promptRows: 16,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o-mini",
    tools: {},
  },
};

export function getAgentConfig(configType: AgentConfigType): AgentConfigMetadata {
  return agentConfigMetadata[configType];
}
