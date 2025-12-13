import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { LoadingState, Button } from "../../../shared/components/ui";
import type { EventTypeMapping, EventTypeMappingsResponse } from "../../../types";

export function EventTypeMappingsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ display_name: "", description: "", show_in_list: true });

  const { data, isLoading } = useQuery<EventTypeMappingsResponse>({
    queryKey: ["event-type-mappings"],
    queryFn: () => fetchApi<EventTypeMappingsResponse>("/api/event-type-mappings"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/event-type-mappings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type-mappings"] });
      setEditingId(null);
    },
  });

  const toggleShowMutation = useMutation({
    mutationFn: async ({ id, show_in_list }: { id: number; show_in_list: boolean }) => {
      const res = await apiRequest("PUT", `/api/event-type-mappings/${id}`, { show_in_list });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-type-mappings"] });
    },
  });

  const startEdit = (mapping: EventTypeMapping) => {
    setEditingId(mapping.id);
    setEditForm({
      display_name: mapping.display_name,
      description: mapping.description || "",
      show_in_list: mapping.show_in_list,
    });
  };

  const saveEdit = (id: number) => {
    updateMutation.mutate({ id, data: editForm });
  };

  const renderToggle = (mapping: EventTypeMapping) => (
    <button
      onClick={() => toggleShowMutation.mutate({ id: mapping.id, show_in_list: !mapping.show_in_list })}
      disabled={toggleShowMutation.isPending}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
        mapping.show_in_list ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
          mapping.show_in_list ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );

  const renderMobileCard = (mapping: EventTypeMapping) => (
    <div key={mapping.id} className="p-4 bg-white border-b last:border-b-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{mapping.source}:{mapping.event_type}</code>
        </div>
        {renderToggle(mapping)}
      </div>
      
      {editingId === mapping.id ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nome Amigável</label>
            <input
              type="text"
              value={editForm.display_name}
              onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Descrição</label>
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Descrição opcional"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => saveEdit(mapping.id)}
              disabled={updateMutation.isPending}
              isLoading={updateMutation.isPending}
              size="sm"
              fullWidth
            >
              Salvar
            </Button>
            <Button
              onClick={() => setEditingId(null)}
              variant="secondary"
              size="sm"
              fullWidth
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-900">{mapping.display_name}</span>
          </div>
          {mapping.description && (
            <p className="text-sm text-gray-500">{mapping.description}</p>
          )}
          <button
            onClick={() => startEdit(mapping)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Editar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Mapeamento de Tipos de Eventos</h2>
          <p className="text-sm text-gray-500 mt-1">Configure nomes amigáveis e visibilidade para cada tipo de evento</p>
        </div>

        {isLoading ? (
          <LoadingState message="Carregando mapeamentos..." />
        ) : !data?.mappings || data.mappings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhum mapeamento configurado.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Original</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome Amigável</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mostrar</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{mapping.source}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{mapping.event_type}</code>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === mapping.id ? (
                          <input
                            type="text"
                            value={editForm.display_name}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{mapping.display_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === mapping.id ? (
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Descrição opcional"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{mapping.description || "-"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderToggle(mapping)}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === mapping.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(mapping.id)}
                              disabled={updateMutation.isPending}
                              className="text-sm text-green-600 hover:text-green-800"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(mapping)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {data.mappings.map(renderMobileCard)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
