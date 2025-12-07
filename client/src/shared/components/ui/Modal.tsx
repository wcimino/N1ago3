import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
  isLoading?: boolean;
  loadingContent?: ReactNode;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
};

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "4xl",
  isLoading = false,
  loadingContent,
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-t-xl sm:rounded-lg shadow-xl ${maxWidthClasses[maxWidth]} w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-base sm:text-lg font-semibold truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="p-3 sm:p-4 overflow-auto max-h-[calc(95vh-52px)] sm:max-h-[calc(90vh-60px)]">
          {isLoading && loadingContent ? loadingContent : children}
        </div>
      </div>
    </div>
  );
}

interface ModalFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function ModalField({ label, children, className = "" }: ModalFieldProps) {
  return (
    <div className={className}>
      <label className="text-sm font-medium text-gray-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

interface ModalGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function ModalGrid({ children, cols = 2, className = "" }: ModalGridProps) {
  const colsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };
  
  return (
    <div className={`grid ${colsClass[cols]} gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
}

interface ModalCodeBlockProps {
  label: string;
  data: any;
  maxHeight?: string;
}

export function ModalCodeBlock({ label, data, maxHeight = "max-h-40" }: ModalCodeBlockProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-500">{label}</label>
      <pre className={`mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto ${maxHeight}`}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
