import { ReactNode } from "react";
import { BaseModal } from "./BaseModal";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
  isLoading?: boolean;
  loadingContent?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "4xl",
  isLoading = false,
  loadingContent,
  icon,
  footer,
}: ModalProps) {
  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      icon={icon}
      footer={footer}
    >
      {isLoading && loadingContent ? loadingContent : children}
    </BaseModal>
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
