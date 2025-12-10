import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";

interface CrudMutationsConfig<TData, TCreateData = TData, TUpdateData = Partial<TData>> {
  baseUrl: string;
  queryKeys: string[];
  onCreateSuccess?: () => void;
  onUpdateSuccess?: () => void;
  onDeleteSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface CrudMutationsReturn<TCreateData, TUpdateData> {
  createMutation: ReturnType<typeof useMutation<Response, Error, TCreateData>>;
  updateMutation: ReturnType<typeof useMutation<Response, Error, { id: number } & TUpdateData>>;
  deleteMutation: ReturnType<typeof useMutation<Response, Error, number>>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isMutating: boolean;
}

export function useCrudMutations<TData, TCreateData = TData, TUpdateData = Partial<TData>>(
  config: CrudMutationsConfig<TData, TCreateData, TUpdateData>
): CrudMutationsReturn<TCreateData, TUpdateData> {
  const queryClient = useQueryClient();
  const { baseUrl, queryKeys, onCreateSuccess, onUpdateSuccess, onDeleteSuccess, onError } = config;

  const invalidateQueries = () => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: TCreateData) => {
      return apiRequest("POST", baseUrl, data);
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
    mutationFn: async ({ id, ...data }: { id: number } & TUpdateData) => {
      return apiRequest("PUT", `${baseUrl}/${id}`, data);
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
      return apiRequest("DELETE", `${baseUrl}/${id}`);
    },
    onSuccess: () => {
      invalidateQueries();
      onDeleteSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
