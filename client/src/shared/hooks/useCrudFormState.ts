import { useState, useCallback } from "react";

export interface CrudFormStateConfig<T> {
  emptyForm: T;
  onReset?: () => void;
}

export interface CrudFormStateReturn<T> {
  showForm: boolean;
  editingId: number | null;
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  openCreateForm: () => void;
  openEditForm: (id: number, data: T) => void;
  resetForm: () => void;
  isEditing: boolean;
}

export function useCrudFormState<T>(config: CrudFormStateConfig<T>): CrudFormStateReturn<T> {
  const { emptyForm, onReset } = config;
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<T>(emptyForm);

  const openCreateForm = useCallback(() => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }, [emptyForm]);

  const openEditForm = useCallback((id: number, data: T) => {
    setFormData(data);
    setEditingId(id);
    setShowForm(true);
  }, []);

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    onReset?.();
  }, [emptyForm, onReset]);

  return {
    showForm,
    editingId,
    formData,
    setFormData,
    openCreateForm,
    openEditForm,
    resetForm,
    isEditing: editingId !== null,
  };
}
