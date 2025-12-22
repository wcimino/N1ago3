import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../lib/queryClient";

export interface OpenaiApiConfigResponse {
  id?: number;
  config_type: string;
  enabled: boolean;
  trigger_event_types: string[];
  trigger_author_types: string[];
  prompt_system: string | null;
  prompt_template: string;
  response_format: string | null;
  model_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface OpenaiApiConfigState {
  enabled: boolean;
  promptSystem: string;
  promptTemplate: string;
  responseFormat: string;
  modelName: string;
  hasChanges: boolean;
}

export interface OpenaiApiConfigActions {
  setEnabled: (enabled: boolean) => void;
  setPromptSystem: (template: string) => void;
  setPromptTemplate: (template: string) => void;
  setResponseFormat: (format: string) => void;
  setModelName: (model: string) => void;
  save: () => void;
}

export interface UseOpenaiApiConfigReturn {
  state: OpenaiApiConfigState;
  actions: OpenaiApiConfigActions;
  isLoading: boolean;
  isSaving: boolean;
}

export function useOpenaiApiConfig(configType: string): UseOpenaiApiConfigReturn {
  const queryClient = useQueryClient();
  
  const [enabled, setEnabledState] = useState(false);
  const [promptSystem, setPromptSystemState] = useState("");
  const [promptTemplate, setPromptTemplateState] = useState("");
  const [responseFormat, setResponseFormatState] = useState("");
  const [modelName, setModelNameState] = useState("gpt-4o-mini");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading: isLoadingConfig } = useQuery<OpenaiApiConfigResponse>({
    queryKey: ["openai-api-config", configType],
    queryFn: () => fetchApi<OpenaiApiConfigResponse>(`/api/openai-config/${configType}`),
  });

  useEffect(() => {
    if (config) {
      setEnabledState(config.enabled);
      setPromptSystemState(config.prompt_system || "");
      setPromptTemplateState(config.prompt_template);
      setResponseFormatState(config.response_format || "");
      setModelNameState(config.model_name);
      setHasChanges(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/openai-config/${configType}`, {
        enabled,
        prompt_system: promptSystem || null,
        prompt_template: promptTemplate,
        response_format: responseFormat || null,
        model_name: modelName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-api-config", configType] });
      setHasChanges(false);
    },
  });

  const markChanged = useCallback(() => setHasChanges(true), []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    markChanged();
  }, [markChanged]);

  const setPromptSystem = useCallback((value: string) => {
    setPromptSystemState(value);
    markChanged();
  }, [markChanged]);

  const setPromptTemplate = useCallback((value: string) => {
    setPromptTemplateState(value);
    markChanged();
  }, [markChanged]);

  const setResponseFormat = useCallback((value: string) => {
    setResponseFormatState(value);
    markChanged();
  }, [markChanged]);

  const setModelName = useCallback((value: string) => {
    setModelNameState(value);
    markChanged();
  }, [markChanged]);

  const save = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  return {
    state: {
      enabled,
      promptSystem,
      promptTemplate,
      responseFormat,
      modelName,
      hasChanges,
    },
    actions: {
      setEnabled,
      setPromptSystem,
      setPromptTemplate,
      setResponseFormat,
      setModelName,
      save,
    },
    isLoading: isLoadingConfig,
    isSaving: saveMutation.isPending,
  };
}
