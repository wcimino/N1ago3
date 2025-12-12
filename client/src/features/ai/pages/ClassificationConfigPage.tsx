import { OpenaiConfigForm } from "../components";

export function ClassificationConfigPage() {
  return (
    <OpenaiConfigForm
      configType="classification"
      title="Configuração da Classificação de Produto"
      description="Configure a classificação automática de produto e intenção das conversas"
      enabledLabel="Ativar classificação"
      enabledDescription="Quando ativado, conversas serão classificadas automaticamente"
      eventTriggerLabel="Eventos que disparam a classificação"
      eventTriggerDescription="Selecione os tipos de eventos que devem disparar uma nova classificação"
      authorFilterDescription="Selecione quais tipos de autor devem disparar a classificação. Se nenhum for selecionado, todos os autores serão considerados."
      promptRows={16}
      responseFormatRows={6}
      recommendedModel="gpt-4o-mini"
      showKnowledgeBaseTool={true}
      showProductCatalogTool={true}
      showSubjectIntentTool={true}
      showObjectiveProblemTool={true}
    />
  );
}
