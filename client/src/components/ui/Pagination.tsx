import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  showingFrom: number;
  showingTo: number;
  total: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  itemLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  showingFrom,
  showingTo,
  total,
  onPreviousPage,
  onNextPage,
  hasPreviousPage,
  hasNextPage,
  itemLabel = "itens",
}: PaginationProps) {
  return (
    <div className="px-4 py-3 border-t flex items-center justify-between">
      <p className="text-sm text-gray-500">
        Mostrando {showingFrom} - {showingTo} de {total} {itemLabel}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="inline-flex items-center gap-1 px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
