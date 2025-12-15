export interface PromptVariable {
  name: string;
  description: string;
}

export const AVAILABLE_VARIABLES: PromptVariable[] = [
  { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
  { name: '{{RESUMO_ATUAL}}', description: 'Resumo anterior (para atualização)' },
  { name: '{{PRODUCTS_AND_SUBPRODUCTS}}', description: 'Produto e Subproduto classificados da conversa' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
  { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
  { name: '{{TIPO_SOLICITACAO}}', description: 'Tipo de solicitação (Quer suporte/contratar/informações)' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_5}}', description: 'Top 5 artigos e problemas da base de conhecimento' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_10}}', description: 'Top 10 artigos e problemas da base de conhecimento' },
  { name: '{{PRODUTO_E_SUBPRODUTO_MATCH}}', description: 'Produto e Subproduto identificados com match na base' },
  { name: '{{TIPO_DE_DEMANDA_MATCH}}', description: 'Tipo de demanda identificado com match' },
];
