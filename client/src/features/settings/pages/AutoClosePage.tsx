import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Power, PowerOff, Play, Clock, MessageSquareX } from "lucide-react";
import { useLocation } from "wouter";

interface AutoCloseStatus {
  enabled: boolean;
  workerRunning: boolean;
  inactiveConversationsCount: number;
  inactivityTimeoutMinutes: number;
}

export function AutoClosePage() {
  const [, navigate] = useLocation();
  const [closeLimitInput, setCloseLimitInput] = useState("10");
  const queryClient = useQueryClient();

  const closeLimit = parseInt(closeLimitInput) || 10;

  const { data: status, isLoading } = useQuery<AutoCloseStatus>({
    queryKey: ["/api/maintenance/auto-close/status"],
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/maintenance/auto-close/enable", { method: "POST" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/maintenance/auto-close/status"] }),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/maintenance/auto-close/disable", { method: "POST" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/maintenance/auto-close/status"] }),
  });

  const closeManualMutation = useMutation({
    mutationFn: async (limit: number) => {
      const res = await fetch(`/api/maintenance/auto-close/close-inactive?limit=${limit}`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/maintenance/auto-close/status"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/settings/maintenance")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Encerramento de Conversas</h1>
          <p className="text-gray-600">Controle o encerramento automático de conversas inativas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status?.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              {status?.enabled ? (
                <Power className="w-5 h-5 text-green-600" />
              ) : (
                <PowerOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Encerramento Automático</h3>
              <p className="text-sm text-gray-500">
                {status?.enabled ? "Ativado" : "Pausado"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => enableMutation.mutate()}
              disabled={status?.enabled || enableMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Power className="w-4 h-4" />
              Ativar
            </button>
            <button
              onClick={() => disableMutation.mutate()}
              disabled={!status?.enabled || disableMutation.isPending}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <PowerOff className="w-4 h-4" />
              Pausar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tempo de Inatividade</h3>
              <p className="text-sm text-gray-500">
                {status?.inactivityTimeoutMinutes} minutos
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Conversas são consideradas inativas após {status?.inactivityTimeoutMinutes} minutos sem novas mensagens.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <MessageSquareX className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Encerramento Manual</h3>
            <p className="text-sm text-gray-500">
              {status?.inactiveConversationsCount} conversas inativas aguardando
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Quantidade:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={closeLimitInput}
              onChange={(e) => setCloseLimitInput(e.target.value)}
              onBlur={() => {
                const num = parseInt(closeLimitInput);
                if (isNaN(num) || num < 1) {
                  setCloseLimitInput("1");
                } else if (num > 100) {
                  setCloseLimitInput("100");
                }
              }}
              className="w-20 px-3 py-2 border rounded-lg text-center"
            />
          </div>
          <button
            onClick={() => closeManualMutation.mutate(closeLimit)}
            disabled={closeManualMutation.isPending || status?.inactiveConversationsCount === 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {closeManualMutation.isPending ? "Encerrando..." : `Encerrar ${closeLimit} conversas`}
          </button>
        </div>

        {closeManualMutation.data && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              {closeManualMutation.data.message}
            </p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Como funciona</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>- Conversas sem mensagens há mais de {status?.inactivityTimeoutMinutes} minutos são consideradas inativas</li>
          <li>- Quando uma nova conversa chega para um usuário, a anterior é encerrada automaticamente</li>
          <li>- O encerramento automático pode ser pausado a qualquer momento</li>
          <li>- Use o encerramento manual para processar conversas gradualmente</li>
        </ul>
      </div>
    </div>
  );
}
