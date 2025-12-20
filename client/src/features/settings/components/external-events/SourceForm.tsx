import { useState, useEffect } from "react";
import { Plus, Webhook, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../../../../shared/components";

interface SourceFormProps {
  onSubmit: (data: { name: string; source: string; channel_type: string }) => void;
  isPending: boolean;
  externalError?: string | null;
  onClearError?: () => void;
}

export function SourceForm({ onSubmit, isPending, externalError, onClearError }: SourceFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [channelType, setChannelType] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (externalError) {
      setLocalError(externalError);
    }
  }, [externalError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    onClearError?.();

    if (!name.trim()) {
      setLocalError("Nome é obrigatório");
      return;
    }

    if (!source.trim()) {
      setLocalError("Source é obrigatório");
      return;
    }

    if (!channelType.trim()) {
      setLocalError("Channel type é obrigatório");
      return;
    }

    onSubmit({ name: name.trim(), source: source.trim(), channel_type: channelType.trim() });
  };

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
      >
        <span className="text-md font-semibold text-gray-900 flex items-center gap-2">
          <Webhook className="w-5 h-5" />
          + Sistema Externo
        </span>
        {showForm ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {showForm && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Sistema de Pedidos"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex: orders_system"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificador único
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type *</label>
                <input
                  type="text"
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                  placeholder="Ex: whatsapp"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tipo de canal (ex: whatsapp, email, chat)
                </p>
              </div>
            </div>

            {localError && <p className="text-sm text-red-600">{localError}</p>}

            <Button
              type="submit"
              disabled={isPending}
              isLoading={isPending}
              leftIcon={!isPending ? <Plus className="w-4 h-4" /> : undefined}
            >
              Adicionar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
