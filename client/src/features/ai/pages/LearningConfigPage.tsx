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
      promptVariables={
        <>
          Variáveis disponíveis:
          <br />
          <code className="bg-gray-100 px-1 rounded">{"{{MENSAGENS}}"}</code> - Histórico de mensagens da conversa
          <br />
          <code className="bg-gray-100 px-1 rounded">{"{{RESUMO}}"}</code> - Resumo atual da conversa
          <br />
          <br />
          O prompt deve instruir a IA a extrair conhecimento estruturado em JSON com os campos:
          productStandard, subproductStandard, category1, category2, description, resolution, observations, confidenceScore, qualityFlags
        </>
      }
      promptRows={24}
      recommendedModel="gpt-4o-mini"
    />
  );
}
