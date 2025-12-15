import { CheckboxListItem, CollapsibleSection } from "../../../shared/components/ui";

interface AIToolsState {
  useKnowledgeBaseTool: boolean;
  useProductCatalogTool: boolean;
  useSubjectIntentTool: boolean;
  useZendeskKnowledgeBaseTool: boolean;
  useObjectiveProblemTool: boolean;
  useCombinedKnowledgeSearchTool: boolean;
}

interface AIToolsSectionProps {
  state: AIToolsState;
  showKnowledgeBaseTool?: boolean;
  showProductCatalogTool?: boolean;
  showSubjectIntentTool?: boolean;
  showZendeskKnowledgeBaseTool?: boolean;
  showObjectiveProblemTool?: boolean;
  showCombinedKnowledgeSearchTool?: boolean;
  onToggleKnowledgeBase: () => void;
  onToggleProductCatalog: () => void;
  onToggleSubjectIntent: () => void;
  onToggleZendeskKnowledgeBase: () => void;
  onToggleObjectiveProblem: () => void;
  onToggleCombinedKnowledgeSearch: () => void;
}

export function AIToolsSection({
  state,
  showKnowledgeBaseTool = false,
  showProductCatalogTool = false,
  showSubjectIntentTool = false,
  showZendeskKnowledgeBaseTool = false,
  showObjectiveProblemTool = false,
  showCombinedKnowledgeSearchTool = false,
  onToggleKnowledgeBase,
  onToggleProductCatalog,
  onToggleSubjectIntent,
  onToggleZendeskKnowledgeBase,
  onToggleObjectiveProblem,
  onToggleCombinedKnowledgeSearch,
}: AIToolsSectionProps) {
  const hasAnyTool = showKnowledgeBaseTool || showProductCatalogTool || showSubjectIntentTool || 
                     showZendeskKnowledgeBaseTool || showObjectiveProblemTool || showCombinedKnowledgeSearchTool;

  if (!hasAnyTool) return null;

  const activeCount = [
    state.useKnowledgeBaseTool,
    state.useProductCatalogTool,
    state.useSubjectIntentTool,
    state.useZendeskKnowledgeBaseTool,
    state.useObjectiveProblemTool,
    state.useCombinedKnowledgeSearchTool,
  ].filter(Boolean).length;

  return (
    <CollapsibleSection
      title="Ferramentas de IA"
      description="Habilite ferramentas que o modelo pode usar para buscar informações"
      defaultOpen={false}
      badge={
        activeCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {activeCount} ativa{activeCount > 1 ? 's' : ''}
          </span>
        )
      }
    >
      <div className="divide-y">
        {showKnowledgeBaseTool && (
          <CheckboxListItem
            label="Usar Base de Conhecimento"
            sublabel="Permite buscar artigos da base antes de gerar resposta"
            checked={state.useKnowledgeBaseTool}
            onChange={onToggleKnowledgeBase}
          />
        )}
        {showProductCatalogTool && (
          <CheckboxListItem
            label="Usar Catálogo de Produtos"
            sublabel="Permite buscar classificações no catálogo de produtos"
            checked={state.useProductCatalogTool}
            onChange={onToggleProductCatalog}
          />
        )}
        {showSubjectIntentTool && (
          <CheckboxListItem
            label="Usar Assuntos e Intenções"
            sublabel="Permite buscar assuntos e intenções válidos para classificação"
            checked={state.useSubjectIntentTool}
            onChange={onToggleSubjectIntent}
          />
        )}
        {showZendeskKnowledgeBaseTool && (
          <CheckboxListItem
            label="Usar Base de Conhecimento Zendesk"
            sublabel="Permite buscar artigos do Help Center do Zendesk"
            checked={state.useZendeskKnowledgeBaseTool}
            onChange={onToggleZendeskKnowledgeBase}
          />
        )}
        {showObjectiveProblemTool && (
          <CheckboxListItem
            label="Usar Problemas Objetivos"
            sublabel="Permite buscar problemas objetivos para identificar o problema real do cliente"
            checked={state.useObjectiveProblemTool}
            onChange={onToggleObjectiveProblem}
          />
        )}
        {showCombinedKnowledgeSearchTool && (
          <CheckboxListItem
            label="Usar Busca Combinada de Artigos e Problemas"
            sublabel="Após classificar, busca artigos e problemas objetivos relacionados ao produto"
            checked={state.useCombinedKnowledgeSearchTool}
            onChange={onToggleCombinedKnowledgeSearch}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
