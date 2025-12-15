import { useState } from "react";
import { Route } from "lucide-react";
import { useRoutingRules, NewConversationSection, OngoingConversationSection } from "./rules";
import type { FormType } from "./rules";

export function RoutingRulesContent() {
  const [activeForm, setActiveForm] = useState<FormType>(null);
  
  const {
    newConvRules,
    ongoingConvRules,
    isLoading,
    createRule,
    deactivateRule,
    deleteRule,
  } = useRoutingRules();

  const handleCreate = (data: { ruleType: string; target: string; allocateCount: number; authFilter?: string; matchText?: string }, onSuccess: () => void) => {
    createRule.mutate(data, {
      onSuccess: () => {
        setActiveForm(null);
        onSuccess();
      },
    });
  };

  return (
    <div className="p-4 space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Route className="w-5 h-5 text-purple-600" />
          Regras de Roteamento
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure como as conversas devem ser distribuídas
        </p>
      </div>

      <NewConversationSection
        rules={newConvRules}
        isLoading={isLoading}
        isFormOpen={activeForm === "new_conversation"}
        onToggleForm={() => setActiveForm(activeForm === "new_conversation" ? null : "new_conversation")}
        onCreate={handleCreate}
        onDeactivate={(id) => deactivateRule.mutate(id)}
        onDelete={(id) => deleteRule.mutate(id)}
        isCreating={createRule.isPending}
        isDeactivating={deactivateRule.isPending}
      />

      <OngoingConversationSection
        rules={ongoingConvRules}
        isLoading={isLoading}
        isFormOpen={activeForm === "ongoing_conversation"}
        onToggleForm={() => setActiveForm(activeForm === "ongoing_conversation" ? null : "ongoing_conversation")}
        onCreate={handleCreate}
        onDeactivate={(id) => deactivateRule.mutate(id)}
        onDelete={(id) => deleteRule.mutate(id)}
        isCreating={createRule.isPending}
        isDeactivating={deactivateRule.isPending}
      />
    </div>
  );
}
