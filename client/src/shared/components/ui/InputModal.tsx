import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { BaseModal } from "./BaseModal";

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  initialValue?: string;
}

export function InputModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  initialValue = "",
}: InputModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue("");
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button onClick={handleConfirm} disabled={!value.trim()}>
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </BaseModal>
  );
}
