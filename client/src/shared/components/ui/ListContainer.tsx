import type { ReactNode } from "react";
import { LoadingState } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";

export interface PaginationConfig {
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

interface ListContainerProps<T> {
  items: T[] | undefined;
  isLoading: boolean;
  loadingMessage?: string;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pagination?: PaginationConfig;
  renderList: (items: T[]) => ReactNode;
  className?: string;
}

export function ListContainer<T>({
  items,
  isLoading,
  loadingMessage,
  emptyIcon,
  emptyTitle = "Nenhum item encontrado",
  emptyDescription,
  emptyAction,
  pagination,
  renderList,
  className = "",
}: ListContainerProps<T>) {
  if (isLoading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={className}>
      {renderList(items)}
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          showingFrom={pagination.showingFrom}
          showingTo={pagination.showingTo}
          total={pagination.total}
          onPreviousPage={pagination.onPreviousPage}
          onNextPage={pagination.onNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          hasNextPage={pagination.hasNextPage}
          itemLabel={pagination.itemLabel}
        />
      )}
    </div>
  );
}

interface CardListContainerProps<T> {
  items: T[] | undefined;
  isLoading: boolean;
  loadingMessage?: string;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pagination?: PaginationConfig;
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string | number;
  onItemClick?: (item: T) => void;
  title?: string;
  titleIcon?: ReactNode;
  className?: string;
}

export function CardListContainer<T>({
  items,
  isLoading,
  loadingMessage,
  emptyIcon,
  emptyTitle = "Nenhum item encontrado",
  emptyDescription,
  emptyAction,
  pagination,
  renderItem,
  keyExtractor,
  onItemClick,
  title,
  titleIcon,
  className = "",
}: CardListContainerProps<T>) {
  const content = (
    <ListContainer
      items={items}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      emptyIcon={emptyIcon}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
      pagination={pagination}
      renderList={(data) => (
        <div className="divide-y divide-gray-200">
          {data.map((item) => (
            <div
              key={keyExtractor(item)}
              className={`p-4 hover:bg-gray-50 ${onItemClick ? "cursor-pointer" : ""}`}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    />
  );

  if (title) {
    return (
      <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          {titleIcon}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {content}
      </div>
    );
  }

  return content;
}
