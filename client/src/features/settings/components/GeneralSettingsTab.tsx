import { Globe } from "lucide-react";
import { useTimezone, TIMEZONE_OPTIONS, type TimezoneValue } from "../../../contexts/TimezoneContext";

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

        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value as TimezoneValue)}
          className="w-full max-w-md px-4 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all cursor-pointer"
        >
          {TIMEZONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="text-xs text-gray-500 mt-4">
          Configuração salva automaticamente. Os horários em toda a aplicação serão ajustados.
        </p>
      </div>
    </div>
  );
}
