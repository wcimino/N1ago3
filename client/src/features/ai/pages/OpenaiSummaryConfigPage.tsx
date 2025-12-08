import { OpenaiConfigForm } from "../components";

export function OpenaiSummaryConfigPage() {
  return (
    <OpenaiConfigForm
      configType="summary"
      title="Configuração do Resumo com OpenAI"
      description="Configure a geração automática de resumos das conversas"
      enabledLabel="Ativar geração de resumos"
      enabledDescription="Quando ativado, resumos serão gerados automaticamente"
      eventTriggerLabel="Eventos que disparam a geração de resumo"
      eventTriggerDescription="Selecione os tipos de eventos que devem disparar a geração de um novo resumo"
      authorFilterDescription="Selecione quais tipos de autor devem disparar a geração de resumo. Se nenhum for selecionado, todos os autores serão considerados."
      promptRows={16}
      responseFormatRows={10}
      recommendedModel="gpt-4o-mini"
    />
  );
}
