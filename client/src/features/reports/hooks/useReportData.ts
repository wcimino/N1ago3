import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useEffect } from "react";

export type PeriodFilter = "1h" | "24h" | "all";

export const periodLabels: Record<PeriodFilter, string> = {
  "1h": "Última 1h",
  "24h": "Últimas 24h",
  "all": "Todo período",
};

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

interface UseReportDataOptions {
  endpoint: string;
  period: PeriodFilter;
  queryKey: string;
  limit?: number;
}

export function useReportData<T>({ endpoint, period, queryKey, limit = 10 }: UseReportDataOptions) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [period, endpoint, queryKey]);

  const offset = page * limit;

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: ["reports", queryKey, period, page, limit],
    queryFn: async () => {
      const response = await fetch(`${endpoint}?period=${period}&limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error("Falha ao carregar relatório");
      return response.json();
    },
  });

  const data = query.data?.data || [];
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const nextPage = useCallback(() => {
    if (page < totalPages - 1) {
      setPage(p => p + 1);
    }
  }, [page, totalPages]);

  const previousPage = useCallback(() => {
    setPage(p => Math.max(0, p - 1));
  }, []);

  const hasNextPage = totalPages > 0 && page < totalPages - 1;
  const hasPreviousPage = page > 0;
  const showingFrom = total > 0 ? page * limit + 1 : 0;
  const showingTo = Math.min((page + 1) * limit, total);

  return {
    data,
    total,
    page,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    isFetching: query.isFetching,
    refetch: query.refetch,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
  };
}
