import { RefreshCw } from "lucide-react";
import { CheckboxListItem } from "../components";
import { useOpenaiApiConfig } from "../hooks/useOpenaiApiConfig";

const AUTHOR_TYPE_OPTIONS = [
  { value: "customer", label: "Cliente" },
  { value: "agent", label: "Agente" },
  { value: "bot", label: "Bot" },
  { value: "system", label: "Sistema" },
];

export function ClassificationConfigPage() {
  const { state, actions, eventTypes, isLoading, isSaving } = useOpenaiApiConfig("classification");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Configuração da Classificação de Produto</h2>
          <p className="text-sm text-gray-500 mt-1">Configure a classificação automática de produto e intenção das conversas</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Ativar classificação</h3>
              <p className="text-sm text-gray-500">Quando ativado, conversas serão classificadas automaticamente</p>
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
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Recomendado)</option>
            </select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Eventos que disparam a classificação</h3>
            <p className="text-sm text-gray-500 mb-3">Selecione os tipos de eventos que devem disparar uma nova classificação</p>
            
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
            <p className="text-sm text-gray-500 mb-3">Selecione quais tipos de autor devem disparar a classificação. Se nenhum for selecionado, todos os autores serão considerados.</p>
            
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
            <p className="text-sm text-gray-500 mb-3">
              Use a variável: <code className="bg-gray-100 px-1 rounded">{"{{MENSAGENS}}"}</code> para incluir as mensagens da conversa.
              O prompt deve instruir a IA a responder em JSON com os campos: product, intent, confidence.
            </p>
            <textarea
              value={state.promptTemplate}
              onChange={(e) => actions.setPromptTemplate(e.target.value)}
              rows={16}
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
