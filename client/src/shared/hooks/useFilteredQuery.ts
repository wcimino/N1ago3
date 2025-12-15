import { useState, useMemo, useCallback } from "react";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface FilterConfig {
  key: string;
  paramName?: string;
  initialValue?: string;
}

export interface UseFilteredQueryOptions<T> {
  queryKey: string;
  endpoint: string;
  filters?: FilterConfig[];
  searchParamName?: string;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
}

export interface UseFilteredQueryResult<T> {
  data: T[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilteredQuery<T>({
  queryKey,
  endpoint,
  filters: filterConfigs = [],
  searchParamName = "search",
  enabled = true,
  refetchOnWindowFocus = false,
}: UseFilteredQueryOptions<T>): UseFilteredQueryResult<T> {
  const [searchTerm, setSearchTerm] = useState("");
  
  const initialFilters = useMemo(() => {
    return filterConfigs.reduce((acc, config) => {
      acc[config.key] = config.initialValue || "";
      return acc;
    }, {} as Record<string, string>);
  }, []);
  
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  
  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setFilters(initialFilters);
  }, [initialFilters]);
  
  const hasActiveFilters = useMemo(() => {
    if (searchTerm.trim()) return true;
    return Object.entries(filters).some(([key, value]) => {
      const initial = initialFilters[key] || "";
      return value !== initial;
    });
  }, [searchTerm, filters, initialFilters]);
  
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    
    if (searchTerm.trim()) {
      params.append(searchParamName, searchTerm.trim());
    }
    
    filterConfigs.forEach(config => {
      const value = filters[config.key];
      if (value) {
        params.append(config.paramName || config.key, value);
      }
    });
    
    const queryString = params.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }, [endpoint, searchTerm, filters, filterConfigs, searchParamName]);
  
  const { data, isLoading, isError, error, refetch } = useQuery<T[]>({
    queryKey: [queryKey, searchTerm, ...Object.values(filters)],
    queryFn: async () => {
      const url = buildUrl();
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    },
    enabled,
    refetchOnWindowFocus,
  });
  
  return {
    data: data || [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  };
}

export function useLocalFilter<T>(
  data: T[],
  filterFn: (item: T, searchTerm: string, filters: Record<string, string>) => boolean,
  filterConfigs: FilterConfig[] = []
) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const initialFilters = useMemo(() => {
    return filterConfigs.reduce((acc, config) => {
      acc[config.key] = config.initialValue || "";
      return acc;
    }, {} as Record<string, string>);
  }, []);
  
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  
  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setFilters(initialFilters);
  }, [initialFilters]);
  
  const filteredData = useMemo(() => {
    if (!searchTerm.trim() && Object.values(filters).every(v => !v)) {
      return data;
    }
    return data.filter(item => filterFn(item, searchTerm.toLowerCase(), filters));
  }, [data, searchTerm, filters, filterFn]);
  
  const hasActiveFilters = useMemo(() => {
    if (searchTerm.trim()) return true;
    return Object.entries(filters).some(([key, value]) => {
      const initial = initialFilters[key] || "";
      return value !== initial;
    });
  }, [searchTerm, filters, initialFilters]);
  
  return {
    filteredData,
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    resultCount: filteredData.length,
  };
}
