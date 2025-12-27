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
      { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
      { name: '{{PRODUTO_SUBPRODUTO_ASSUNTO}}', description: 'JSON de assuntos agrupados por produto/subproduto' },
      { name: '{{PERGUNTAS}}', description: 'Lista de perguntas para classificação de temas' },
    ],
  },
  {
    id: 'conversation-history',
    title: 'Conversa - Histórico',
    description: 'Resumo e mensagens da conversa atual',
    variables: [
      { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
      { name: '{{RESUMO_ATUAL}}', description: 'Resumo anterior (para atualização)' },
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
      { name: '{{PRODUCTS_AND_SUBPRODUCTS}}', description: 'Produto e Subproduto classificados da conversa' },
      { name: '{{PRODUCTS_AND_SUBPRODUCTS_ID}}', description: 'IDs do Produto e Subproduto classificados' },
      { name: '{{TIPO_SOLICITACAO}}', description: 'Tipo de solicitação (Quer suporte/contratar/informações)' },
      { name: '{{PRODUTO_NOME}}', description: 'Nome do produto classificado' },
      { name: '{{SUBPRODUTO_NOME}}', description: 'Nome do subproduto classificado' },
    ],
  },
  {
    id: 'knowledge-base',
    title: 'Conversa - Base de Conhecimento',
    description: 'Artigos e matches encontrados na base de conhecimento',
    variables: [
      { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_5}}', description: 'Top 5 artigos e problemas da base de conhecimento' },
      { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_10}}', description: 'Top 10 artigos e problemas da base de conhecimento' },
      { name: '{{PRODUTO_E_SUBPRODUTO_MATCH}}', description: 'Produto e Subproduto identificados com match na base' },
      { name: '{{TIPO_DE_DEMANDA_MATCH}}', description: 'Tipo de demanda identificado com match' },
      { name: '{{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH}}', description: 'Artigo ou problema principal com melhor match' },
      { name: '{{RESULTADOS_BUSCA}}', description: 'Resultados da busca na base de conhecimento' },
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
  {
    id: 'conditionals',
    title: 'Blocos Condicionais',
    description: 'Estruturas para exibir conteúdo condicionalmente',
    variables: [
      { name: '{{#if_artigo_existe}}...{{/if_artigo_existe}}', description: 'Exibe conteúdo se artigo existe' },
      { name: '{{#if_artigo_nao_existe}}...{{/if_artigo_nao_existe}}', description: 'Exibe conteúdo se artigo não existe' },
      { name: '{{#if_intencao_sinonimos}}...{{/if_intencao_sinonimos}}', description: 'Exibe se há sinônimos de intenção' },
      { name: '{{#if_assunto_sinonimos}}...{{/if_assunto_sinonimos}}', description: 'Exibe se há sinônimos de assunto' },
      { name: '{{#if_subproduto_nome}}...{{/if_subproduto_nome}}', description: 'Exibe se há nome de subproduto' },
    ],
  },
];

export const AVAILABLE_VARIABLES: PromptVariable[] = VARIABLE_CATEGORIES.flatMap(
  (category) => category.variables
);
