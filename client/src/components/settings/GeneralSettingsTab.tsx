import { Globe, Check } from "lucide-react";
import { useTimezone, TIMEZONE_OPTIONS, type TimezoneValue } from "../../contexts/TimezoneContext";

export function GeneralSettingsTab() {
  const { timezone, setTimezone } = useTimezone();

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Fuso Horário
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Selecione o fuso horário para exibição de datas e horários em toda a aplicação.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIMEZONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimezone(option.value as TimezoneValue)}
              className={`
                flex items-center justify-between px-4 py-3 rounded-lg border-2 text-left transition-all
                ${timezone === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <span className="font-medium">{option.label}</span>
              {timezone === option.value && (
                <Check className="w-5 h-5 text-blue-600" />
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Configuração salva automaticamente. Os horários em toda a aplicação serão ajustados.
        </p>
      </div>
    </div>
  );
}
