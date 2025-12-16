export interface PromptVariables {
  resumo?: string | null;
  productsAndSubproducts?: string | null;
  productsAndSubproductsId?: string | null;
  ultimas20Mensagens?: string | null;
  ultimaMensagem?: string | null;
  handler?: string | null;
  resumoAtual?: string | null;
  catalogoProdutosSubprodutos?: string | null;
  tipoSolicitacao?: string | null;
  demandaIdentificada?: string | null;
  resultadosBusca?: string | null;
  artigosProblemasListaTop5?: string | null;
  artigosProblemasListaTop10?: string | null;
  produtoESubprodutoMatch?: string | null;
  tipoDeDemandaMatch?: string | null;
  artigoOuProblemaPrincipalMatch?: string | null;
  customVariables?: Record<string, string>;
}

function extractClientRequest(summary: string | null | undefined): string {
  if (!summary) return '';
  try {
    const parsed = JSON.parse(summary);
    if (parsed && typeof parsed.clientRequest === 'string') {
      return parsed.clientRequest;
    }
  } catch {
  }
  return summary;
}

export function replacePromptVariables(
  prompt: string,
  variables: PromptVariables
): string {
  let result = prompt;

  result = result.replace(/\{\{RESUMO\}\}/g, extractClientRequest(variables.resumo) || 'Nenhum resumo disponível.');
  result = result.replace(/\{\{RESUMO_ATUAL\}\}/g, extractClientRequest(variables.resumoAtual) || extractClientRequest(variables.resumo) || 'Nenhum resumo anterior disponível.');
  result = result.replace(/\{\{PRODUCTS_AND_SUBPRODUCTS\}\}/g, variables.productsAndSubproducts || 'Produto/Subproduto não disponível.');
  result = result.replace(/\{\{PRODUCTS_AND_SUBPRODUCTS_ID\}\}/g, variables.productsAndSubproductsId || 'IDs não disponíveis');
  result = result.replace(/\{\{ULTIMAS_20_MENSAGENS\}\}/g, variables.ultimas20Mensagens || 'Nenhuma mensagem anterior.');
  result = result.replace(/\{\{ULTIMA_MENSAGEM\}\}/g, variables.ultimaMensagem || '');
  result = result.replace(/\{\{HANDLER\}\}/g, variables.handler || 'Não identificado');
  result = result.replace(/\{\{CATALOGO_PRODUTOS_SUBPRODUTOS\}\}/g, variables.catalogoProdutosSubprodutos || '[]');
  result = result.replace(/\{\{TIPO_SOLICITACAO\}\}/g, variables.tipoSolicitacao || 'Não identificado');
  result = result.replace(/\{\{DEMANDA_IDENTIFICADA\}\}/g, variables.demandaIdentificada || 'Nenhuma demanda identificada.');
  result = result.replace(/\{\{RESULTADOS_BUSCA\}\}/g, variables.resultadosBusca || 'Nenhum resultado de busca disponível.');
  result = result.replace(/\{\{ARTIGOS_PROBLEMAS_LISTA_TOP_5\}\}/g, variables.artigosProblemasListaTop5 || 'Nenhum artigo ou problema encontrado.');
  result = result.replace(/\{\{ARTIGOS_PROBLEMAS_LISTA_TOP_10\}\}/g, variables.artigosProblemasListaTop10 || 'Nenhum artigo ou problema encontrado.');
  result = result.replace(/\{\{PRODUTO_E_SUBPRODUTO_MATCH\}\}/g, variables.produtoESubprodutoMatch || 'Nenhum produto/subproduto identificado.');
  result = result.replace(/\{\{TIPO_DE_DEMANDA_MATCH\}\}/g, variables.tipoDeDemandaMatch || 'Nenhum tipo de demanda identificado.');
  result = result.replace(/\{\{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH\}\}/g, variables.artigoOuProblemaPrincipalMatch || 'Nenhum artigo ou problema principal identificado.');

  if (variables.customVariables) {
    for (const [key, value] of Object.entries(variables.customVariables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  }

  return result;
}

export interface FormField {
  label?: string;
  text?: string;
  name?: string;
  type?: string;
}

export interface ContentPayload {
  type?: string;
  textFallback?: string;
  fields?: FormField[];
}

function extractMessageText(message: {
  contentText: string | null;
  eventSubtype?: string | null;
  contentPayload?: ContentPayload | null;
}): string {
  if (message.eventSubtype === 'formResponse' && message.contentPayload) {
    const payload = message.contentPayload;
    if (payload.textFallback) {
      return `[Resposta do Formulário] ${payload.textFallback}`;
    }
    if (payload.fields && payload.fields.length > 0) {
      const responses = payload.fields
        .filter(f => f.label && f.text)
        .map(f => `${f.label}: ${f.text}`)
        .join('; ');
      if (responses) {
        return `[Resposta do Formulário] ${responses}`;
      }
    }
  }
  
  if (message.eventSubtype === 'form' && message.contentPayload) {
    const payload = message.contentPayload;
    if (payload.fields && payload.fields.length > 0) {
      const labels = payload.fields
        .filter(f => f.label)
        .map(f => f.label)
        .join(', ');
      if (labels) {
        return `[Formulário enviado: ${labels}]`;
      }
    }
    return '[Formulário enviado]';
  }
  
  return message.contentText || '(sem texto)';
}

export function formatMessagesContext(messages: Array<{
  authorType: string;
  authorName: string | null;
  contentText: string | null;
  occurredAt: Date;
  eventSubtype?: string | null;
  contentPayload?: ContentPayload | null;
}>): string {
  return messages
    .map(m => {
      const text = extractMessageText(m);
      return `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${text}`;
    })
    .join('\n');
}

export function formatLastMessage(message: {
  authorType: string;
  authorName: string | null;
  contentText: string | null;
  eventSubtype?: string | null;
  contentPayload?: ContentPayload | null;
}): string {
  const text = extractMessageText(message);
  return `[${message.authorType}${message.authorName ? ` - ${message.authorName}` : ''}]: ${text}`;
}

export function formatClassification(classification: {
  product: string | null;
  subproduct: string | null;
  customerRequestType?: string | null;
} | null): string {
  if (!classification) {
    return 'Classificação não disponível';
  }
  return `Produto: ${classification.product || 'Não identificado'}
Subproduto: ${classification.subproduct || 'Não identificado'}
Tipo de Solicitação: ${classification.customerRequestType || 'Não identificado'}`;
}

export function formatProductsAndSubproducts(classification: {
  product: string | null;
  subproduct: string | null;
} | null): string {
  if (!classification) {
    return 'Produto/Subproduto não disponível';
  }
  return `Produto: ${classification.product || 'Não identificado'}
Subproduto: ${classification.subproduct || 'Não identificado'}`;
}

export function buildFullPrompt(
  promptSystem: string,
  responseFormat: string | null,
  variables: PromptVariables
): { systemPrompt: string; userPrompt: string } {
  const systemWithVars = replacePromptVariables(promptSystem, variables);
  
  let userPrompt = '';
  if (responseFormat) {
    userPrompt = `\n\n## Formato da Resposta\n${responseFormat}`;
  }

  return {
    systemPrompt: systemWithVars,
    userPrompt: userPrompt
  };
}

export const AVAILABLE_VARIABLES = [
  { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
  { name: '{{RESUMO_ATUAL}}', description: 'Resumo anterior da conversa (para atualização)' },
  { name: '{{PRODUCTS_AND_SUBPRODUCTS}}', description: 'Produto e Subproduto classificados da conversa' },
  { name: '{{PRODUCTS_AND_SUBPRODUCTS_ID}}', description: 'IDs do Produto e Subproduto classificados da conversa' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
  { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
  { name: '{{TIPO_SOLICITACAO}}', description: 'Tipo de solicitação do cliente (Quer suporte/contratar/informações)' },
  { name: '{{DEMANDA_IDENTIFICADA}}', description: 'Demanda identificada pelo DemandFinder (para SolutionProvider)' },
  { name: '{{RESULTADOS_BUSCA}}', description: 'Resultados da busca na base de conhecimento (para SolutionProvider)' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_5}}', description: 'Top 5 artigos e problemas da base de conhecimento (busca automática)' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_10}}', description: 'Top 10 artigos e problemas da base de conhecimento (busca automática)' },
  { name: '{{PRODUTO_E_SUBPRODUTO_MATCH}}', description: 'Produto e Subproduto identificados com match na base' },
  { name: '{{TIPO_DE_DEMANDA_MATCH}}', description: 'Tipo de demanda identificado com match' },
  { name: '{{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH}}', description: 'Artigo ou problema principal identificado com melhor match' },
];
