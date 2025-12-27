import { Wrench, CheckCircle2, Clock, AlertCircle, XCircle, SkipForward, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SolutionAction {
  id: number;
  externalActionId: string | null;
  sequence: number;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  actionType: string;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface SolutionData {
  solution: {
    id: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  actions: SolutionAction[];
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; bgColor: string; textColor: string }> = {
  pending: {
    icon: <Clock className="w-3 h-3" />,
    label: "Pendente",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  in_progress: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "Em andamento",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
  },
  completed: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "Concluído",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
  failed: {
    icon: <XCircle className="w-3 h-3" />,
    label: "Falhou",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
  },
  skipped: {
    icon: <SkipForward className="w-3 h-3" />,
    label: "Pulado",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
  },
};

const actionTypeLabels: Record<string, string> = {
  transferir_humano: "Transferir para humano",
  transfer_to_human: "Transferir para humano",
  instruction: "Instrução",
  informar_cliente: "Informar cliente",
  link: "Enviar link",
  api_call: "Chamada de API",
  acao_interna_manual: "Ação interna",
  consultar_perfil_cliente: "Consultar perfil",
  perguntar_ao_cliente: "Perguntar ao cliente",
  outro: "Outro",
  unknown: "Ação",
};

const solutionStatusConfig: Record<string, { label: string; color: string }> = {
  pending_info: { label: "Aguardando info", color: "bg-gray-100 text-gray-700" },
  pending_action: { label: "Aguardando ação", color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "Em andamento", color: "bg-blue-100 text-blue-700" },
  resolved: { label: "Resolvido", color: "bg-green-100 text-green-700" },
  escalated: { label: "Escalado", color: "bg-orange-100 text-orange-700" },
  error: { label: "Erro", color: "bg-red-100 text-red-700" },
};

export interface SolutionCardProps {
  conversationId: number;
}

export function SolutionCard({ conversationId }: SolutionCardProps) {
  const { data, isLoading, isError } = useQuery<SolutionData>({
    queryKey: ["/api/conversations", conversationId, "solution"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/solution`);
      if (!res.ok) return { solution: null, actions: [] };
      return res.json();
    },
    refetchInterval: 5000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg p-3 bg-cyan-50 border border-cyan-200">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
          <span className="text-sm text-cyan-700">Carregando solução...</span>
        </div>
      </div>
    );
  }

  if (isError || !data?.solution) {
    return (
      <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-gray-400">
            <Wrench className="w-4 h-4" />
          </div>
          <h4 className="font-medium text-gray-500 text-sm">Solução</h4>
        </div>
        <div className="text-sm text-gray-400 italic">
          Nenhuma solução iniciada
        </div>
      </div>
    );
  }

  const solutionStatus = solutionStatusConfig[data.solution.status] || {
    label: data.solution.status,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="rounded-lg p-3 bg-cyan-50 border border-cyan-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-cyan-600">
          <Wrench className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Solução</h4>
        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${solutionStatus.color}`}>
          {solutionStatus.label}
        </span>
      </div>

      {data.actions.length > 0 ? (
        <div className="space-y-2">
          {data.actions.map((action, index) => {
            const config = statusConfig[action.status] || statusConfig.pending;
            const actionLabel = actionTypeLabels[action.actionType] || action.actionType;
            
            return (
              <div 
                key={action.id} 
                className="rounded px-3 py-2 bg-white border border-cyan-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono w-5">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {action.description || actionLabel}
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                    {config.icon}
                    {config.label}
                  </span>
                </div>
                {action.errorMessage && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{action.errorMessage}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhuma ação definida
        </div>
      )}
    </div>
  );
}
