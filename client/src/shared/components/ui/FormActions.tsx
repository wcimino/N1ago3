import { Check, X } from "lucide-react";
import { Button } from "./Button";

interface FormActionsProps {
  isLoading?: boolean;
  isEditing?: boolean;
  onCancel: () => void;
  disabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export function FormActions({
  isLoading = false,
  isEditing = false,
  onCancel,
  disabled = false,
  submitLabel,
  cancelLabel = "Cancelar",
  className = "",
}: FormActionsProps) {
  const defaultSubmitLabel = isEditing ? "Salvar" : "Criar";

  return (
    <div className={`flex justify-end gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        leftIcon={<X className="w-4 h-4" />}
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        disabled={disabled || isLoading}
        isLoading={isLoading}
        leftIcon={!isLoading ? <Check className="w-4 h-4" /> : undefined}
      >
        {submitLabel || defaultSubmitLabel}
      </Button>
    </div>
  );
}
