import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../lib/queryClient";
import type { EventTypeMappingsResponse } from "../../types";

export interface OpenaiApiConfigResponse {
  id?: number;
  config_type: string;
  enabled: boolean;
  trigger_event_types: string[];
  trigger_author_types: string[];
  prompt_template: string;
  model_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface OpenaiApiConfigState {
  enabled: boolean;
  triggerEventTypes: string[];
  triggerAuthorTypes: string[];
  promptTemplate: string;
  modelName: string;
  hasChanges: boolean;
}

export interface OpenaiApiConfigActions {
  setEnabled: (enabled: boolean) => void;
  setPromptTemplate: (template: string) => void;
  setModelName: (model: string) => void;
  toggleEventType: (eventKey: string) => void;
  toggleAuthorType: (authorType: string) => void;
  save: () => void;
}

export interface UseOpenaiApiConfigReturn {
  state: OpenaiApiConfigState;
  actions: OpenaiApiConfigActions;
  eventTypes: EventTypeMappingsResponse | undefined;
  isLoading: boolean;
  isSaving: boolean;
}

export function useOpenaiApiConfig(configType: string): UseOpenaiApiConfigReturn {
  const queryClient = useQueryClient();
  
  const [enabled, setEnabledState] = useState(false);
  const [triggerEventTypes, setTriggerEventTypes] = useState<string[]>([]);
  const [triggerAuthorTypes, setTriggerAuthorTypes] = useState<string[]>([]);
  const [promptTemplate, setPromptTemplateState] = useState("");
  const [modelName, setModelNameState] = useState("gpt-4o-mini");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading: isLoadingConfig } = useQuery<OpenaiApiConfigResponse>({
    queryKey: ["openai-api-config", configType],
    queryFn: () => fetchApi<OpenaiApiConfigResponse>(`/api/openai-config/${configType}`),
  });

  const { data: eventTypes, isLoading: isLoadingEventTypes } = useQuery<EventTypeMappingsResponse>({
    queryKey: ["event-type-mappings"],
    queryFn: () => fetchApi<EventTypeMappingsResponse>("/api/event-type-mappings"),
  });

  useEffect(() => {
    if (config) {
      setEnabledState(config.enabled);
      setTriggerEventTypes(config.trigger_event_types || []);
      setTriggerAuthorTypes(config.trigger_author_types || []);
      setPromptTemplateState(config.prompt_template);
      setModelNameState(config.model_name);
      setHasChanges(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/openai-config/${configType}`, {
        enabled,
        trigger_event_types: triggerEventTypes,
        trigger_author_types: triggerAuthorTypes,
        prompt_template: promptTemplate,
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

  const setPromptTemplate = useCallback((value: string) => {
    setPromptTemplateState(value);
    markChanged();
  }, [markChanged]);

  const setModelName = useCallback((value: string) => {
    setModelNameState(value);
    markChanged();
  }, [markChanged]);

  const toggleEventType = useCallback((eventKey: string) => {
    setTriggerEventTypes(prev =>
      prev.includes(eventKey)
        ? prev.filter(e => e !== eventKey)
        : [...prev, eventKey]
    );
    markChanged();
  }, [markChanged]);

  const toggleAuthorType = useCallback((authorType: string) => {
    setTriggerAuthorTypes(prev =>
      prev.includes(authorType)
        ? prev.filter(a => a !== authorType)
        : [...prev, authorType]
    );
    markChanged();
  }, [markChanged]);

  const save = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  return {
    state: {
      enabled,
      triggerEventTypes,
      triggerAuthorTypes,
      promptTemplate,
      modelName,
      hasChanges,
    },
    actions: {
      setEnabled,
      setPromptTemplate,
      setModelName,
      toggleEventType,
      toggleAuthorType,
      save,
    },
    eventTypes,
    isLoading: isLoadingConfig || isLoadingEventTypes,
    isSaving: saveMutation.isPending,
  };
}
