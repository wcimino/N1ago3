import { Dispatch, SetStateAction } from "react";

export interface CrudFormProps<T> {
  formData: T;
  setFormData: Dispatch<SetStateAction<T>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
  isMutating: boolean;
}

export interface CrudFormState<T> {
  showForm: boolean;
  editingId: number | null;
  formData: T;
  setFormData: Dispatch<SetStateAction<T>>;
  openCreateForm: () => void;
  openEditForm: (id: number, data: T) => void;
  resetForm: () => void;
  isEditing: boolean;
}
