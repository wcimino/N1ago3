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
  prompt_system: string | null;
  prompt_template: string;
  response_format: string | null;
  model_name: string;
  use_knowledge_base_tool: boolean;
  use_product_catalog_tool: boolean;
  use_zendesk_knowledge_base_tool: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OpenaiApiConfigState {
  enabled: boolean;
  triggerEventTypes: string[];
  triggerAuthorTypes: string[];
  promptSystem: string;
  promptTemplate: string;
  responseFormat: string;
  modelName: string;
  useKnowledgeBaseTool: boolean;
  useProductCatalogTool: boolean;
  useZendeskKnowledgeBaseTool: boolean;
  hasChanges: boolean;
}

export interface OpenaiApiConfigActions {
  setEnabled: (enabled: boolean) => void;
  setPromptSystem: (template: string) => void;
  setPromptTemplate: (template: string) => void;
  setResponseFormat: (format: string) => void;
  setModelName: (model: string) => void;
  toggleEventType: (eventKey: string) => void;
  toggleAuthorType: (authorType: string) => void;
  setUseKnowledgeBaseTool: (value: boolean) => void;
  setUseProductCatalogTool: (value: boolean) => void;
  setUseZendeskKnowledgeBaseTool: (value: boolean) => void;
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
  const [promptSystem, setPromptSystemState] = useState("");
  const [promptTemplate, setPromptTemplateState] = useState("");
  const [responseFormat, setResponseFormatState] = useState("");
  const [modelName, setModelNameState] = useState("gpt-4o-mini");
  const [useKnowledgeBaseTool, setUseKnowledgeBaseToolState] = useState(false);
  const [useProductCatalogTool, setUseProductCatalogToolState] = useState(false);
  const [useZendeskKnowledgeBaseTool, setUseZendeskKnowledgeBaseToolState] = useState(false);
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
      setPromptSystemState(config.prompt_system || "");
      setPromptTemplateState(config.prompt_template);
      setResponseFormatState(config.response_format || "");
      setModelNameState(config.model_name);
      setUseKnowledgeBaseToolState(config.use_knowledge_base_tool ?? false);
      setUseProductCatalogToolState(config.use_product_catalog_tool ?? false);
      setUseZendeskKnowledgeBaseToolState(config.use_zendesk_knowledge_base_tool ?? false);
      setHasChanges(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/openai-config/${configType}`, {
        enabled,
        trigger_event_types: triggerEventTypes,
        trigger_author_types: triggerAuthorTypes,
        prompt_system: promptSystem || null,
        prompt_template: promptTemplate,
        response_format: responseFormat || null,
        model_name: modelName,
        use_knowledge_base_tool: useKnowledgeBaseTool,
        use_product_catalog_tool: useProductCatalogTool,
        use_zendesk_knowledge_base_tool: useZendeskKnowledgeBaseTool,
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

  const setUseKnowledgeBaseTool = useCallback((value: boolean) => {
    setUseKnowledgeBaseToolState(value);
    markChanged();
  }, [markChanged]);

  const setUseProductCatalogTool = useCallback((value: boolean) => {
    setUseProductCatalogToolState(value);
    markChanged();
  }, [markChanged]);

  const setUseZendeskKnowledgeBaseTool = useCallback((value: boolean) => {
    setUseZendeskKnowledgeBaseToolState(value);
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
      promptSystem,
      promptTemplate,
      responseFormat,
      modelName,
      useKnowledgeBaseTool,
      useProductCatalogTool,
      useZendeskKnowledgeBaseTool,
      hasChanges,
    },
    actions: {
      setEnabled,
      setPromptSystem,
      setPromptTemplate,
      setResponseFormat,
      setModelName,
      toggleEventType,
      toggleAuthorType,
      setUseKnowledgeBaseTool,
      setUseProductCatalogTool,
      setUseZendeskKnowledgeBaseTool,
      save,
    },
    eventTypes,
    isLoading: isLoadingConfig || isLoadingEventTypes,
    isSaving: saveMutation.isPending,
  };
}
