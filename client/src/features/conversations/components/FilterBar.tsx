import { Filter, X } from "lucide-react";

interface FilterBarProps {
  productStandards: string[];
  intents: string[];
  productStandardFilter: string;
  intentFilter: string;
  onProductStandardChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onClear: () => void;
}

export function FilterBar({
  productStandards,
  intents,
  productStandardFilter,
  intentFilter,
  onProductStandardChange,
  onIntentChange,
  onClear,
}: FilterBarProps) {
  const hasFilters = productStandardFilter || intentFilter;

  return (
    <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
      <Filter className="w-4 h-4 text-gray-500" />
      <div className="flex flex-wrap items-center gap-2">
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
