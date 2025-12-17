import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { BaseModal } from "./BaseModal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  variant = "danger",
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const icon = (
    <div className={`p-2 rounded-full ${variant === "danger" ? "bg-red-100" : "bg-amber-100"}`}>
      <AlertTriangle className={`w-5 h-5 ${variant === "danger" ? "text-red-600" : "text-amber-600"}`} />
    </div>
  );

  const footer = (
    <>
      <Button onClick={onClose} variant="secondary">
        {cancelLabel}
      </Button>
      <Button onClick={handleConfirm} variant="danger">
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      footer={footer}
    >
      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
        {message}
      </p>
    </BaseModal>
  );
}
