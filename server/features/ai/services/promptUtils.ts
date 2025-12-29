export interface PromptVariables {
  resumo?: string | null;
  ultimas20Mensagens?: string | null;
  ultimaMensagem?: string | null;
  handler?: string | null;
  catalogoProdutosSubprodutos?: string | null;
  tipoSolicitacao?: string | null;
  demandaIdentificada?: string | null;
  resultadosBusca?: string | null;
  artigosProblemasListaTop5?: string | null;
  artigosProblemasListaTop10?: string | null;
  tipoDeDemandaMatch?: string | null;
  artigoOuProblemaPrincipalMatch?: string | null;
  intencaoId?: string | null;
  intencaoNome?: string | null;
  intencaoSinonimos?: string | null;
  assuntoNome?: string | null;
  assuntoSinonimos?: string | null;
  produtoNome?: string | null;
  subprodutoNome?: string | null;
  produtoESubprodutoNome?: string | null;
  artigoId?: string | null;
  artigoPergunta?: string | null;
  artigoResposta?: string | null;
  artigoKeywords?: string | null;
  artigoVariacoes?: string | null;
  artigoExiste?: boolean;
  sugestaoResposta?: string | null;
  produtoSubprodutoAssunto?: string | null;
  perguntas?: string | null;
  solucaoId?: string | null;
  solucaoNome?: string | null;
  solucaoDescricao?: string | null;
  solucaoAcoes?: string | null;
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
  result = result.replace(/\{\{ULTIMAS_20_MENSAGENS\}\}/g, variables.ultimas20Mensagens || 'Nenhuma mensagem anterior.');
  result = result.replace(/\{\{ULTIMA_MENSAGEM\}\}/g, variables.ultimaMensagem || '');
  result = result.replace(/\{\{HANDLER\}\}/g, variables.handler || 'Não identificado');
  result = result.replace(/\{\{CATALOGO_PRODUTOS_SUBPRODUTOS\}\}/g, variables.catalogoProdutosSubprodutos || '[]');
  result = result.replace(/\{\{TIPO_SOLICITACAO\}\}/g, variables.tipoSolicitacao || 'Não identificado');
  result = result.replace(/\{\{DEMANDA_IDENTIFICADA\}\}/g, variables.demandaIdentificada || 'Nenhuma demanda identificada.');
  result = result.replace(/\{\{RESULTADOS_BUSCA\}\}/g, variables.resultadosBusca || 'Nenhum resultado de busca disponível.');
  result = result.replace(/\{\{ARTIGOS_PROBLEMAS_LISTA_TOP_5\}\}/g, variables.artigosProblemasListaTop5 || 'Nenhum artigo ou problema encontrado.');
  result = result.replace(/\{\{ARTIGOS_PROBLEMAS_LISTA_TOP_10\}\}/g, variables.artigosProblemasListaTop10 || 'Nenhum artigo ou problema encontrado.');
  result = result.replace(/\{\{TIPO_DE_DEMANDA_MATCH\}\}/g, variables.tipoDeDemandaMatch || 'Nenhum tipo de demanda identificado.');
  result = result.replace(/\{\{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH\}\}/g, variables.artigoOuProblemaPrincipalMatch || 'Nenhum artigo ou problema principal identificado.');
  result = result.replace(/\{\{SUGESTAO_RESPOSTA\}\}/g, variables.sugestaoResposta || 'Nenhuma sugestão de resposta disponível.');
  result = result.replace(/\{\{PRODUTO_SUBPRODUTO_ASSUNTO\}\}/g, variables.produtoSubprodutoAssunto || '[]');
  result = result.replace(/\{\{PERGUNTAS\}\}/g, variables.perguntas || 'Nenhuma pergunta disponível.');
  result = result.replace(/\{\{SOLUCAO_ID\}\}/g, variables.solucaoId || '');
  result = result.replace(/\{\{SOLUCAO_NOME\}\}/g, variables.solucaoNome || 'Não identificada');
  result = result.replace(/\{\{SOLUCAO_DESCRICAO\}\}/g, variables.solucaoDescricao || 'Sem descrição');
  result = result.replace(/\{\{SOLUCAO_ACOES\}\}/g, variables.solucaoAcoes || '[]');

  result = result.replace(/\{\{INTENCAO_ID\}\}/gi, variables.intencaoId || '');
  result = result.replace(/\{\{INTENCAO_NOME\}\}/gi, variables.intencaoNome || '');
  result = result.replace(/\{\{INTENCAO_SINONIMOS\}\}/gi, variables.intencaoSinonimos || '');
  result = result.replace(/\{\{ASSUNTO_NOME\}\}/gi, variables.assuntoNome || '');
  result = result.replace(/\{\{ASSUNTO_SINONIMOS\}\}/gi, variables.assuntoSinonimos || '');
  result = result.replace(/\{\{PRODUTO_NOME\}\}/gi, variables.produtoNome || '');
  result = result.replace(/\{\{SUBPRODUTO_NOME\}\}/gi, variables.subprodutoNome || '');
  result = result.replace(/\{\{PRODUTO_E_SUBPRODUTO_NOME\}\}/gi, variables.produtoESubprodutoNome || 'Produto/Subproduto não disponível');
  result = result.replace(/\{\{ARTIGO_ID\}\}/gi, variables.artigoId || '');
  result = result.replace(/\{\{ARTIGO_PERGUNTA\}\}/gi, variables.artigoPergunta || 'Sem pergunta');
  result = result.replace(/\{\{ARTIGO_RESPOSTA\}\}/gi, variables.artigoResposta || 'Sem resposta');
  result = result.replace(/\{\{ARTIGO_KEYWORDS\}\}/gi, variables.artigoKeywords || 'Sem keywords');
  result = result.replace(/\{\{ARTIGO_VARIACOES\}\}/gi, variables.artigoVariacoes || 'Sem variações');

  if (variables.artigoExiste === true) {
    result = result
      .replace(/\{\{#if_artigo_existe\}\}([\s\S]*?)\{\{\/if_artigo_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_nao_existe\}\}[\s\S]*?\{\{\/if_artigo_nao_existe\}\}/gi, '');
  } else if (variables.artigoExiste === false) {
    result = result
      .replace(/\{\{#if_artigo_nao_existe\}\}([\s\S]*?)\{\{\/if_artigo_nao_existe\}\}/gi, '$1')
      .replace(/\{\{#if_artigo_existe\}\}[\s\S]*?\{\{\/if_artigo_existe\}\}/gi, '');
  }

  if (variables.intencaoSinonimos) {
    result = result.replace(/\{\{#if_intencao_sinonimos\}\}([\s\S]*?)\{\{\/if_intencao_sinonimos\}\}/gi, '$1');
  } else {
    result = result.replace(/\{\{#if_intencao_sinonimos\}\}[\s\S]*?\{\{\/if_intencao_sinonimos\}\}/gi, '');
  }

  if (variables.assuntoSinonimos) {
    result = result.replace(/\{\{#if_assunto_sinonimos\}\}([\s\S]*?)\{\{\/if_assunto_sinonimos\}\}/gi, '$1');
  } else {
    result = result.replace(/\{\{#if_assunto_sinonimos\}\}[\s\S]*?\{\{\/if_assunto_sinonimos\}\}/gi, '');
  }

  if (variables.subprodutoNome) {
    result = result.replace(/\{\{#if_subproduto_nome\}\}([\s\S]*?)\{\{\/if_subproduto_nome\}\}/gi, '$1');
  } else {
    result = result.replace(/\{\{#if_subproduto_nome\}\}[\s\S]*?\{\{\/if_subproduto_nome\}\}/gi, '');
  }

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
  let systemPrompt = replacePromptVariables(promptSystem, variables);
  
  if (responseFormat) {
    systemPrompt += `\n\n## Formato da Resposta\n${responseFormat}`;
  }

  return {
    systemPrompt,
    userPrompt: ''
  };
}

export const AVAILABLE_VARIABLES = [
  { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
  { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
  { name: '{{TIPO_SOLICITACAO}}', description: 'Tipo de solicitação do cliente (Quer suporte/contratar/informações)' },
  { name: '{{DEMANDA_IDENTIFICADA}}', description: 'Demanda identificada pelo DemandFinder (para SolutionProvider)' },
  { name: '{{RESULTADOS_BUSCA}}', description: 'Resultados da busca na base de conhecimento (para SolutionProvider)' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_5}}', description: 'Top 5 artigos e problemas da base de conhecimento (busca automática)' },
  { name: '{{ARTIGOS_PROBLEMAS_LISTA_TOP_10}}', description: 'Top 10 artigos e problemas da base de conhecimento (busca automática)' },
  { name: '{{TIPO_DE_DEMANDA_MATCH}}', description: 'Tipo de demanda identificado com match' },
  { name: '{{ARTIGO_OU_PROBLEMA_PRINCIPAL_MATCH}}', description: 'Artigo ou problema principal identificado com melhor match' },
  { name: '{{SUGESTAO_RESPOSTA}}', description: 'Sugestão de resposta gerada pelo SolutionProvider (para ajuste de tom)' },
  { name: '{{INTENCAO_ID}}', description: 'ID da intenção (para enriquecimento de artigos)' },
  { name: '{{INTENCAO_NOME}}', description: 'Nome da intenção (para enriquecimento de artigos)' },
  { name: '{{INTENCAO_SINONIMOS}}', description: 'Sinônimos da intenção separados por vírgula' },
  { name: '{{ASSUNTO_NOME}}', description: 'Nome do assunto (para enriquecimento de artigos)' },
  { name: '{{ASSUNTO_SINONIMOS}}', description: 'Sinônimos do assunto separados por vírgula' },
  { name: '{{PRODUTO_NOME}}', description: 'Nome do produto classificado' },
  { name: '{{SUBPRODUTO_NOME}}', description: 'Nome do subproduto classificado' },
  { name: '{{PRODUTO_E_SUBPRODUTO_NOME}}', description: 'Produto e Subproduto classificados (formato: Produto / Subproduto)' },
  { name: '{{ARTIGO_ID}}', description: 'ID do artigo existente (para enriquecimento)' },
  { name: '{{ARTIGO_PERGUNTA}}', description: 'Pergunta do artigo existente' },
  { name: '{{ARTIGO_RESPOSTA}}', description: 'Resposta do artigo existente' },
  { name: '{{ARTIGO_KEYWORDS}}', description: 'Keywords do artigo existente' },
  { name: '{{ARTIGO_VARIACOES}}', description: 'Variações de pergunta do artigo existente' },
  { name: '{{#if_artigo_existe}}...{{/if_artigo_existe}}', description: 'Bloco condicional: exibe conteúdo se artigo existe' },
  { name: '{{#if_artigo_nao_existe}}...{{/if_artigo_nao_existe}}', description: 'Bloco condicional: exibe conteúdo se artigo não existe' },
  { name: '{{#if_intencao_sinonimos}}...{{/if_intencao_sinonimos}}', description: 'Bloco condicional: exibe se há sinônimos de intenção' },
  { name: '{{#if_assunto_sinonimos}}...{{/if_assunto_sinonimos}}', description: 'Bloco condicional: exibe se há sinônimos de assunto' },
  { name: '{{#if_subproduto_nome}}...{{/if_subproduto_nome}}', description: 'Bloco condicional: exibe se há nome de subproduto' },
  { name: '{{PRODUTO_SUBPRODUTO_ASSUNTO}}', description: 'JSON de assuntos agrupados por produto/subproduto' },
  { name: '{{PERGUNTAS}}', description: 'Lista de perguntas para classificação de temas' },
  { name: '{{SOLUCAO_ID}}', description: 'ID da solução/demanda identificada pelo DemandFinder' },
  { name: '{{SOLUCAO_NOME}}', description: 'Nome da solução/demanda identificada pelo DemandFinder' },
  { name: '{{SOLUCAO_DESCRICAO}}', description: 'Descrição/razão da seleção da solução pelo DemandFinder' },
  { name: '{{SOLUCAO_ACOES}}', description: 'JSON com lista de ações da solução da Central de Soluções' },
];
