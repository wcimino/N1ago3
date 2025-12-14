export interface PromptVariables {
  resumo?: string | null;
  classificacao?: string | null;
  productsAndSubproducts?: string | null;
  ultimas20Mensagens?: string | null;
  ultimaMensagem?: string | null;
  handler?: string | null;
  mensagens?: string | null;
  resumoAtual?: string | null;
  catalogoProdutosSubprodutos?: string | null;
  tipoSolicitacao?: string | null;
  demandaIdentificada?: string | null;
  resultadosBusca?: string | null;
}

export function replacePromptVariables(
  prompt: string,
  variables: PromptVariables
): string {
  let result = prompt;

  result = result.replace(/\{\{RESUMO\}\}/g, variables.resumo || 'Nenhum resumo disponível.');
  result = result.replace(/\{\{RESUMO_ATUAL\}\}/g, variables.resumoAtual || variables.resumo || 'Nenhum resumo anterior disponível.');
  result = result.replace(/\{\{CLASSIFICACAO\}\}/g, variables.classificacao || 'Classificação não disponível.');
  result = result.replace(/\{\{PRODUCTS_AND_SUBPRODUCTS\}\}/g, variables.productsAndSubproducts || 'Produto/Subproduto não disponível.');
  result = result.replace(/\{\{ULTIMAS_20_MENSAGENS\}\}/g, variables.ultimas20Mensagens || 'Nenhuma mensagem anterior.');
  result = result.replace(/\{\{ULTIMA_MENSAGEM\}\}/g, variables.ultimaMensagem || '');
  result = result.replace(/\{\{HANDLER\}\}/g, variables.handler || 'Não identificado');
  result = result.replace(/\{\{MENSAGENS\}\}/g, variables.mensagens || variables.ultimas20Mensagens || 'Nenhuma mensagem disponível.');
  result = result.replace(/\{\{CATALOGO_PRODUTOS_SUBPRODUTOS\}\}/g, variables.catalogoProdutosSubprodutos || '[]');
  result = result.replace(/\{\{TIPO_SOLICITACAO\}\}/g, variables.tipoSolicitacao || 'Não identificado');
  result = result.replace(/\{\{DEMANDA_IDENTIFICADA\}\}/g, variables.demandaIdentificada || 'Nenhuma demanda identificada.');
  result = result.replace(/\{\{RESULTADOS_BUSCA\}\}/g, variables.resultadosBusca || 'Nenhum resultado de busca disponível.');

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
  { name: '{{CLASSIFICACAO}}', description: 'Produto, Subproduto, Assunto, Intenção e Confiança' },
  { name: '{{PRODUCTS_AND_SUBPRODUCTS}}', description: 'Produto e Subproduto classificados da conversa' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{MENSAGENS}}', description: 'Alias para {{ULTIMAS_20_MENSAGENS}}' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
  { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
  { name: '{{TIPO_SOLICITACAO}}', description: 'Tipo de solicitação do cliente (Quer suporte/contratar/informações)' },
  { name: '{{DEMANDA_IDENTIFICADA}}', description: 'Demanda identificada pelo DemandFinder (para SolutionProvider)' },
  { name: '{{RESULTADOS_BUSCA}}', description: 'Resultados da busca na base de conhecimento (para SolutionProvider)' },
];
