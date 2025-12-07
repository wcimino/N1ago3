import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, Bot, Brain, UserCircle } from "lucide-react";
import { UserDetailModal } from "../../../shared/components";
import { LoadingState, EmptyState, Pagination, PageCard, SegmentedTabs } from "../../../shared/components/ui";
import { useDateFormatters, usePaginatedQuery } from "../../../shared/hooks";
import { fetchApi } from "../../../lib/queryClient";
import { FilterBar, UserGroupCard } from "../components";
import type { User as UserType, UserGroup } from "../../../types";

interface FiltersResponse {
  productStandards: string[];
  intents: string[];
}

const HANDLER_TABS = [
  { id: "all", label: "Todos", icon: <Users className="w-4 h-4" /> },
  { id: "bot", label: "Bot Zendesk", icon: <Bot className="w-4 h-4" /> },
  { id: "human", label: "Humano", icon: <UserCircle className="w-4 h-4" /> },
  { id: "n1ago", label: "n1ago", icon: <Brain className="w-4 h-4" /> },
];

export function AtendimentosPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  const urlParams = new URLSearchParams(search);
  const initialProductStandard = urlParams.get("productStandard") || "";
  const initialIntent = urlParams.get("intent") || "";

  const [productStandardFilter, setProductStandardFilter] = useState<string>(initialProductStandard);
  const [intentFilter, setIntentFilter] = useState<string>(initialIntent);
  const [handlerFilter, setHandlerFilter] = useState<string>("all");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const productStandard = params.get("productStandard") || "";
    const intent = params.get("intent") || "";
    setProductStandardFilter(productStandard);
    setIntentFilter(intent);
  }, [search]);

  const { formatShortDateTime } = useDateFormatters();

  const { data: filters } = useQuery<FiltersResponse>({
    queryKey: ["conversations-filters"],
    queryFn: () => fetchApi<FiltersResponse>("/api/conversations/filters"),
  });

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (productStandardFilter) params.set("productStandard", productStandardFilter);
    if (intentFilter) params.set("intent", intentFilter);
    if (handlerFilter && handlerFilter !== "all") params.set("handler", handlerFilter);
    const queryString = params.toString();
    return queryString ? `/api/conversations/grouped?${queryString}` : "/api/conversations/grouped";
  }, [productStandardFilter, intentFilter, handlerFilter]);

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
    queryKey: `conversations-grouped-${productStandardFilter}-${intentFilter}-${handlerFilter}`,
    endpoint,
    limit: 20,
    dataKey: "user_groups",
  });

  const hasFilters = productStandardFilter || intentFilter;

  const clearFilters = () => {
    setProductStandardFilter("");
    setIntentFilter("");
  };

  return (
    <PageCard title="Atendimentos" description="Lista de atendimentos agrupados por usuário">
      <div className="px-4 py-3 border-b">
        <SegmentedTabs tabs={HANDLER_TABS} activeTab={handlerFilter} onChange={setHandlerFilter} />
      </div>

      <FilterBar
        productStandards={filters?.productStandards || []}
        intents={filters?.intents || []}
        productStandardFilter={productStandardFilter}
        intentFilter={intentFilter}
        onProductStandardChange={setProductStandardFilter}
        onIntentChange={setIntentFilter}
        onClear={clearFilters}
      />

      {isLoading ? (
        <LoadingState />
      ) : userGroups.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-12 h-12 text-gray-300" />}
          title={hasFilters ? "Nenhum resultado encontrado." : "Nenhuma conversa registrada ainda."}
          description={
            hasFilters
              ? "Tente ajustar os filtros selecionados."
              : "As conversas serão criadas quando mensagens chegarem via webhook."
          }
        />
      ) : (
        <>
          <div className="divide-y divide-gray-200">
            {userGroups.map((group) => (
              <UserGroupCard
                key={group.user_id}
                group={group}
                onViewUser={setSelectedUser}
                onViewConversations={(userId) => navigate(`/atendimentos/${encodeURIComponent(userId)}`)}
                formatDateTime={formatShortDateTime}
              />
            ))}
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
