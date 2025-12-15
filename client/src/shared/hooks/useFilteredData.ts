import { useState, useMemo, useCallback } from "react";

export interface FilterState {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export interface FilterDefinition {
  key: string;
  initialValue?: string;
}

export interface UseFilteredDataConfig {
  initialSearchTerm?: string;
  selectFilters?: FilterDefinition[];
}

export function useFilteredData(
  config: UseFilteredDataConfig = {}
): FilterState {
  const { initialSearchTerm = "", selectFilters = [] } = config;
  
  const initialFilters = useMemo(() => {
    return selectFilters.reduce((acc, filter) => {
      acc[filter.key] = filter.initialValue || "";
      return acc;
    }, {} as Record<string, string>);
  }, [selectFilters]);
  
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  
  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setSearchTerm(initialSearchTerm);
    setFilters(initialFilters);
  }, [initialSearchTerm, initialFilters]);
  
  const hasActiveFilters = useMemo(() => {
    if (searchTerm !== initialSearchTerm) return true;
    return Object.entries(filters).some(([key, value]) => {
      const initial = initialFilters[key] || "";
      return value !== initial;
    });
  }, [searchTerm, initialSearchTerm, filters, initialFilters]);
  
  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  };
}

export function useSimpleFilter<T>(
  data: T[],
  searchFn: (item: T, term: string) => boolean
): {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filteredData: T[];
  resultCount: number;
  hasActiveFilter: boolean;
} {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => searchFn(item, term));
  }, [data, searchTerm, searchFn]);
  
  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    resultCount: filteredData.length,
    hasActiveFilter: searchTerm.trim().length > 0,
  };
}
