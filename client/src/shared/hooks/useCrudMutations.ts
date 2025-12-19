import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";

export interface CrudMutationsConfig<TCreateData = unknown, TUpdateData = unknown> {
  baseUrl: string;
  queryKeys: string[];
  transformCreateData?: (data: TCreateData) => unknown;
  transformUpdateData?: (data: TUpdateData) => unknown;
  onCreateSuccess?: () => void;
  onUpdateSuccess?: () => void;
  onDeleteSuccess?: (deletedId: number) => void;
  onError?: (error: Error) => void;
}

export interface CrudMutationsReturn<TCreateData, TUpdateData> {
  createMutation: ReturnType<typeof useMutation<unknown, Error, TCreateData>>;
  updateMutation: ReturnType<typeof useMutation<unknown, Error, { id: number; data: TUpdateData }>>;
  deleteMutation: ReturnType<typeof useMutation<unknown, Error, number>>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isMutating: boolean;
  handleCreate: (data: TCreateData) => void;
  handleUpdate: (id: number, data: TUpdateData) => void;
  handleDelete: (id: number) => void;
}

export function useCrudMutations<TCreateData = unknown, TUpdateData = unknown>(
  config: CrudMutationsConfig<TCreateData, TUpdateData>
): CrudMutationsReturn<TCreateData, TUpdateData> {
  const queryClient = useQueryClient();
  const { 
    baseUrl, 
    queryKeys, 
    transformCreateData,
    transformUpdateData,
    onCreateSuccess, 
    onUpdateSuccess, 
    onDeleteSuccess, 
    onError 
  } = config;

  const invalidateQueries = () => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: TCreateData) => {
      const payload = transformCreateData ? transformCreateData(data) : data;
      const res = await apiRequest("POST", baseUrl, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateQueries();
      onCreateSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TUpdateData }) => {
      const payload = transformUpdateData ? transformUpdateData(data) : data;
      const res = await apiRequest("PUT", `${baseUrl}/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      invalidateQueries();
      onUpdateSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${baseUrl}/${id}`);
      return id;
    },
    onSuccess: (deletedId: number) => {
      invalidateQueries();
      onDeleteSuccess?.(deletedId);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const handleCreate = (data: TCreateData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (id: number, data: TUpdateData) => {
    updateMutation.mutate({ id, data });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
