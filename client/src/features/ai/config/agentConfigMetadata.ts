export type AgentConfigType = "summary" | "classification" | "response" | "demand_finder" | "solution_provider" | "topic_classification" | "closer";

export interface AgentToolsConfig {
  showZendeskKnowledgeBaseTool?: boolean;
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
  showZendeskKnowledgeBaseTool: true,
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

  demand_finder: {
    configType: "demand_finder",
    title: "Configuração do Demand Finder",
    description: "Configure o agente que identifica e entende qual é a demanda/necessidade do cliente na conversa. Usa a Central de Soluções para buscar artigos e problemas.",
    enabledLabel: "Ativar Demand Finder",
    enabledDescription: "Quando ativado, o sistema identifica automaticamente o que o cliente precisa",
    promptRows: 20,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o",
    tools: {},
  },

  solution_provider: {
    configType: "solution_provider",
    title: "Configuração do Solution Provider",
    description: "Configure o agente que fornece soluções para as demandas identificadas pelo Demand Finder",
    enabledLabel: "Ativar Solution Provider",
    enabledDescription: "Quando ativado, o sistema gera soluções automaticamente para as demandas identificadas",
    promptRows: 20,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o",
    tools: {},
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
