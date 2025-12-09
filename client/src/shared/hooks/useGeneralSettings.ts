import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GeneralSetting {
  config_type: string;
  enabled: boolean;
  content: string;
  title: string;
  description: string;
  placeholder: string;
  created_at: string | null;
  updated_at: string | null;
}

export type GeneralSettingsMap = Record<string, GeneralSetting>;

async function fetchGeneralSettings(): Promise<GeneralSettingsMap> {
  const response = await fetch("/api/openai-config-general", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch general settings");
  return response.json();
}

async function saveGeneralSettings(settings: GeneralSettingsMap): Promise<GeneralSettingsMap> {
  const payload: Record<string, { enabled: boolean; content: string }> = {};
  for (const [key, value] of Object.entries(settings)) {
    payload[key] = { enabled: value.enabled, content: value.content };
  }
  
  const response = await fetch("/api/openai-config-general", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to save general settings");
  return response.json();
}

export function useGeneralSettings() {
  const queryClient = useQueryClient();
  
  const { data: serverSettings, isLoading, error } = useQuery({
    queryKey: ["general-settings"],
    queryFn: fetchGeneralSettings,
  });
  
  const [localSettings, setLocalSettings] = useState<GeneralSettingsMap>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    if (serverSettings) {
      setLocalSettings(serverSettings);
      setHasChanges(false);
    }
  }, [serverSettings]);
  
  const mutation = useMutation({
    mutationFn: saveGeneralSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["general-settings"], data);
      setLocalSettings(data);
      setHasChanges(false);
    },
  });
  
  const updateSetting = useCallback((configType: string, field: "enabled" | "content", value: boolean | string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [configType]: {
        ...prev[configType],
        [field]: value,
      },
    }));
    setHasChanges(true);
  }, []);
  
  const save = useCallback(() => {
    mutation.mutate(localSettings);
  }, [mutation, localSettings]);
  
  const reset = useCallback(() => {
    if (serverSettings) {
      setLocalSettings(serverSettings);
      setHasChanges(false);
    }
  }, [serverSettings]);
  
  return {
    settings: localSettings,
    isLoading,
    error,
    hasChanges,
    isSaving: mutation.isPending,
    updateSetting,
    save,
    reset,
  };
}
