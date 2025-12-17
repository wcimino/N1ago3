import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronRight, Webhook, Copy, RefreshCw, ToggleLeft, ToggleRight, Download, Pencil } from "lucide-react";
import { apiRequest, fetchApi } from "../../../lib/queryClient";
import { LoadingState, EmptyState, Button } from "../../../shared/components";
import { useDateFormatters } from "../../../shared/hooks";

interface ExternalEventSource {
  id: number;
  name: string;
  source: string;
  channel_type: string;
  api_key?: string;
  api_key_masked?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

interface ExternalEventSourcesResponse {
  sources: ExternalEventSource[];
}

export function ExternalEventsTab() {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newChannelType, setNewChannelType] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<Map<number, string>>(new Map());
  const [editingSource, setEditingSource] = useState<ExternalEventSource | null>(null);
  const [editName, setEditName] = useState("");
  const [editChannelType, setEditChannelType] = useState("");
  const [editError, setEditError] = useState("");
  const queryClient = useQueryClient();
  const { formatShortDateTime } = useDateFormatters();

  const { data, isLoading } = useQuery<ExternalEventSourcesResponse>({
    queryKey: ["external-event-sources"],
    queryFn: () => fetchApi<ExternalEventSourcesResponse>("/api/external-event-sources"),
  });

  const sources = data?.sources || [];

  const addMutation = useMutation({
    mutationFn: async ({ name, source, channel_type }: { name: string; source: string; channel_type: string }) => {
      const res = await apiRequest("POST", "/api/external-event-sources", { name, source, channel_type });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      if (data.api_key) {
        setNewlyCreatedKeys((prev) => new Map(prev).set(data.id, data.api_key));
      }
      setNewName("");
      setNewSource("");
      setNewChannelType("");
      setError("");
      setShowForm(false);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao adicionar sistema");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, channel_type }: { id: number; name: string; channel_type: string }) => {
      const res = await apiRequest("PUT", `/api/external-event-sources/${id}`, { name, channel_type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      setEditingSource(null);
      setEditName("");
      setEditChannelType("");
      setEditError("");
    },
    onError: (err: any) => {
      setEditError(err.message || "Erro ao atualizar sistema");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const res = await apiRequest("PUT", `/api/external-event-sources/${id}`, { is_active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/external-event-sources/${id}/regenerate-key`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
      if (data.api_key) {
        setNewlyCreatedKeys((prev) => new Map(prev).set(data.id, data.api_key));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/external-event-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-event-sources"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newName.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!newSource.trim()) {
      setError("Source é obrigatório");
      return;
    }

    if (!newChannelType.trim()) {
      setError("Channel type é obrigatório");
      return;
    }

    addMutation.mutate({ name: newName.trim(), source: newSource.trim(), channel_type: newChannelType.trim() });
  };

  const handleEdit = (source: ExternalEventSource) => {
    setEditingSource(source);
    setEditName(source.name);
    setEditChannelType(source.channel_type);
    setEditError("");
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;

    if (!editName.trim()) {
      setEditError("Nome é obrigatório");
      return;
    }

    if (!editChannelType.trim()) {
      setEditError("Channel type é obrigatório");
      return;
    }

    updateMutation.mutate({ id: editingSource.id, name: editName.trim(), channel_type: editChannelType.trim() });
  };

  const copyToClipboard = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDisplayApiKey = (source: ExternalEventSource): string => {
    const newKey = newlyCreatedKeys.get(source.id);
    if (newKey) return newKey;
    return source.api_key_masked || "****";
  };

  const hasNewKey = (id: number): boolean => {
    return newlyCreatedKeys.has(id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-2">Como usar</h4>
            <p className="text-sm text-blue-800 mb-2">
              Cadastre sistemas externos que podem enviar eventos para o Niago. 
              Cada sistema recebe uma chave de API única.
            </p>
            <p className="text-sm text-blue-800">
              <strong>Endpoint:</strong> <code className="bg-blue-100 px-1 rounded">POST /api/events/ingest</code>
            </p>
            <p className="text-sm text-blue-800">
              <strong>Header:</strong> <code className="bg-blue-100 px-1 rounded">X-API-Key: sua_chave</code>
            </p>
          </div>
          <a
            href="/api/docs/external-events-integration"
            download="n1ago-external-events-integration.md"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Baixar documentação
          </a>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
        >
          <span className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            + Sistema Externo
          </span>
          {showForm ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showForm && (
          <div className="px-4 pb-4 border-t border-gray-200 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Sistema de Pedidos"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="Ex: orders_system"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Identificador único
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type *</label>
                  <input
                    type="text"
                    value={newChannelType}
                    onChange={(e) => setNewChannelType(e.target.value)}
                    placeholder="Ex: whatsapp"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tipo de canal (ex: whatsapp, email, chat)
                  </p>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                disabled={addMutation.isPending}
                isLoading={addMutation.isPending}
                leftIcon={!addMutation.isPending ? <Plus className="w-4 h-4" /> : undefined}
              >
                Adicionar
              </Button>
            </form>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">Sistemas Cadastrados</h3>

        {isLoading ? (
          <LoadingState />
        ) : sources.length === 0 ? (
          <EmptyState
            icon={<Webhook className="w-12 h-12" />}
            title="Nenhum sistema cadastrado"
            description="Adicione um sistema externo para começar a receber eventos"
          />
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className={`bg-white border rounded-lg p-4 ${
                  source.is_active ? "border-gray-200" : "border-gray-300 bg-gray-50 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{source.name}</h4>
                      {!source.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 flex flex-wrap gap-2">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        source: {source.source}
                      </span>
                      <span className="font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                        channel: {source.channel_type}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-500">API Key:</span>
                      <code className={`text-sm font-mono px-2 py-1 rounded ${hasNewKey(source.id) ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
                        {getDisplayApiKey(source)}
                      </code>
                      {hasNewKey(source.id) && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(newlyCreatedKeys.get(source.id)!, source.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copiar"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {copiedId === source.id && (
                            <span className="text-xs text-green-600">Copiado!</span>
                          )}
                          <span className="text-xs text-amber-600">
                            Copie agora! Esta chave não será exibida novamente.
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Criado em {formatShortDateTime(source.created_at)}
                      {source.created_by && ` por ${source.created_by}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEdit(source)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: source.id, is_active: !source.is_active })}
                      disabled={toggleMutation.isPending}
                      className={`p-1.5 rounded transition-colors ${
                        source.is_active
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                      title={source.is_active ? "Desativar" : "Ativar"}
                    >
                      {source.is_active ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Regenerar a chave de API? A chave antiga deixará de funcionar.")) {
                          regenerateKeyMutation.mutate(source.id);
                        }
                      }}
                      disabled={regenerateKeyMutation.isPending}
                      className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                      title="Regenerar chave"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir o sistema "${source.name}"? Esta ação não pode ser desfeita.`)) {
                          deleteMutation.mutate(source.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Editar Sistema Externo</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <input
                  type="text"
                  value={editingSource.source}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">O source não pode ser alterado</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type *</label>
                <input
                  type="text"
                  value={editChannelType}
                  onChange={(e) => setEditChannelType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSource(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  isLoading={updateMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
