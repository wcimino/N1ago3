import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export interface UsePaginatedQueryOptions<T> {
  queryKey: string;
  endpoint: string;
  limit?: number;
  refetchInterval?: number;
  dataKey?: string;
  enabled?: boolean;
}

export interface UsePaginatedQueryResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  showingFrom: number;
  showingTo: number;
  refetch: () => void;
}

export function usePaginatedQuery<T>({
  queryKey,
  endpoint,
  limit = 20,
  refetchInterval = 5000,
  dataKey = "data",
  enabled = true,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryResult<T> {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [queryKey, endpoint]);

  const { data: responseData, isLoading, isError, error, refetch } = useQuery({
    queryKey: [queryKey, page, limit, endpoint],
    queryFn: async () => {
      const separator = endpoint.includes("?") ? "&" : "?";
      const url = `${endpoint}${separator}limit=${limit}&offset=${page * limit}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    },
    refetchInterval,
    enabled,
  });

  const data = useMemo(() => {
    if (!responseData) return [];
    return responseData[dataKey] || responseData.data || [];
  }, [responseData, dataKey]);

  const total = responseData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const goToPage = useCallback((newPage: number) => {
    const maxPage = Math.max(0, totalPages - 1);
    setPage(Math.max(0, Math.min(newPage, maxPage)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (totalPages > 0 && page < totalPages - 1) {
      setPage((p) => p + 1);
    }
  }, [totalPages, page]);

  const previousPage = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
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
    limit,
    isLoading,
    isError,
    error: error as Error | null,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    showingFrom,
    showingTo,
    refetch,
  };
}
