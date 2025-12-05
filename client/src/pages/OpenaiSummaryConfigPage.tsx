import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { OpenaiSummaryConfigResponse, EventTypeMappingsResponse } from "../types";

export function OpenaiSummaryConfigPage() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [triggerEventTypes, setTriggerEventTypes] = useState<string[]>([]);
  const [triggerAuthorTypes, setTriggerAuthorTypes] = useState<string[]>([]);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [modelName, setModelName] = useState("gpt-5");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading } = useQuery<OpenaiSummaryConfigResponse>({
    queryKey: ["openai-summary-config"],
    queryFn: async () => {
      const res = await fetch("/api/openai-summary-config", { credentials: "include" });
      return res.json();
    },
  });

  const { data: eventTypes } = useQuery<EventTypeMappingsResponse>({
    queryKey: ["event-type-mappings"],
    queryFn: async () => {
      const res = await fetch("/api/event-type-mappings", { credentials: "include" });
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setTriggerEventTypes(config.trigger_event_types || []);
      setTriggerAuthorTypes(config.trigger_author_types || []);
      setPromptTemplate(config.prompt_template);
      setModelName(config.model_name);
      setHasChanges(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/openai-summary-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled,
          trigger_event_types: triggerEventTypes,
          trigger_author_types: triggerAuthorTypes,
          prompt_template: promptTemplate,
          model_name: modelName,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-summary-config"] });
      setHasChanges(false);
    },
  });

  const toggleAuthorType = (authorType: string) => {
    setTriggerAuthorTypes(prev => {
      if (prev.includes(authorType)) {
        return prev.filter(a => a !== authorType);
      }
      return [...prev, authorType];
    });
    handleChange();
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  const toggleEventType = (eventKey: string) => {
    setTriggerEventTypes(prev => {
      if (prev.includes(eventKey)) {
        return prev.filter(e => e !== eventKey);
      }
      return [...prev, eventKey];
    });
    handleChange();
  };

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
          <h2 className="text-lg font-semibold text-gray-900">Configuração do Resumo com OpenAI</h2>
          <p className="text-sm text-gray-500 mt-1">Configure a geração automática de resumos das conversas</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Ativar geração de resumos</h3>
              <p className="text-sm text-gray-500">Quando ativado, resumos serão gerados automaticamente</p>
            </div>
            <button
              onClick={() => { setEnabled(!enabled); handleChange(); }}
              className={`w-12 h-6 rounded-full transition-colors ${
                enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Modelo OpenAI</h3>
            <select
              value={modelName}
              onChange={(e) => { setModelName(e.target.value); handleChange(); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="gpt-5">GPT-5 (Recomendado)</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Eventos que disparam a geração de resumo</h3>
            <p className="text-sm text-gray-500 mb-3">Selecione os tipos de eventos que devem disparar a geração de um novo resumo</p>
            
            {eventTypes?.mappings && eventTypes.mappings.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                {eventTypes.mappings.map((mapping) => {
                  const eventKey = `${mapping.source}:${mapping.event_type}`;
                  const isSelected = triggerEventTypes.includes(eventKey);
                  return (
                    <label
                      key={mapping.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEventType(eventKey)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{mapping.display_name}</span>
                        <span className="ml-2 text-xs text-gray-500">({mapping.source}:{mapping.event_type})</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Nenhum tipo de evento configurado ainda.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Filtrar por autor da mensagem</h3>
            <p className="text-sm text-gray-500 mb-3">Selecione quais tipos de autor devem disparar a geração de resumo. Se nenhum for selecionado, todos os autores serão considerados.</p>
            
            <div className="border rounded-lg divide-y">
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerAuthorTypes.includes("customer")}
                  onChange={() => toggleAuthorType("customer")}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Cliente</span>
                  <span className="ml-2 text-xs text-gray-500">(customer)</span>
                </div>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerAuthorTypes.includes("agent")}
                  onChange={() => toggleAuthorType("agent")}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Agente</span>
                  <span className="ml-2 text-xs text-gray-500">(agent)</span>
                </div>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerAuthorTypes.includes("bot")}
                  onChange={() => toggleAuthorType("bot")}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Bot</span>
                  <span className="ml-2 text-xs text-gray-500">(bot)</span>
                </div>
              </label>
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerAuthorTypes.includes("system")}
                  onChange={() => toggleAuthorType("system")}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Sistema</span>
                  <span className="ml-2 text-xs text-gray-500">(system)</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Template do Prompt</h3>
            <p className="text-sm text-gray-500 mb-3">
              Use as variáveis: <code className="bg-gray-100 px-1 rounded">{"{{RESUMO_ATUAL}}"}</code>, 
              <code className="bg-gray-100 px-1 rounded ml-1">{"{{ULTIMAS_20_MENSAGENS}}"}</code>, 
              <code className="bg-gray-100 px-1 rounded ml-1">{"{{ULTIMA_MENSAGEM}}"}</code>
            </p>
            <textarea
              value={promptTemplate}
              onChange={(e) => { setPromptTemplate(e.target.value); handleChange(); }}
              rows={12}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              placeholder="Digite o template do prompt..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            {hasChanges && (
              <span className="text-sm text-yellow-600 self-center">Você tem alterações não salvas</span>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
