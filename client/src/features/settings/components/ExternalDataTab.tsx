import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, Loader2 } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { useDateFormatters } from "../../../shared/hooks";
import {
  SyncStatus,
  AddNewSyncStatus,
  SyncType,
  SyncStatusCards,
  SyncProgressSection,
  SyncControls,
  AddNewSection,
} from "./externalData";

export function ExternalDataTab() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { formatShortDateTime } = useDateFormatters();
  const [maxUsers, setMaxUsers] = useState<string>("1000");
  const [syncType, setSyncType] = useState<SyncType>("full");

  const { data: syncStatus, isLoading, refetch } = useQuery<SyncStatus>({
    queryKey: ["zendesk-users-sync-status"],
    queryFn: () => fetchApi<SyncStatus>("/api/external-data/zendesk-users/sync-status"),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isSyncing ? 2000 : false;
    },
  });

  const { data: addNewStatus, refetch: refetchAddNew } = useQuery<AddNewSyncStatus>({
    queryKey: ["zendesk-users-add-new-status"],
    queryFn: () => fetchApi<AddNewSyncStatus>("/api/external-data/zendesk-users/sync-new-status"),
  });

  const syncNewMutation = useMutation({
    mutationFn: async (params: { maxUsers?: number }) => {
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/sync-new", params.maxUsers ? { maxUsers: params.maxUsers } : {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-add-new-status"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params: { syncType: SyncType; maxUsers?: number }) => {
      const body: { syncType: SyncType; maxUsers?: number } = { syncType: params.syncType };
      if (params.maxUsers) {
        body.maxUsers = params.maxUsers;
      }
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/sync", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/external-data/zendesk-users/cancel-sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-users-sync-status"] });
    },
  });

  const handleSync = () => {
    const limit = maxUsers ? parseInt(maxUsers, 10) : undefined;
    syncMutation.mutate({ syncType, maxUsers: limit });
    setTimeout(() => refetch(), 500);
  };

  const handleSyncNew = () => {
    const limit = maxUsers ? parseInt(maxUsers, 10) : undefined;
    syncNewMutation.mutate({ maxUsers: limit });
    setTimeout(() => {
      refetch();
      refetchAddNew();
    }, 500);
  };

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const handleNavigate = () => {
    navigate("/settings/external-data/zendesk-users");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!syncStatus) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Usuários Zendesk</h3>
              <p className="text-sm text-gray-600">
                Sincronize usuários do Zendesk Support para acesso local
              </p>
            </div>
          </div>

          <SyncStatusCards 
            syncStatus={syncStatus} 
            formatShortDateTime={formatShortDateTime} 
          />

          {syncStatus.isSyncing && syncStatus.progress && (
            <SyncProgressSection 
              progress={syncStatus.progress}
              cancelRequested={syncStatus.cancelRequested}
            />
          )}

          {syncStatus.lastSync && !syncStatus.isSyncing && (syncStatus.lastSync.status === "completed" || syncStatus.lastSync.status === "cancelled") && (
            <div className="text-xs text-gray-500">
              {syncStatus.lastSync.recordsProcessed.toLocaleString("pt-BR")} processados, {" "}
              {syncStatus.lastSync.recordsCreated.toLocaleString("pt-BR")} novos, {" "}
              {syncStatus.lastSync.recordsUpdated.toLocaleString("pt-BR")} atualizados
              {syncStatus.lastSync.recordsFailed > 0 && (
                <span className="text-red-500">
                  , {syncStatus.lastSync.recordsFailed.toLocaleString("pt-BR")} com erro
                </span>
              )}
            </div>
          )}

          <AddNewSection
            addNewStatus={addNewStatus}
            onSyncNew={handleSyncNew}
            isSyncing={syncStatus.isSyncing}
            isPending={syncNewMutation.isPending}
          />

          <SyncControls
            syncStatus={syncStatus}
            syncType={syncType}
            maxUsers={maxUsers}
            onSyncTypeChange={setSyncType}
            onMaxUsersChange={setMaxUsers}
            onSync={handleSync}
            onCancel={handleCancel}
            onNavigate={handleNavigate}
            isSyncPending={syncMutation.isPending}
            isCancelPending={cancelMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
