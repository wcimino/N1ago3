import { OpenaiConfigForm } from "../components";

export function EnrichmentConfigPage() {
  return (
    <OpenaiConfigForm
      configType="enrichment"
      title="Configuração de Enriquecimento"
      description="Configure a geração de sugestões de melhoria para artigos da base de conhecimento usando artigos do Zendesk como referência"
      enabledLabel="Ativar geração de sugestões de melhoria"
      enabledDescription="Quando ativado, permite gerar sugestões comparando artigos da base de conhecimento com artigos do Zendesk"
      eventTriggerLabel="Eventos que disparam o enriquecimento"
      eventTriggerDescription="Selecione os tipos de eventos que devem disparar a geração de sugestões (opcional - pode ser executado manualmente)"
      authorFilterDescription="Selecione quais tipos de autor devem disparar o enriquecimento. Se nenhum for selecionado, todos os autores serão considerados."
      promptRows={24}
      responseFormatRows={12}
      recommendedModel="gpt-4o"
      showKnowledgeBaseTool={true}
      showProductCatalogTool={false}
      showZendeskKnowledgeBaseTool={true}
    />
  );
}
