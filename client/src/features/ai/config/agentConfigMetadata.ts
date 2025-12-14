export type AgentConfigType = "summary" | "classification" | "response" | "learning" | "enrichment" | "demand_finder" | "solution_provider";

export interface AgentToolsConfig {
  showKnowledgeBaseTool?: boolean;
  showProductCatalogTool?: boolean;
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
  eventTriggerLabel: string;
  eventTriggerDescription: string;
  authorFilterDescription: string;
  promptRows: number;
  responseFormatRows: number;
  recommendedModel: string;
  tools: AgentToolsConfig;
}

const allToolsEnabled: AgentToolsConfig = {
  showKnowledgeBaseTool: true,
  showProductCatalogTool: true,
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
    eventTriggerLabel: "Eventos que disparam a geração de resumo",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar a geração de um novo resumo",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a geração de resumo. Se nenhum for selecionado, todos os autores serão considerados.",
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
    eventTriggerLabel: "Eventos que disparam a classificação",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar uma nova classificação",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a classificação. Se nenhum for selecionado, todos os autores serão considerados.",
    promptRows: 16,
    responseFormatRows: 6,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  response: {
    configType: "response",
    title: "Configuração de Sugestão de Resposta",
    description: "Configure a geração automática de sugestões de resposta para os atendentes",
    enabledLabel: "Ativar sugestão de resposta",
    enabledDescription: "Quando ativado, respostas serão sugeridas automaticamente",
    eventTriggerLabel: "Eventos que disparam a sugestão",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar uma nova sugestão de resposta",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a sugestão. Normalmente, você vai querer gerar sugestões quando o cliente envia uma mensagem.",
    promptRows: 20,
    responseFormatRows: 4,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  learning: {
    configType: "learning",
    title: "Configuração de Aprendizado",
    description: "Configure a extração automática de conhecimento das conversas para enriquecer a base de conhecimento",
    enabledLabel: "Ativar extração de conhecimento",
    enabledDescription: "Quando ativado, conhecimento será extraído automaticamente das conversas",
    eventTriggerLabel: "Eventos que disparam a extração",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar a extração de conhecimento. Recomendado: conversas encerradas ou transferências",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a extração. Se nenhum for selecionado, todos os autores serão considerados.",
    promptRows: 24,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o-mini",
    tools: allToolsEnabled,
  },

  enrichment: {
    configType: "enrichment",
    title: "Configuração de Enriquecimento",
    description: "Configure a geração de sugestões de melhoria para artigos da base de conhecimento usando artigos do Zendesk como referência",
    enabledLabel: "Ativar geração de sugestões de melhoria",
    enabledDescription: "Quando ativado, permite gerar sugestões comparando artigos da base de conhecimento com artigos do Zendesk",
    eventTriggerLabel: "Eventos que disparam o enriquecimento",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar a geração de sugestões (opcional - pode ser executado manualmente)",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar o enriquecimento. Se nenhum for selecionado, todos os autores serão considerados.",
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
    eventTriggerLabel: "Eventos que disparam o Demand Finder",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar a identificação de demanda (gerenciado pelo ConversationOrchestrator)",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a identificação. Se nenhum for selecionado, todos os autores serão considerados.",
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
    eventTriggerLabel: "Eventos que disparam o Solution Provider",
    eventTriggerDescription: "Selecione os tipos de eventos que devem disparar a geração de soluções (gerenciado pelo ConversationOrchestrator)",
    authorFilterDescription: "Selecione quais tipos de autor devem disparar a geração. Se nenhum for selecionado, todos os autores serão considerados.",
    promptRows: 20,
    responseFormatRows: 8,
    recommendedModel: "gpt-4o",
    tools: allToolsEnabled,
  },
};

export function getAgentConfig(configType: AgentConfigType): AgentConfigMetadata {
  return agentConfigMetadata[configType];
}
