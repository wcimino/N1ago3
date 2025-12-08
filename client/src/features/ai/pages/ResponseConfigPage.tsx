import { OpenaiConfigForm } from "../components";

export function ResponseConfigPage() {
  return (
    <OpenaiConfigForm
      configType="response"
      title="Configuração de Sugestão de Resposta"
      description="Configure a geração automática de sugestões de resposta para os atendentes"
      enabledLabel="Ativar sugestão de resposta"
      enabledDescription="Quando ativado, respostas serão sugeridas automaticamente"
      eventTriggerLabel="Eventos que disparam a sugestão"
      eventTriggerDescription="Selecione os tipos de eventos que devem disparar uma nova sugestão de resposta"
      authorFilterDescription="Selecione quais tipos de autor devem disparar a sugestão. Normalmente, você vai querer gerar sugestões quando o cliente envia uma mensagem."
      promptRows={20}
      responseFormatRows={4}
      recommendedModel="gpt-4o-mini"
      showKnowledgeBaseTool={true}
      showProductCatalogTool={true}
      showZendeskKnowledgeBaseTool={true}
    />
  );
}
