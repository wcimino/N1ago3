export interface PromptVariable {
  name: string;
  description: string;
}

export interface PromptVariableCategory {
  id: string;
  title: string;
  description: string;
  variables: PromptVariable[];
}

export const VARIABLE_CATEGORIES: PromptVariableCategory[] = [
  {
    id: 'system',
    title: 'Dados do Sistema',
    description: 'Listas e catálogos disponíveis no sistema',
    variables: [
      { name: '{{PRODUTOS_E_SUBPRODUTOS_CATALOGO}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
    ],
  },
  {
    id: 'conversation-history',
    title: 'Conversa - Histórico',
    description: 'Resumo e mensagens da conversa atual',
    variables: [
      { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
      { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
      { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
      { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
    ],
  },
  {
    id: 'conversation-classification',
    title: 'Conversa - Classificação',
    description: 'Produto, subproduto e tipo de solicitação da conversa',
    variables: [
      { name: '{{PRODUTO_NOME}}', description: 'Nome do produto classificado' },
      { name: '{{SUBPRODUTO_NOME}}', description: 'Nome do subproduto classificado' },
      { name: '{{PRODUTO_E_SUBPRODUTO_NOME}}', description: 'Produto e Subproduto classificados (formato: Produto / Subproduto)' },
      { name: '{{TIPO_SOLICITACAO_NOME}}', description: 'Tipo de solicitação (Quer suporte/contratar/informações)' },
      { name: '{{PRODUTO_JSON}}', description: 'Produto com nome e score em JSON' },
      { name: '{{SUBPRODUTO_JSON}}', description: 'Subproduto com nome e score em JSON' },
      { name: '{{TIPO_SOLICITACAO_JSON}}', description: 'Tipo de solicitação com nome e score em JSON' },
    ],
  },
  {
    id: 'knowledge-base',
    title: 'Conversa - Base de Conhecimento',
    description: 'Artigos e matches encontrados na base de conhecimento',
    variables: [
      { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_5}}', description: 'Top 5 artigos e problemas da base de conhecimento' },
      { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_10}}', description: 'Top 10 artigos e problemas da base de conhecimento' },
      { name: '{{TIPO_DE_DEMANDA_MATCH}}', description: 'Tipo de demanda identificado com match' },
      { name: '{{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH}}', description: 'Artigo ou problema principal com melhor match' },
    ],
  },
  {
    id: 'agents',
    title: 'Conversa - Saídas de Agentes',
    description: 'Resultados gerados pelos agentes de IA',
    variables: [
      { name: '{{DEMANDA_IDENTIFICADA}}', description: 'Demanda identificada pelo DemandFinder' },
      { name: '{{SUGESTAO_RESPOSTA}}', description: 'Sugestão de resposta do SolutionProvider (para ajuste de tom)' },
    ],
  },
  {
    id: 'solutions',
    title: 'Soluções',
    description: 'Dados da Central de Soluções',
    variables: [
      { name: '{{SOLUCAO_ID}}', description: 'ID da solução/demanda identificada pelo DemandFinder' },
      { name: '{{SOLUCAO_NOME}}', description: 'Nome da solução/demanda identificada' },
      { name: '{{SOLUCAO_DESCRICAO}}', description: 'Descrição/razão da seleção da solução' },
      { name: '{{SOLUCAO_ACOES}}', description: 'JSON com lista de ações da solução' },
    ],
  },
];

export const AVAILABLE_VARIABLES: PromptVariable[] = VARIABLE_CATEGORIES.flatMap(
  (category) => category.variables
);
