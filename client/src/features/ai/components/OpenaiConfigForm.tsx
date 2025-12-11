import { useState, type ReactNode } from "react";
import { CheckboxListItem, CollapsibleSection, LoadingState, Modal } from "../../../shared/components/ui";
import { useOpenaiApiConfig } from "../../../shared/hooks";
import { AUTHOR_TYPE_OPTIONS, MODEL_OPTIONS } from "../../../lib/constants";
import { Info, Copy, Check } from "lucide-react";

const AVAILABLE_VARIABLES = [
  { name: '{{RESUMO}}', description: 'Resumo da conversa atual' },
  { name: '{{RESUMO_ATUAL}}', description: 'Resumo anterior (para atualização)' },
  { name: '{{CLASSIFICACAO}}', description: 'Produto, Intenção e Confiança' },
  { name: '{{ULTIMAS_20_MENSAGENS}}', description: 'Histórico das últimas 20 mensagens' },
  { name: '{{ULTIMA_MENSAGEM}}', description: 'A mensagem mais recente' },
  { name: '{{MENSAGENS}}', description: 'Alias para {{ULTIMAS_20_MENSAGENS}}' },
  { name: '{{HANDLER}}', description: 'Quem está atendendo (bot/humano)' },
  { name: '{{CATALOGO_PRODUTOS_SUBPRODUTOS}}', description: 'Lista JSON de produtos e subprodutos do catálogo' },
];

export interface OpenaiConfigFormProps {
  configType: string;
  title: string;
  description: string;
  enabledLabel: string;
  enabledDescription: string;
  eventTriggerLabel: string;
  eventTriggerDescription: string;
  authorFilterDescription: string;
  promptRows?: number;
  responseFormatRows?: number;
  recommendedModel?: string;
  showKnowledgeBaseTool?: boolean;
  showProductCatalogTool?: boolean;
  showSubjectIntentTool?: boolean;
  showZendeskKnowledgeBaseTool?: boolean;
  children?: ReactNode;
}

