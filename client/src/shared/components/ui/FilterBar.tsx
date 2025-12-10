import { Filter, X, Search } from "lucide-react";
import React from "react";

interface FilterOption {
  value: string;
  label: string;
}

interface SelectFilter {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  placeholderMobile?: string;
  options: FilterOption[] | string[];
  disabled?: boolean;
}

interface SearchFilter {
  type: "search";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type FilterItem = SelectFilter | SearchFilter;

interface FilterBarProps {
  filters: FilterItem[];
  onClear?: () => void;
  showIcon?: boolean;
}

function normalizeOptions(options: FilterOption[] | string[]): FilterOption[] {
  return options.map(opt => 
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
}

export function FilterBar({ filters, onClear, showIcon = true }: FilterBarProps) {
  const hasActiveFilters = filters.some(f => f.value !== "");

  return (
    <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
      {showIcon && <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      {filters.map((filter, index) => {
        if (filter.type === "search") {
          return (
            <div key={index} className="relative flex-shrink-0 min-w-0">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                placeholder={filter.placeholder || "Buscar..."}
                className="text-xs border border-gray-300 rounded px-2 pl-7 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-20 sm:w-28"
              />
            </div>
          );
        }

        const options = normalizeOptions(filter.options);
        return (
          <select
            key={index}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            disabled={filter.disabled}
            className="text-xs border border-gray-300 rounded px-1.5 sm:px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 max-w-[80px] sm:max-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-no-repeat bg-right pr-5"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundPosition: "right 4px center",
            }}
          >
            <option value="">
              {filter.placeholderMobile || filter.placeholder}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      })}
      {onClear && hasActiveFilters && (
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
