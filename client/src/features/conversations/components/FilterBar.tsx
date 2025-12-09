import { Filter, X, Search } from "lucide-react";

const EMOTION_OPTIONS = [
  { value: "1", label: "😊 Muito positivo" },
  { value: "2", label: "🙂 Positivo" },
  { value: "3", label: "😐 Neutro" },
  { value: "4", label: "😤 Irritado" },
  { value: "5", label: "😠 Muito irritado" },
];

interface FilterBarProps {
  productStandards: string[];
  intents: string[];
  productStandardFilter: string;
  intentFilter: string;
  emotionLevelFilter: string;
  clientFilter: string;
  onProductStandardChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onEmotionLevelChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onClear: () => void;
}

export function FilterBar({
  productStandards,
  intents,
  productStandardFilter,
  intentFilter,
  emotionLevelFilter,
  clientFilter,
  onProductStandardChange,
  onIntentChange,
  onEmotionLevelChange,
  onClientChange,
  onClear,
}: FilterBarProps) {
  const hasFilters = productStandardFilter || intentFilter || emotionLevelFilter || clientFilter;

  return (
    <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
      <Filter className="w-4 h-4 text-gray-500" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => onClientChange(e.target.value)}
            placeholder="Buscar cliente..."
            className="text-sm border border-gray-300 rounded-md pl-8 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <select
          value={productStandardFilter}
          onChange={(e) => onProductStandardChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os produtos</option>
          {productStandards.map((productStandard) => (
            <option key={productStandard} value={productStandard}>
              {productStandard}
            </option>
          ))}
        </select>
        <select
          value={intentFilter}
          onChange={(e) => onIntentChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Todas as intenções</option>
          {intents.map((intent) => (
            <option key={intent} value={intent}>
              {intent}
            </option>
          ))}
        </select>
        <select
          value={emotionLevelFilter}
          onChange={(e) => onEmotionLevelChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todas as emoções</option>
          {EMOTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 px-2 py-1"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
