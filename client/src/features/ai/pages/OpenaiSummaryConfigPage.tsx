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
      promptVariables={
        <>
          Use as variáveis: <code className="bg-gray-100 px-1 rounded">{"{{RESUMO_ATUAL}}"}</code>, 
          <code className="bg-gray-100 px-1 rounded ml-1">{"{{ULTIMAS_20_MENSAGENS}}"}</code>, 
          <code className="bg-gray-100 px-1 rounded ml-1">{"{{ULTIMA_MENSAGEM}}"}</code>
        </>
      }
      promptRows={12}
      recommendedModel="gpt-5"
    />
  );
}
