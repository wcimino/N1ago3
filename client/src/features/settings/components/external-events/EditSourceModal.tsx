import { useState, useEffect } from "react";
import { Button } from "../../../../shared/components";
import type { ExternalEventSource } from "./types";

interface EditSourceModalProps {
  source: ExternalEventSource | null;
  onClose: () => void;
  onSubmit: (data: { id: number; name: string; channel_type: string }) => void;
  isPending: boolean;
  externalError?: string | null;
  onClearError?: () => void;
}

export function EditSourceModal({ source, onClose, onSubmit, isPending, externalError, onClearError }: EditSourceModalProps) {
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (source) {
      setName(source.name);
      setChannelType(source.channel_type);
      setLocalError("");
    }
  }, [source]);

  useEffect(() => {
    if (externalError) {
      setLocalError(externalError);
    }
  }, [externalError]);

  if (!source) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    onClearError?.();

    if (!name.trim()) {
      setLocalError("Nome é obrigatório");
      return;
    }

    if (!channelType.trim()) {
      setLocalError("Channel type é obrigatório");
      return;
    }

    onSubmit({ id: source.id, name: name.trim(), channel_type: channelType.trim() });
  };

  const handleClose = () => {
    setLocalError("");
    onClearError?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Editar Sistema Externo</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input
              type="text"
              value={source.source}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">O source não pode ser alterado</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type *</label>
            <input
              type="text"
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          {localError && <p className="text-sm text-red-600">{localError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              isLoading={isPending}
            >
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
