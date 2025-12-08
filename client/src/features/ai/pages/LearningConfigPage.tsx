import { OpenaiConfigForm } from "../components";

export function LearningConfigPage() {
  return (
    <OpenaiConfigForm
      configType="learning"
      title="Configuração de Aprendizado"
      description="Configure a extração automática de conhecimento das conversas para enriquecer a base de conhecimento"
      enabledLabel="Ativar extração de conhecimento"
      enabledDescription="Quando ativado, conhecimento será extraído automaticamente das conversas"
      eventTriggerLabel="Eventos que disparam a extração"
      eventTriggerDescription="Selecione os tipos de eventos que devem disparar a extração de conhecimento. Recomendado: conversas encerradas ou transferências"
      authorFilterDescription="Selecione quais tipos de autor devem disparar a extração. Se nenhum for selecionado, todos os autores serão considerados."
      promptRows={24}
      responseFormatRows={8}
      recommendedModel="gpt-4o-mini"
      showKnowledgeBaseTool={true}
      showProductCatalogTool={true}
      showZendeskKnowledgeBaseTool={true}
    />
  );
}
