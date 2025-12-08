import { useState, useMemo } from "react";
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
  ChevronRight,
  ChevronDown,
  ExternalLink,
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

type ResultType = "suggestion_created" | "insufficient_messages" | "skipped_by_agent" | "processing_error";

interface ResultGroup {
  result: ResultType;
  label: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  attempts: LearningAttempt[];
}

function buildGroups(attempts: LearningAttempt[]): ResultGroup[] {
  const config: Record<ResultType, Omit<ResultGroup, "attempts">> = {
    suggestion_created: {
      result: "suggestion_created",
      label: "Sugestões Criadas",
      icon: <CheckCircle className="w-4 h-4" />,
      color: "text-green-700",
      badgeColor: "bg-green-100 text-green-800 border-green-200",
    },
    insufficient_messages: {
      result: "insufficient_messages",
      label: "Poucas Mensagens",
      icon: <MessageSquare className="w-4 h-4" />,
      color: "text-yellow-700",
      badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    skipped_by_agent: {
      result: "skipped_by_agent",
      label: "Sem Conhecimento Novo",
      icon: <XCircle className="w-4 h-4" />,
      color: "text-gray-600",
      badgeColor: "bg-gray-100 text-gray-800 border-gray-200",
    },
    processing_error: {
      result: "processing_error",
      label: "Erros de Processamento",
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-red-700",
      badgeColor: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const groups: ResultGroup[] = [];

  for (const resultType of ["suggestion_created", "insufficient_messages", "skipped_by_agent", "processing_error"] as ResultType[]) {
    const filtered = attempts.filter(a => a.result === resultType);
    if (filtered.length > 0) {
      groups.push({
        ...config[resultType],
        attempts: filtered,
      });
    }
  }

  return groups;
}

interface AttemptItemProps {
  attempt: LearningAttempt;
  depth: number;
}

function AttemptItem({ attempt, depth }: AttemptItemProps) {
  return (
    <div 
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group"
      style={{ marginLeft: `${depth * 24}px` }}
    >
      <div className="w-4" />
      
      <span className="text-sm text-gray-700 flex-1">
        Conversa #{attempt.conversationId}
        {attempt.externalConversationId && (
          <span className="text-gray-400 ml-2 text-xs">
            ({attempt.externalConversationId.substring(0, 8)}...)
          </span>
        )}
      </span>

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

      <span className="text-xs text-gray-400">
        {format(new Date(attempt.createdAt), "dd/MM HH:mm", { locale: ptBR })}
      </span>
    </div>
  );
}

interface GroupItemProps {
  group: ResultGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

function GroupItem({ group, isExpanded, onToggle }: GroupItemProps) {
  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <button className="p-0.5 rounded hover:bg-gray-200">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <span className={`flex items-center gap-1.5 ${group.color}`}>
          {group.icon}
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{group.label}</span>

        <span className={`px-2 py-0.5 text-xs rounded-full border ${group.badgeColor}`}>
          {group.attempts.length}
        </span>
      </div>

      {isExpanded && (
        <div>
          {group.attempts.slice(0, 50).map((attempt) => (
            <AttemptItem
              key={attempt.id}
              attempt={attempt}
              depth={1}
            />
          ))}
          {group.attempts.length > 50 && (
            <div 
              className="text-xs text-gray-400 py-2 px-3"
              style={{ marginLeft: "24px" }}
            >
              ... e mais {group.attempts.length - 50} itens
            </div>
          )}
        </div>
      )}
    </div>
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["suggestion_created"]));

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
    queryKey: ["/api/learning-attempts"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "500");
      const res = await fetch(`/api/learning-attempts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch attempts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const groups = useMemo(() => buildGroups(attempts), [attempts]);

  const toggleGroup = (result: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(result)) {
        next.delete(result);
      } else {
        next.add(result);
      }
      return next;
    });
  };

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
            <strong>Taxa de extração:</strong> {extractionRate}% das conversas processadas geraram sugestões de conhecimento
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700">Tentativas de Extração</h4>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Carregando...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhuma tentativa de extração registrada</p>
            <p className="text-sm mt-1">As tentativas aparecerão aqui quando conversas forem processadas</p>
          </div>
        ) : (
          <div className="p-3 space-y-1 max-h-[400px] overflow-y-auto">
            {groups.map((group) => (
              <GroupItem
                key={group.result}
                group={group}
                isExpanded={expandedGroups.has(group.result)}
                onToggle={() => toggleGroup(group.result)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
