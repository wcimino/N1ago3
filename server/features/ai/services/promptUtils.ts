export interface PromptVariables {
  resumo?: string | null;
  classificacao?: string | null;
  ultimas20Mensagens?: string | null;
  ultimaMensagem?: string | null;
  handler?: string | null;
  mensagens?: string | null;
  resumoAtual?: string | null;
}

export function replacePromptVariables(
  prompt: string,
  variables: PromptVariables
): string {
  let result = prompt;

  result = result.replace(/\{\{RESUMO\}\}/g, variables.resumo || 'Nenhum resumo disponível.');
  result = result.replace(/\{\{RESUMO_ATUAL\}\}/g, variables.resumoAtual || variables.resumo || 'Nenhum resumo anterior disponível.');
  result = result.replace(/\{\{CLASSIFICACAO\}\}/g, variables.classificacao || 'Classificação não disponível.');
  result = result.replace(/\{\{ULTIMAS_20_MENSAGENS\}\}/g, variables.ultimas20Mensagens || 'Nenhuma mensagem anterior.');
  result = result.replace(/\{\{ULTIMA_MENSAGEM\}\}/g, variables.ultimaMensagem || '');
  result = result.replace(/\{\{HANDLER\}\}/g, variables.handler || 'Não identificado');
  result = result.replace(/\{\{MENSAGENS\}\}/g, variables.mensagens || variables.ultimas20Mensagens || 'Nenhuma mensagem disponível.');

  return result;
}

export function formatMessagesContext(messages: Array<{
  authorType: string;
  authorName: string | null;
  contentText: string | null;
  occurredAt: Date;
}>): string {
  return messages
    .map(m => `[${m.authorType}${m.authorName ? ` - ${m.authorName}` : ''}]: ${m.contentText || '(sem texto)'}`)
    .join('\n');
}

export function formatLastMessage(message: {
  authorType: string;
  authorName: string | null;
  contentText: string | null;
}): string {
  return `[${message.authorType}${message.authorName ? ` - ${message.authorName}` : ''}]: ${message.contentText || '(sem texto)'}`;
}

export function formatClassification(classification: {
  product: string | null;
  intent: string | null;
  confidence: number | null;
} | null): string {
  if (!classification) {
    return 'Classificação não disponível';
  }
  return `Produto: ${classification.product || 'Não identificado'}\nIntenção: ${classification.intent || 'Não identificada'}\nConfiança: ${classification.confidence !== null ? `${classification.confidence}%` : 'N/A'}`;
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
  { name: '{{CLASSIFICACAO}}', description: 'Classificação: Produto, Intenção e Confiança' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{MENSAGENS}}', description: 'Alias para {{ULTIMAS_20_MENSAGENS}}' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
];
