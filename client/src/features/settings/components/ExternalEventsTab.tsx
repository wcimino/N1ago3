import { useState } from "react";
import { Webhook } from "lucide-react";
import { LoadingState, EmptyState } from "../../../shared/components";
import {
  InstructionsPanel,
  SourceForm,
  SourceListItem,
  EditSourceModal,
  useExternalEventSources,
  type ExternalEventSource,
} from "./external-events";

export function ExternalEventsTab() {
  const [editingSource, setEditingSource] = useState<ExternalEventSource | null>(null);

  const {
    sources,
    isLoading,
    addMutation,
    updateMutation,
    toggleMutation,
    regenerateKeyMutation,
    deleteMutation,
    addError,
    updateError,
    clearAddError,
    clearUpdateError,
    getDisplayApiKey,
    hasNewKey,
    getNewKey,
    needsRotation,
    getDaysSinceRotation,
  } = useExternalEventSources();

  const handleAdd = (data: { name: string; source: string; channel_type: string }) => {
    addMutation.mutate(data);
  };

  const handleEdit = (source: ExternalEventSource) => {
    clearUpdateError();
    setEditingSource(source);
  };

  const handleEditSubmit = (data: { id: number; name: string; channel_type: string }) => {
    updateMutation.mutate(data, {
      onSuccess: () => setEditingSource(null),
    });
  };

  const handleCloseEditModal = () => {
    clearUpdateError();
    setEditingSource(null);
  };

  return (
    <div className="space-y-6">
      <InstructionsPanel />

      <SourceForm 
        onSubmit={handleAdd} 
        isPending={addMutation.isPending}
        externalError={addError}
        onClearError={clearAddError}
      />

      <div>
        <h3 className="text-md font-semibold text-gray-900 mb-3">Sistemas Cadastrados</h3>

        {isLoading ? (
          <LoadingState />
        ) : sources.length === 0 ? (
          <EmptyState
            icon={<Webhook className="w-12 h-12" />}
            title="Nenhum sistema cadastrado"
            description="Adicione um sistema externo para começar a receber eventos"
          />
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <SourceListItem
                key={source.id}
                source={source}
                displayApiKey={getDisplayApiKey(source)}
                hasNewKey={hasNewKey(source.id)}
                newKey={getNewKey(source.id)}
                needsRotation={needsRotation(source)}
                daysSinceRotation={getDaysSinceRotation(source)}
                onEdit={() => handleEdit(source)}
                onToggle={() => toggleMutation.mutate({ id: source.id, is_active: !source.is_active })}
                onRegenerate={() => regenerateKeyMutation.mutate(source.id)}
                onDelete={() => deleteMutation.mutate(source.id)}
                isTogglePending={toggleMutation.isPending}
                isRegeneratePending={regenerateKeyMutation.isPending}
                isDeletePending={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <EditSourceModal
        source={editingSource}
        onClose={handleCloseEditModal}
        onSubmit={handleEditSubmit}
        isPending={updateMutation.isPending}
        externalError={updateError}
        onClearError={clearUpdateError}
      />
    </div>
  );
}
