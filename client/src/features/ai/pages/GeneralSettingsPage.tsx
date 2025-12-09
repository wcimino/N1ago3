import { useGeneralSettings } from "../../../shared/hooks/useGeneralSettings";
import { LoadingState } from "../../../shared/components/ui";

const SETTINGS_ORDER = [
  "communication_style",
  "behavior_guidelines",
  "guardrails",
  "escalation_policy",
];

export function GeneralSettingsPage() {
  const { settings, isLoading, hasChanges, isSaving, updateSetting, save } = useGeneralSettings();

  if (isLoading) {
    return <LoadingState message="Carregando configurações..." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Configurações Gerais de IA</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure diretrizes globais que serão aplicadas a todos os agentes
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {SETTINGS_ORDER.map((configType) => {
            const setting = settings[configType];
            if (!setting) return null;

            return (
              <div key={configType} className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{setting.title}</h3>
                  <p className="text-sm text-gray-500">{setting.description}</p>
                </div>

                <textarea
                  value={setting.content}
                  onChange={(e) => updateSetting(configType, "content", e.target.value)}
                  rows={4}
                  placeholder={setting.placeholder}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-white"
                />
              </div>
            );
          })}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {hasChanges && (
              <span className="text-sm text-yellow-600 self-center">
                Você tem alterações não salvas
              </span>
            )}
            <button
              onClick={save}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
