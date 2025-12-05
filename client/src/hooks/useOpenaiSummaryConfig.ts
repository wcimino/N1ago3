import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../lib/queryClient";
import type { OpenaiSummaryConfigResponse, EventTypeMappingsResponse } from "../types";

export interface OpenaiSummaryConfigState {
  enabled: boolean;
  triggerEventTypes: string[];
  triggerAuthorTypes: string[];
  promptTemplate: string;
  modelName: string;
  hasChanges: boolean;
}

export interface OpenaiSummaryConfigActions {
  setEnabled: (enabled: boolean) => void;
  setPromptTemplate: (template: string) => void;
  setModelName: (model: string) => void;
  toggleEventType: (eventKey: string) => void;
  toggleAuthorType: (authorType: string) => void;
  save: () => void;
}

export interface UseOpenaiSummaryConfigReturn {
  state: OpenaiSummaryConfigState;
  actions: OpenaiSummaryConfigActions;
  eventTypes: EventTypeMappingsResponse | undefined;
  isLoading: boolean;
  isSaving: boolean;
}

export function useOpenaiSummaryConfig(): UseOpenaiSummaryConfigReturn {
  const queryClient = useQueryClient();
  
  const [enabled, setEnabledState] = useState(false);
  const [triggerEventTypes, setTriggerEventTypes] = useState<string[]>([]);
  const [triggerAuthorTypes, setTriggerAuthorTypes] = useState<string[]>([]);
  const [promptTemplate, setPromptTemplateState] = useState("");
  const [modelName, setModelNameState] = useState("gpt-5");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: config, isLoading: isLoadingConfig } = useQuery<OpenaiSummaryConfigResponse>({
    queryKey: ["openai-summary-config"],
    queryFn: () => fetchApi<OpenaiSummaryConfigResponse>("/api/openai-summary-config"),
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
      await apiRequest("PUT", "/api/openai-summary-config", {
        enabled,
        trigger_event_types: triggerEventTypes,
        trigger_author_types: triggerAuthorTypes,
        prompt_template: promptTemplate,
        model_name: modelName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openai-summary-config"] });
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
