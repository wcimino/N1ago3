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
  ExternalLink,
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
    skipped_by_agent: "Sem Conhecimento Novo",
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
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
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
    { value: "suggestion_created", label: "Sugestões Criadas" },
    { value: "insufficient_messages", label: "Poucas Mensagens" },
    { value: "skipped_by_agent", label: "Sem Conhecimento" },
    { value: "processing_error", label: "Erros" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Processado"
          value={stats?.total || 0}
          icon={<BarChart3 className="w-6 h-6" />}
          color="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="Sugestões Criadas"
          value={stats?.suggestionCreated || 0}
          icon={<CheckCircle className="w-6 h-6" />}
          color="bg-green-50 border-green-200"
        />
        <StatCard
          label="Poucas Mensagens"
          value={stats?.insufficientMessages || 0}
          icon={<MessageSquare className="w-6 h-6" />}
          color="bg-yellow-50 border-yellow-200"
        />
        <StatCard
          label="Sem Conhecimento"
          value={stats?.skippedByAgent || 0}
          icon={<XCircle className="w-6 h-6" />}
          color="bg-gray-50 border-gray-200"
        />
      </div>

      {stats && stats.total > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Taxa de extração:</span>{" "}
            {((stats.suggestionCreated / stats.total) * 100).toFixed(1)}% das conversas geraram sugestões
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === option.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
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
            <p>Nenhuma tentativa de extração registrada</p>
            <p className="text-sm mt-1">As tentativas aparecerão aqui quando conversas forem processadas</p>
          </div>
        ) : (
          <div className="divide-y">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ResultBadge result={attempt.result} />
                      {attempt.messageCount && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {attempt.messageCount} mensagens
                        </span>
                      )}
                      {attempt.suggestionId && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          Sugestão #{attempt.suggestionId}
                        </span>
                      )}
                    </div>
                    {attempt.resultReason && (
                      <p className="text-sm text-gray-600 mt-1">{attempt.resultReason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>Conversa #{attempt.conversationId}</span>
                      {attempt.externalConversationId && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {attempt.externalConversationId.substring(0, 12)}...
                        </span>
                      )}
                      <span>
                        {format(new Date(attempt.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
