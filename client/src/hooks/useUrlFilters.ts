import { useCallback, useMemo } from "react";
import { useLocation } from "wouter";

interface UseUrlFiltersOptions {
  basePath: string;
}

interface UseUrlFiltersResult<T extends Record<string, string | null>> {
  filters: T;
  setFilter: (key: keyof T, value: string | null) => void;
  clearFilter: (key: keyof T) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
}

export function useUrlFilters<T extends Record<string, string | null>>({ basePath }: UseUrlFiltersOptions): UseUrlFiltersResult<T> {
  const [, navigate] = useLocation();
  
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  const filters = useMemo(() => {
    const result: Record<string, string | null> = {};
    urlParams.forEach((value, key) => {
      result[key] = value;
    });
    return result as T;
  }, [urlParams]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== null && v !== "");
  }, [filters]);

  const setFilter = useCallback((key: keyof T, value: string | null) => {
    const newParams = new URLSearchParams(window.location.search);
    if (value === null || value === "") {
      newParams.delete(key as string);
    } else {
      newParams.set(key as string, value);
    }
    const queryString = newParams.toString();
    navigate(queryString ? `${basePath}?${queryString}` : basePath);
  }, [basePath, navigate]);

  const clearFilter = useCallback((key: keyof T) => {
    setFilter(key, null);
  }, [setFilter]);

  const clearAllFilters = useCallback(() => {
    navigate(basePath);
  }, [basePath, navigate]);

  return {
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}
