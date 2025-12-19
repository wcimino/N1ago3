import { useState, useCallback } from "react";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  onConfirm: () => void;
}

const defaultState: ConfirmationState = {
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
  variant: "danger",
  onConfirm: () => {},
};

export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>(defaultState);

  const confirm = useCallback((options: ConfirmationOptions) => {
    setState({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? "Confirmar",
      cancelLabel: options.cancelLabel ?? "Cancelar",
      variant: options.variant ?? "danger",
      onConfirm: options.onConfirm,
    });
  }, []);

  const close = useCallback(() => {
    setState(defaultState);
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    close();
  }, [state.onConfirm, close]);

  return {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    variant: state.variant,
    confirm,
    close,
    handleConfirm,
  };
}
