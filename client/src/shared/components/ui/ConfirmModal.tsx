import { AlertTriangle, Info } from "lucide-react";
import { Button } from "./Button";
import { BaseModal } from "./BaseModal";

type ConfirmVariant = "danger" | "warning" | "info";

const variantConfig: Record<ConfirmVariant, {
  bgClass: string;
  iconClass: string;
  buttonVariant: "danger" | "primary";
  icon: typeof AlertTriangle | typeof Info;
}> = {
  danger: {
    bgClass: "bg-red-100",
    iconClass: "text-red-600",
    buttonVariant: "danger",
    icon: AlertTriangle,
  },
  warning: {
    bgClass: "bg-amber-100",
    iconClass: "text-amber-600",
    buttonVariant: "danger",
    icon: AlertTriangle,
  },
  info: {
    bgClass: "bg-blue-100",
    iconClass: "text-blue-600",
    buttonVariant: "primary",
    icon: Info,
  },
};

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const icon = (
    <div className={`p-2 rounded-full ${config.bgClass}`}>
      <IconComponent className={`w-5 h-5 ${config.iconClass}`} />
    </div>
  );

  const footer = (
    <>
      <Button onClick={onClose} variant="secondary">
        {cancelLabel}
      </Button>
      <Button onClick={handleConfirm} variant={config.buttonVariant}>
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
