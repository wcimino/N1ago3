import { Filter, X, Search } from "lucide-react";

const EMOTION_OPTIONS = [
  { value: "1", label: "😊 Positivo" },
  { value: "2", label: "🙂 Bom" },
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
    <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2 overflow-x-auto">
      <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="relative flex-shrink-0">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={clientFilter}
          onChange={(e) => onClientChange(e.target.value)}
          placeholder="Buscar..."
          className="text-xs border border-gray-300 rounded px-2 pl-7 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
        />
      </div>
      <select
        value={productStandardFilter}
        onChange={(e) => onProductStandardChange(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[140px] truncate"
      >
        <option value="">Produtos</option>
        {productStandards.map((productStandard) => (
          <option key={productStandard} value={productStandard}>
            {productStandard}
          </option>
        ))}
      </select>
      <select
        value={intentFilter}
        onChange={(e) => onIntentChange(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 max-w-[120px] truncate"
      >
        <option value="">Intenções</option>
        {intents.map((intent) => (
          <option key={intent} value={intent}>
            {intent}
          </option>
        ))}
      </select>
      <select
        value={emotionLevelFilter}
        onChange={(e) => onEmotionLevelChange(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 max-w-[110px]"
      >
        <option value="">Emoção</option>
        {EMOTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button
          onClick={onClear}
          className="inline-flex items-center text-xs text-gray-500 hover:text-red-600 p-1 flex-shrink-0"
          title="Limpar filtros"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
