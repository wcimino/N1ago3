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
];
