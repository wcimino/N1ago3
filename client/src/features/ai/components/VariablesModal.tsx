import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Modal } from "../../../shared/components/ui";
import { AVAILABLE_VARIABLES } from "../constants/promptVariables";

interface VariablesModalProps {
  onClose: () => void;
}

export function VariablesModal({ onClose }: VariablesModalProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const copyVariable = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedVariable(name);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  return (
    <Modal
      onClose={onClose}
      title="Variáveis Disponíveis"
      maxWidth="md"
    >
      <div className="space-y-1">
        <p className="text-sm text-gray-500 mb-4">
          Clique em uma variável para copiá-la. Você pode usar essas variáveis nas orientações para o agente.
        </p>
        <div className="divide-y border rounded-lg overflow-hidden">
          {AVAILABLE_VARIABLES.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => copyVariable(v.name)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-medium text-blue-600">{v.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{v.description}</div>
              </div>
              <div className="ml-3 shrink-0">
                {copiedVariable === v.name ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-4 w-4" />
                    Copiado!
                  </span>
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
