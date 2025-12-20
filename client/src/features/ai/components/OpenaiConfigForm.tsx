import { useState, type ReactNode } from "react";
import { CollapsibleSection, LoadingState, Button } from "../../../shared/components/ui";
import { useOpenaiApiConfig } from "../../../shared/hooks";
import { MODEL_OPTIONS } from "../../../lib/constants";
import { Info } from "lucide-react";
import { AVAILABLE_VARIABLES } from "../constants/promptVariables";
import { VariablesModal } from "./VariablesModal";
import { AIToolsSection } from "./AIToolsSection";

export interface OpenaiConfigFormProps {
  configType: string;
  title: string;
  description: string;
  enabledLabel: string;
  enabledDescription: string;
  promptRows?: number;
  responseFormatRows?: number;
  recommendedModel?: string;
  showKnowledgeBaseTool?: boolean;
  showProductCatalogTool?: boolean;
  showSubjectIntentTool?: boolean;
  showZendeskKnowledgeBaseTool?: boolean;
  showObjectiveProblemTool?: boolean;
  showCombinedKnowledgeSearchTool?: boolean;
  children?: ReactNode;
}

export function OpenaiConfigForm({
  configType,
  title,
  description,
  enabledLabel,
  enabledDescription,
  promptRows = 16,
  responseFormatRows = 8,
  recommendedModel = "gpt-4o-mini",
  showKnowledgeBaseTool = false,
  showProductCatalogTool = false,
  showSubjectIntentTool = false,
  showZendeskKnowledgeBaseTool = false,
  showObjectiveProblemTool = false,
  showCombinedKnowledgeSearchTool = false,
  children,
}: OpenaiConfigFormProps) {
  const { state, actions, isLoading, isSaving } = useOpenaiApiConfig(configType);
  const [showVariablesModal, setShowVariablesModal] = useState(false);

  if (isLoading) {
    return <LoadingState message="Carregando configurações..." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <ToggleRow
            label={enabledLabel}
            description={enabledDescription}
            checked={state.enabled}
            onChange={() => actions.setEnabled(!state.enabled)}
          />

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Modelo OpenAI</h3>
            <select
              value={state.modelName}
              onChange={(e) => actions.setModelName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}{option.value === recommendedModel ? " (Recomendado)" : ""}
                </option>
              ))}
            </select>
          </div>

          <AIToolsSection
            state={state}
            showKnowledgeBaseTool={showKnowledgeBaseTool}
            showProductCatalogTool={showProductCatalogTool}
            showSubjectIntentTool={showSubjectIntentTool}
            showZendeskKnowledgeBaseTool={showZendeskKnowledgeBaseTool}
            showObjectiveProblemTool={showObjectiveProblemTool}
            showCombinedKnowledgeSearchTool={showCombinedKnowledgeSearchTool}
            onToggleKnowledgeBase={() => actions.setUseKnowledgeBaseTool(!state.useKnowledgeBaseTool)}
            onToggleProductCatalog={() => actions.setUseProductCatalogTool(!state.useProductCatalogTool)}
            onToggleSubjectIntent={() => actions.setUseSubjectIntentTool(!state.useSubjectIntentTool)}
            onToggleZendeskKnowledgeBase={() => actions.setUseZendeskKnowledgeBaseTool(!state.useZendeskKnowledgeBaseTool)}
            onToggleObjectiveProblem={() => actions.setUseObjectiveProblemTool(!state.useObjectiveProblemTool)}
            onToggleCombinedKnowledgeSearch={() => actions.setUseCombinedKnowledgeSearchTool(!state.useCombinedKnowledgeSearchTool)}
          />

          <CollapsibleSection
            title="Orientações para o Agente"
            description="Instruções completas para o agente de IA"
            defaultOpen={false}
            badge={
              state.promptSystem && state.promptSystem.trim().length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Configurado
                </span>
              )
            }
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => setShowVariablesModal(true)}
                >
                  <Info className="h-3.5 w-3.5" />
                  Ver variáveis disponíveis
                </button>
              </div>
              <textarea
                value={state.promptSystem}
                onChange={(e) => actions.setPromptSystem(e.target.value)}
                rows={promptRows}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder="Digite as orientações completas para o agente..."
              />
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-xs rounded text-gray-600 font-mono"
                    onClick={() => {
                      const textarea = document.querySelector('textarea');
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = state.promptSystem;
                        const newText = text.substring(0, start) + v.name + text.substring(end);
                        actions.setPromptSystem(newText);
                      }
                    }}
                    title={v.description}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Formato da Resposta"
            description="Especifique como o agente deve formatar a resposta"
            defaultOpen={false}
            badge={
              state.responseFormat && state.responseFormat.trim().length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Configurado
                </span>
              )
            }
          >
            <div className="p-4">
              <textarea
                value={state.responseFormat}
                onChange={(e) => actions.setResponseFormat(e.target.value)}
                rows={responseFormatRows}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder='Exemplo: Responda em JSON com os campos: {"campo1": "valor", "campo2": "valor"}'
              />
            </div>
          </CollapsibleSection>

          {children}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {state.hasChanges && (
              <span className="text-sm text-yellow-600 self-center">Você tem alterações não salvas</span>
            )}
            <Button
              onClick={() => actions.save()}
              disabled={!state.hasChanges}
              isLoading={isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </div>
      </div>

      {showVariablesModal && (
        <VariablesModal onClose={() => setShowVariablesModal(false)} />
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900">{label}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-green-500" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
            checked ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
