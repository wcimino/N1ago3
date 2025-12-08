import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Clock,
  BarChart3,
  Filter,
  Lightbulb,
} from "lucide-react";

interface LearningAttempt {
  id: number;
  conversationId: number;
  externalConversationId: string | null;
  result: string;
  resultReason: string | null;
  suggestionId: number | null;
  messageCount: number | null;
  openaiLogId: number | null;
  createdAt: string;
}

interface Stats {
  total: number;
  suggestionCreated: number;
  insufficientMessages: number;
  skippedByAgent: number;
  processingError: number;
}

type ResultFilter = "all" | "suggestion_created" | "insufficient_messages" | "skipped_by_agent" | "processing_error";

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    suggestion_created: "bg-green-100 text-green-800",
    insufficient_messages: "bg-yellow-100 text-yellow-800",
    skipped_by_agent: "bg-gray-100 text-gray-800",
    processing_error: "bg-red-100 text-red-800",
  };

  const icons: Record<string, React.ReactNode> = {
    suggestion_created: <CheckCircle className="w-3 h-3" />,
    insufficient_messages: <MessageSquare className="w-3 h-3" />,
    skipped_by_agent: <XCircle className="w-3 h-3" />,
    processing_error: <AlertTriangle className="w-3 h-3" />,
  };

  const labels: Record<string, string> = {
    suggestion_created: "Sugestão Criada",
    insufficient_messages: "Poucas Mensagens",
    skipped_by_agent: "Sem Conhecimento",
    processing_error: "Erro",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[result] || "bg-gray-100 text-gray-800"}`}>
      {icons[result]}
      {labels[result] || result}
    </span>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`p-3 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
    </div>
  );
}

export function LearningAttemptsPage() {
  const [filter, setFilter] = useState<ResultFilter>("all");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/learning-attempts/stats"],
    queryFn: async () => {
      const res = await fetch("/api/learning-attempts/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: attempts = [], isLoading } = useQuery<LearningAttempt[]>({
    queryKey: ["/api/learning-attempts", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("result", filter);
      params.set("limit", "100");
      const res = await fetch(`/api/learning-attempts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch attempts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filterOptions: { value: ResultFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "suggestion_created", label: "Sugestões" },
    { value: "insufficient_messages", label: "Poucas Msgs" },
    { value: "skipped_by_agent", label: "Sem Conhecimento" },
    { value: "processing_error", label: "Erros" },
  ];

  const extractionRate = stats && stats.total > 0 
    ? ((stats.suggestionCreated / stats.total) * 100).toFixed(1) 
    : "0";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          value={stats?.total || 0}
          icon={<BarChart3 className="w-5 h-5" />}
          color="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="Sugestões"
          value={stats?.suggestionCreated || 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="bg-green-50 border-green-200"
        />
        <StatCard
          label="Poucas Msgs"
          value={stats?.insufficientMessages || 0}
          icon={<MessageSquare className="w-5 h-5" />}
          color="bg-yellow-50 border-yellow-200"
        />
        <StatCard
          label="Sem Conhecimento"
          value={stats?.skippedByAgent || 0}
          icon={<XCircle className="w-5 h-5" />}
          color="bg-gray-50 border-gray-200"
        />
      </div>

      {stats && stats.total > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Taxa de extração:</strong> {extractionRate}% das conversas processadas geraram sugestões
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === option.value
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Carregando...</p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma tentativa registrada</p>
          </div>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                <ResultBadge result={attempt.result} />
                
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700">
                    Conversa #{attempt.conversationId}
                  </span>
                  {attempt.resultReason && (
                    <p className="text-xs text-gray-400 truncate">{attempt.resultReason}</p>
                  )}
                </div>

                {attempt.messageCount && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {attempt.messageCount}
                  </span>
                )}

                {attempt.suggestionId && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    #{attempt.suggestionId}
                  </span>
                )}

                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {format(new Date(attempt.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
