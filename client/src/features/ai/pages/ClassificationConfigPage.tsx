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
      promptVariables={
        <>
          Use a variável: <code className="bg-gray-100 px-1 rounded">{"{{MENSAGENS}}"}</code> para incluir as mensagens da conversa.
          O prompt deve instruir a IA a responder em JSON com os campos: product, intent, confidence.
        </>
      }
      promptRows={16}
      recommendedModel="gpt-4o-mini"
    />
  );
}
