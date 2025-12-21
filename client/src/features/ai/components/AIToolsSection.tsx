import { CheckboxListItem, CollapsibleSection } from "../../../shared/components/ui";

interface AIToolsState {
  useZendeskKnowledgeBaseTool: boolean;
  useObjectiveProblemTool: boolean;
  useCombinedKnowledgeSearchTool: boolean;
}

interface AIToolsSectionProps {
  state: AIToolsState;
  showZendeskKnowledgeBaseTool?: boolean;
  showObjectiveProblemTool?: boolean;
  showCombinedKnowledgeSearchTool?: boolean;
  onToggleZendeskKnowledgeBase: () => void;
  onToggleObjectiveProblem: () => void;
  onToggleCombinedKnowledgeSearch: () => void;
}

export function AIToolsSection({
  state,
  showZendeskKnowledgeBaseTool = false,
  showObjectiveProblemTool = false,
  showCombinedKnowledgeSearchTool = false,
  onToggleZendeskKnowledgeBase,
  onToggleObjectiveProblem,
  onToggleCombinedKnowledgeSearch,
}: AIToolsSectionProps) {
  const hasAnyTool = showZendeskKnowledgeBaseTool || showObjectiveProblemTool || showCombinedKnowledgeSearchTool;

  if (!hasAnyTool) return null;

  const activeCount = [
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
            label="Usar Busca Combinada de Problemas"
            sublabel="Após classificar, busca problemas objetivos relacionados ao produto"
            checked={state.useCombinedKnowledgeSearchTool}
            onChange={onToggleCombinedKnowledgeSearch}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