export function OpenaiConfigForm({
  configType,
  title,
  description,
  enabledLabel,
  enabledDescription,
  eventTriggerLabel,
  eventTriggerDescription,
  authorFilterDescription,
  promptRows = 16,
  responseFormatRows = 8,
  recommendedModel = "gpt-4o-mini",
  showKnowledgeBaseTool = false,
  showProductCatalogTool = false,
  showSubjectIntentTool = false,
  showZendeskKnowledgeBaseTool = false,
  children,
}: OpenaiConfigFormProps) {
  const { state, actions, eventTypes, isLoading, isSaving } = useOpenaiApiConfig(configType);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const copyVariable = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedVariable(name);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900">{enabledLabel}</h3>
              <p className="text-sm text-gray-500">{enabledDescription}</p>
            </div>
            <button
              onClick={() => actions.setEnabled(!state.enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${state.enabled ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  state.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900">Usar configurações gerais</h3>
              <p className="text-sm text-gray-500">Concatena as configurações gerais ao prompt deste agente</p>
            </div>
            <button
              onClick={() => actions.setUseGeneralSettings(!state.useGeneralSettings)}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${state.useGeneralSettings ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  state.useGeneralSettings ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

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

          {(showKnowledgeBaseTool || showProductCatalogTool || showSubjectIntentTool || showZendeskKnowledgeBaseTool) && (
            <CollapsibleSection
              title="Ferramentas de IA"
              description="Habilite ferramentas que o modelo pode usar para buscar informações"
              defaultOpen={false}
              badge={
                (state.useKnowledgeBaseTool || state.useProductCatalogTool || state.useSubjectIntentTool || state.useZendeskKnowledgeBaseTool) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {[state.useKnowledgeBaseTool, state.useProductCatalogTool, state.useSubjectIntentTool, state.useZendeskKnowledgeBaseTool].filter(Boolean).length} ativa{[state.useKnowledgeBaseTool, state.useProductCatalogTool, state.useSubjectIntentTool, state.useZendeskKnowledgeBaseTool].filter(Boolean).length > 1 ? 's' : ''}
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
                    onChange={() => actions.setUseKnowledgeBaseTool(!state.useKnowledgeBaseTool)}
                  />
                )}
                {showProductCatalogTool && (
                  <CheckboxListItem
                    label="Usar Catálogo de Produtos"
                    sublabel="Permite buscar classificações no catálogo de produtos"
                    checked={state.useProductCatalogTool}
                    onChange={() => actions.setUseProductCatalogTool(!state.useProductCatalogTool)}
                  />
                )}
                {showSubjectIntentTool && (
                  <CheckboxListItem
                    label="Usar Assuntos e Intenções"
                    sublabel="Permite buscar assuntos e intenções válidos para classificação"
                    checked={state.useSubjectIntentTool}
                    onChange={() => actions.setUseSubjectIntentTool(!state.useSubjectIntentTool)}
                  />
                )}
                {showZendeskKnowledgeBaseTool && (
                  <CheckboxListItem
                    label="Usar Base de Conhecimento Zendesk"
                    sublabel="Permite buscar artigos do Help Center do Zendesk"
                    checked={state.useZendeskKnowledgeBaseTool}
                    onChange={() => actions.setUseZendeskKnowledgeBaseTool(!state.useZendeskKnowledgeBaseTool)}
                  />
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title={eventTriggerLabel}
            description={eventTriggerDescription}
            defaultOpen={false}
            badge={
              state.triggerEventTypes.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {state.triggerEventTypes.length} selecionado{state.triggerEventTypes.length > 1 ? 's' : ''}
                </span>
              )
            }
          >
            {eventTypes?.mappings && eventTypes.mappings.length > 0 ? (
              <div className="divide-y max-h-60 overflow-auto">
                {eventTypes.mappings.map((mapping) => {
                  const eventKey = `${mapping.source}:${mapping.event_type}`;
                  return (
                    <CheckboxListItem
                      key={mapping.id}
                      label={mapping.display_name}
                      sublabel={`${mapping.source}:${mapping.event_type}`}
                      checked={state.triggerEventTypes.includes(eventKey)}
                      onChange={() => actions.toggleEventType(eventKey)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic p-4">Nenhum tipo de evento configurado ainda.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Filtrar por autor da mensagem"
            description={authorFilterDescription}
            defaultOpen={false}
            badge={
              state.triggerAuthorTypes.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {state.triggerAuthorTypes.length} selecionado{state.triggerAuthorTypes.length > 1 ? 's' : ''}
                </span>
              )
            }
          >
            <div className="divide-y">
              {AUTHOR_TYPE_OPTIONS.map(({ value, label }) => (
                <CheckboxListItem
                  key={value}
                  label={label}
                  sublabel={value}
                  checked={state.triggerAuthorTypes.includes(value)}
                  onChange={() => actions.toggleAuthorType(value)}
                />
              ))}
            </div>
          </CollapsibleSection>

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
            <button
              onClick={() => actions.save()}
              disabled={!state.hasChanges || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </div>
      </div>

      {showVariablesModal && (
        <Modal
          onClose={() => setShowVariablesModal(false)}
          title="Variáveis Disponíveis"
          maxWidth="md"
        >
        <div className="space-y-1">
          <p className="text-sm text-gray-500 mb-4">
            Clique em uma variável para copiá-la. Você pode usar essas variáveis nas orientações para o agente.
          </p>
          <div className="divide-y border rounded-lg overflow-hidden">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                onClick={() => copyVariable(v.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium text-blue-600">{v.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{v.description}</div>
                </div>
                <div className="ml-3 shrink-0">
                  {copiedVariable === v.name ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-4 w-4" />
                      Copiado!
                    </span>
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        </Modal>
      )}
    </div>
  );
}
