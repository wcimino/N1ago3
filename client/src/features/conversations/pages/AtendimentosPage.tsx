import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, Bot, Brain, UserCircle, Settings2, Star } from "lucide-react";
import { LoadingState, EmptyState, Pagination, SegmentedTabs } from "../../../shared/components/ui";
import { useDateFormatters, usePaginatedQuery } from "../../../shared/hooks";
import { fetchApi } from "../../../lib/queryClient";
import { FilterBar, UserGroupCard } from "../components";
import { RoutingRulesContent } from "../../routing/components/RoutingRulesContent";
import { FavoritosContent, useFavorites } from "../../favorites";
import type { UserGroup } from "../../../types";

interface FiltersResponse {
  productStandards: string[];
  intents: string[];
}

const HANDLER_TABS = [
  { id: "all", label: "Todos", icon: <Users className="w-4 h-4" /> },
  { id: "bot", label: "Bot Zendesk", icon: <Bot className="w-4 h-4" /> },
  { id: "human", label: "Humano", icon: <UserCircle className="w-4 h-4" /> },
  { id: "n1ago", label: "n1ago", icon: <Brain className="w-4 h-4" /> },
  { id: "favoritos", label: "Favoritos", icon: <Star className="w-4 h-4" /> },
];

const CONFIG_TABS = [
  { id: "atendimento", label: "Atendimento", icon: <Users className="w-4 h-4" /> },
  { id: "routing", label: "Roteamento", icon: <Settings2 className="w-4 h-4" /> },
];

export function AtendimentosPage() {
  const [location, navigate] = useLocation();
  const search = useSearch();

  const urlParams = new URLSearchParams(search);
  const initialProductStandard = urlParams.get("productStandard") || "";
  const initialIntent = urlParams.get("intent") || "";
  const initialEmotionLevel = urlParams.get("emotionLevel") || "";

  const [productStandardFilter, setProductStandardFilter] = useState<string>(initialProductStandard);
  const [intentFilter, setIntentFilter] = useState<string>(initialIntent);
  const [emotionLevelFilter, setEmotionLevelFilter] = useState<string>(initialEmotionLevel);
  const [handlerFilter, setHandlerFilter] = useState<string>("all");
  const [clientFilterInput, setClientFilterInput] = useState<string>("");
  const [clientFilterDebounced, setClientFilterDebounced] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setClientFilterDebounced(clientFilterInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientFilterInput]);

  const isRoutingView = location.includes("/routing");
  const isFavoritosView = location.includes("/favoritos");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const productStandard = params.get("productStandard") || "";
    const intent = params.get("intent") || "";
    const emotionLevel = params.get("emotionLevel") || "";
    setProductStandardFilter(productStandard);
    setIntentFilter(intent);
    setEmotionLevelFilter(emotionLevel);
  }, [search]);

  const { formatShortDateTime } = useDateFormatters();
  const { favoriteIds, toggleFavorite, isToggling } = useFavorites();

  const { data: filters } = useQuery<FiltersResponse>({
    queryKey: ["conversations-filters"],
    queryFn: () => fetchApi<FiltersResponse>("/api/conversations/filters"),
  });

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (productStandardFilter) params.set("productStandard", productStandardFilter);
    if (intentFilter) params.set("intent", intentFilter);
    if (handlerFilter && handlerFilter !== "all") params.set("handler", handlerFilter);
    if (emotionLevelFilter) params.set("emotionLevel", emotionLevelFilter);
    if (clientFilterDebounced) params.set("client", clientFilterDebounced);
    const queryString = params.toString();
    return queryString ? `/api/conversations/grouped?${queryString}` : "/api/conversations/grouped";
  }, [productStandardFilter, intentFilter, handlerFilter, emotionLevelFilter, clientFilterDebounced]);

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
    queryKey: `conversations-grouped-${productStandardFilter}-${intentFilter}-${handlerFilter}-${emotionLevelFilter}-${clientFilterDebounced}`,
    endpoint,
    limit: 20,
    dataKey: "user_groups",
  });

  const hasFilters = productStandardFilter || intentFilter || emotionLevelFilter || clientFilterInput;

  const clearFilters = () => {
    setProductStandardFilter("");
    setIntentFilter("");
    setEmotionLevelFilter("");
    setClientFilterInput("");
  };

  const handleConfigTabChange = (tabId: string) => {
    if (tabId === "routing") {
      navigate("/atendimentos/routing");
    } else if (tabId === "atendimento") {
      navigate("/atendimentos");
    }
  };

  const getActiveConfigTab = () => {
    if (isRoutingView) return "routing";
    return "atendimento";
  };

  const getActiveHandlerTab = () => {
    if (isFavoritosView) return "favoritos";
    return handlerFilter;
  };

  const handleHandlerTabChange = (tabId: string) => {
    if (tabId === "favoritos") {
      navigate("/atendimentos/favoritos");
    } else {
      setHandlerFilter(tabId);
      if (isFavoritosView) {
        navigate("/atendimentos");
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Atendimentos</h2>
          <p className="text-sm text-gray-500 mt-1">Lista de atendimentos agrupados por usuário</p>
        </div>
        <div className="shrink-0">
          <SegmentedTabs
            tabs={CONFIG_TABS}
            activeTab={getActiveConfigTab()}
            onChange={handleConfigTabChange}
          />
        </div>
      </div>

      {!isRoutingView && (
        <div className="px-4 py-3 border-b">
          <SegmentedTabs tabs={HANDLER_TABS} activeTab={getActiveHandlerTab()} onChange={handleHandlerTabChange} />
        </div>
      )}

      {isRoutingView ? (
        <RoutingRulesContent />
      ) : isFavoritosView ? (
        <FavoritosContent />
      ) : (
        <>
          <FilterBar
            productStandards={filters?.productStandards || []}
            intents={filters?.intents || []}
            productStandardFilter={productStandardFilter}
            intentFilter={intentFilter}
            emotionLevelFilter={emotionLevelFilter}
            clientFilter={clientFilterInput}
            onProductStandardChange={setProductStandardFilter}
            onIntentChange={setIntentFilter}
            onEmotionLevelChange={setEmotionLevelFilter}
            onClientChange={setClientFilterInput}
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
                    onViewConversations={(userId) => navigate(`/atendimentos/${encodeURIComponent(userId)}`)}
                    formatDateTime={formatShortDateTime}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={toggleFavorite}
                    isTogglingFavorite={isToggling}
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
        </>
      )}
    </div>
  );
}
