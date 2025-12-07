import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, Activity, User, UserCheck, Filter, X } from "lucide-react";
import { UserDetailModal, LoadingState, EmptyState, Pagination, PageCard } from "../components";
import { useDateFormatters } from "../hooks/useDateFormatters";
import { getUserDisplayName, getActiveConversationsCount, getUserFromGroup } from "../lib/userUtils";
import { usePaginatedQuery } from "../hooks/usePaginatedQuery";
import { fetchApi } from "../lib/queryClient";
import type { User as UserType, UserGroup } from "../types";

interface FiltersResponse {
  products: string[];
  intents: string[];
}

export function AtendimentosPage() {
  const [, navigate] = useLocation();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [productFilter, setProductFilter] = useState<string>("");
  const [intentFilter, setIntentFilter] = useState<string>("");
  const { formatShortDateTime } = useDateFormatters();

  const { data: filters } = useQuery<FiltersResponse>({
    queryKey: ["conversations-filters"],
    queryFn: () => fetchApi<FiltersResponse>("/api/conversations/filters"),
  });

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (productFilter) params.set("product", productFilter);
    if (intentFilter) params.set("intent", intentFilter);
    const queryString = params.toString();
    return queryString ? `/api/conversations/grouped?${queryString}` : "/api/conversations/grouped";
  }, [productFilter, intentFilter]);

  const {
    data: userGroups,
    total,
    page,
    totalPages,
    isLoading,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  } = usePaginatedQuery<UserGroup>({
    queryKey: `conversations-grouped-${productFilter}-${intentFilter}`,
    endpoint,
    limit: 20,
    dataKey: "user_groups",
  });

  const hasFilters = productFilter || intentFilter;

  const clearFilters = () => {
    setProductFilter("");
    setIntentFilter("");
  };

  return (
    <PageCard
      title="Atendimentos"
      description="Lista de atendimentos agrupados por usuário"
    >
      <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os produtos</option>
            {filters?.products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todas as intenções</option>
            {filters?.intents.map((intent) => (
              <option key={intent} value={intent}>
                {intent}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 px-2 py-1"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : userGroups.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-12 h-12 text-gray-300" />}
          title={hasFilters ? "Nenhum resultado encontrado." : "Nenhuma conversa registrada ainda."}
          description={hasFilters ? "Tente ajustar os filtros selecionados." : "As conversas serão criadas quando mensagens chegarem via webhook."}
        />
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {userGroups.map((group) => {
              const activeCount = getActiveConversationsCount(group.conversations);
              
              return (
                <div key={group.user_id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{getUserDisplayName(group)}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {group.user_info?.authenticated && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <UserCheck className="w-3 h-3" />
                                Autenticado
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <MessageCircle className="w-3 h-3" />
                              {group.conversation_count} {group.conversation_count === 1 ? "conversa" : "conversas"}
                            </span>
                            {activeCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {activeCount} ativa{activeCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {group.user_info && (
                          <button
                            onClick={() => {
                              const user = getUserFromGroup(group);
                              if (user) setSelectedUser(user);
                            }}
                            title="Ver detalhes do usuário"
                            className="p-2 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <User className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/atendimentos/${encodeURIComponent(group.user_id)}`)}
                          title="Ver conversas"
                          className="p-2 border border-gray-200 text-gray-600 hover:text-green-600 hover:border-green-300 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/events?user=${encodeURIComponent(group.user_id)}`}
                          title="Ver eventos"
                          className="p-2 border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Activity className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-500">Último atendimento:</span>
                      {group.last_product && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {group.last_product}
                        </span>
                      )}
                      {group.last_intent && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {group.last_intent}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{formatShortDateTime(group.last_activity)}</span>
                    </div>

                    {group.conversations.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {group.conversations.map((conv, idx) => (
                          <span
                            key={conv.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              conv.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            #{idx + 1} - {formatShortDateTime(conv.created_at)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            showingFrom={showingFrom}
            showingTo={showingTo}
            total={total}
            onPreviousPage={previousPage}
            onNextPage={nextPage}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            itemLabel="usuários"
          />
        </>
      )}

      {selectedUser !== null && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </PageCard>
  );
}
