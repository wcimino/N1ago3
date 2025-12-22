import { Filter, X, Search, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

interface FilterOption {
  value: string;
  label: string;
}

interface SelectFilter {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
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

function FilterSheet({ 
  filters, 
  onClear, 
  onClose 
}: { 
  filters: FilterItem[]; 
  onClear?: () => void; 
  onClose: () => void;
}) {
  const hasActiveFilters = filters.some(f => f.value !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/40" 
        onClick={onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Filtros</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {filters.map((filter, index) => {
            if (filter.type === "search") {
              return (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Buscar
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => filter.onChange(e.target.value)}
                      placeholder={filter.placeholder || "Buscar..."}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 pl-9 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              );
            }

            const options = normalizeOptions(filter.options);
            return (
              <div key={index}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {filter.placeholder}
                </label>
                <div className="relative">
                  <select
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    disabled={filter.disabled}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-8"
                  >
                    <option value="">Todos</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-3">
          {onClear && hasActiveFilters && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Limpar
            </Button>
          )}
          <Button fullWidth onClick={onClose}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}

function DesktopFilterBar({ 
  filters, 
  onClear, 
  showIcon 
}: FilterBarProps) {
  const hasActiveFilters = filters.some(f => f.value !== "");

  return (
    <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2 overflow-x-auto">
      {showIcon && <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      {filters.map((filter, index) => {
        if (filter.type === "search") {
          return (
            <div key={index} className="relative flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                placeholder={filter.placeholder || "Buscar..."}
                className="text-xs border border-gray-300 rounded px-2 pl-7 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
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
            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{filter.placeholder}</option>
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

export function FilterBar({ filters, onClear, showIcon = true }: FilterBarProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const activeCount = filters.filter(f => f.value !== "").length;

  return (
    <>
      <div className="sm:hidden px-3 py-2 border-b bg-gray-50 flex items-center gap-2">
        <button
          onClick={() => setIsSheetOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filtrar</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-600"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="hidden sm:block">
        <DesktopFilterBar 
          filters={filters} 
          onClear={onClear} 
          showIcon={showIcon} 
        />
      </div>

      {isSheetOpen && (
        <FilterSheet 
          filters={filters} 
          onClear={onClear}
          onClose={() => setIsSheetOpen(false)} 
        />
      )}
    </>
  );
}
