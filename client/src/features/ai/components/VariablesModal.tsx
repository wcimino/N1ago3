import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Modal } from "../../../shared/components/ui";
import { VARIABLE_CATEGORIES } from "../constants/promptVariables";

interface VariablesModalProps {
  onClose: () => void;
}

export function VariablesModal({ onClose }: VariablesModalProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(VARIABLE_CATEGORIES.map((c) => c.id))
  );

  const copyVariable = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedVariable(name);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <Modal
      onClose={onClose}
      title="Variáveis Disponíveis"
      maxWidth="lg"
    >
      <div className="space-y-2">
        <p className="text-sm text-gray-500 mb-4">
          Clique em uma variável para copiá-la. Você pode usar essas variáveis nas orientações para o agente.
        </p>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {VARIABLE_CATEGORIES.map((category) => (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{category.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                </div>
                <div className="ml-3 shrink-0 flex items-center gap-2">
                  <span className="text-xs text-gray-400">{category.variables.length} variáveis</span>
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              {expandedCategories.has(category.id) && (
                <div className="divide-y">
                  {category.variables.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => copyVariable(v.name)}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium text-blue-600">{v.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{v.description}</div>
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
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
