import type { ReactNode } from "react";
import { CheckboxListItem, LoadingState } from "../../../shared/components/ui";
import { useOpenaiApiConfig } from "../../../shared/hooks";
import { AUTHOR_TYPE_OPTIONS, MODEL_OPTIONS } from "../../../lib/constants";

export interface OpenaiConfigFormProps {
  configType: string;
  title: string;
  description: string;
  enabledLabel: string;
  enabledDescription: string;
  eventTriggerLabel: string;
  eventTriggerDescription: string;
  authorFilterDescription: string;
  promptVariables: ReactNode;
  promptRows?: number;
  recommendedModel?: string;
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
  promptVariables,
  promptRows = 12,
  recommendedModel = "gpt-4o-mini",
}: OpenaiConfigFormProps) {
  const { state, actions, eventTypes, isLoading, isSaving } = useOpenaiApiConfig(configType);

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

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">{enabledLabel}</h3>
              <p className="text-sm text-gray-500">{enabledDescription}</p>
            </div>
            <button
              onClick={() => actions.setEnabled(!state.enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${state.enabled ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  state.enabled ? "translate-x-6" : "translate-x-0.5"
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

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">{eventTriggerLabel}</h3>
            <p className="text-sm text-gray-500 mb-3">{eventTriggerDescription}</p>
            
            {eventTypes?.mappings && eventTypes.mappings.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-60 overflow-auto">
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
              <p className="text-sm text-gray-500 italic">Nenhum tipo de evento configurado ainda.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Filtrar por autor da mensagem</h3>
            <p className="text-sm text-gray-500 mb-3">{authorFilterDescription}</p>
            
            <div className="border rounded-lg divide-y">
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
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Template do Prompt</h3>
            <p className="text-sm text-gray-500 mb-3">{promptVariables}</p>
            <textarea
              value={state.promptTemplate}
              onChange={(e) => actions.setPromptTemplate(e.target.value)}
              rows={promptRows}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              placeholder="Digite o template do prompt..."
            />
          </div>

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
    </div>
  );
}
