import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export interface SearchToolField {
  name: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  icon?: React.ComponentType<{ className?: string }>;
}

export interface UseSearchToolOptions<T> {
  toolId: string;
  endpoint: string;
  fields: SearchToolField[];
  defaultLimit?: number;
  transformParams?: (values: Record<string, string>) => Record<string, string>;
}

export interface UseSearchToolResult<T> {
  values: Record<string, string>;
  setValue: (field: string, value: string) => void;
  setValues: (values: Record<string, string>) => void;
  isLoading: boolean;
  error: Error | null;
  data: T | undefined;
  search: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  hasSearched: boolean;
}

export function useSearchTool<T>({
  toolId,
  endpoint,
  fields,
  defaultLimit = 10,
  transformParams,
}: UseSearchToolOptions<T>): UseSearchToolResult<T> {
  const initialValues: Record<string, string> = {};
  fields.forEach(field => {
    initialValues[field.name] = "";
  });

  const [values, setValuesState] = useState<Record<string, string>>(initialValues);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const setValue = useCallback((field: string, value: string) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
  }, []);

  const setValues = useCallback((newValues: Record<string, string>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    
    const processedValues = transformParams ? transformParams(values) : values;
    
    Object.entries(processedValues).forEach(([key, value]) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      }
    });
    
    params.set("limit", String(defaultLimit));
    return params;
  }, [values, defaultLimit, transformParams]);

  const { data, isLoading, error } = useQuery<T>({
    queryKey: [toolId, values, searchTrigger],
    queryFn: async () => {
      const params = buildParams();
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha na busca");
      }
      return res.json();
    },
    enabled: searchTrigger > 0,
  });

  const search = useCallback(() => {
    setSearchTrigger(prev => prev + 1);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      search();
    }
  }, [search]);

  return {
    values,
    setValue,
    setValues,
    isLoading,
    error: error as Error | null,
    data,
    search,
    handleKeyPress,
    hasSearched: searchTrigger > 0,
  };
}
