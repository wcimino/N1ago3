import { ReactNode } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { FilterBar } from "../ui/FilterBar";

interface SearchFilter {
  type: "search";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface SelectFilter {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

export type FilterConfig = SearchFilter | SelectFilter;

export interface StatsConfig {
  total: number;
  active: number;
  inactive: number;
  labels?: {
    total?: string;
    active?: string;
    inactive?: string;
  };
}

interface CrudPageLayoutProps {
  filters: FilterConfig[];
  stats?: StatsConfig;
  onClearFilters?: () => void;
  showForm: boolean;
  formTitle: string;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  isEditing: boolean;
  addButtonLabel: string;
  children: ReactNode;
  formContent: ReactNode;
  emptyState?: ReactNode;
  isEmpty?: boolean;
}

export function CrudPageLayout({
  filters,
  stats,
  onClearFilters,
  showForm,
  formTitle,
  onOpenForm,
  onCloseForm,
  onSubmit,
  isSaving,
  isEditing,
  addButtonLabel,
  children,
  formContent,
  emptyState,
  isEmpty,
}: CrudPageLayoutProps) {
  const defaultLabels = {
    total: "Total",
    active: "Ativos",
    inactive: "Inativos",
  };
  const labels = { ...defaultLabels, ...stats?.labels };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FilterBar filters={filters} onClear={onClearFilters} />
        </div>
        <button
          onClick={onOpenForm}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {addButtonLabel}
        </button>
      </div>

      {stats && (
        <div className="text-sm text-gray-500 flex gap-4">
          <span>{stats.total} {labels.total}</span>
          <span className="text-green-600">{stats.active} {labels.active}</span>
          <span className="text-gray-400">{stats.inactive} {labels.inactive}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{formTitle}</h3>
            <button onClick={onCloseForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {formContent}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCloseForm}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {isEditing ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {isEmpty && emptyState ? emptyState : children}
      </div>
    </div>
  );
}
