import { useState, useCallback } from "react";

export interface ModalState<TData = unknown> {
  isOpen: boolean;
  mode: "create" | "edit" | "view" | "delete";
  data: TData | null;
}

export interface UseModalStateResult<TData = unknown> {
  state: ModalState<TData>;
  isOpen: boolean;
  mode: "create" | "edit" | "view" | "delete";
  data: TData | null;
  openCreate: () => void;
  openEdit: (data: TData) => void;
  openView: (data: TData) => void;
  openDelete: (data: TData) => void;
  close: () => void;
  clear: () => void;
  setData: (data: TData | null) => void;
}

export function useModalState<TData = unknown>(): UseModalStateResult<TData> {
  const [state, setState] = useState<ModalState<TData>>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  const openCreate = useCallback(() => {
    setState({
      isOpen: true,
      mode: "create",
      data: null,
    });
  }, []);

  const openEdit = useCallback((data: TData) => {
    setState({
      isOpen: true,
      mode: "edit",
      data,
    });
  }, []);

  const openView = useCallback((data: TData) => {
    setState({
      isOpen: true,
      mode: "view",
      data,
    });
  }, []);

  const openDelete = useCallback((data: TData) => {
    setState({
      isOpen: true,
      mode: "delete",
      data,
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({
      isOpen: false,
      mode: "create",
      data: null,
    });
  }, []);

  const setData = useCallback((data: TData | null) => {
    setState(prev => ({
      ...prev,
      data,
    }));
  }, []);

  return {
    state,
    isOpen: state.isOpen,
    mode: state.mode,
    data: state.data,
    openCreate,
    openEdit,
    openView,
    openDelete,
    close,
    clear,
    setData,
  };
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  itemId: number | null;
  itemName: string;
  variant?: "danger" | "warning" | "info";
}

export interface UseConfirmModalResult {
  state: ConfirmModalState;
  isOpen: boolean;
  itemId: number | null;
  itemName: string;
  open: (params: { 
    title: string; 
    message: string; 
    itemId: number; 
    itemName: string;
    variant?: "danger" | "warning" | "info";
  }) => void;
  close: () => void;
  clear: () => void;
}

export function useConfirmModal(): UseConfirmModalResult {
  const [state, setState] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    itemId: null,
    itemName: "",
    variant: "danger",
  });

  const open = useCallback((params: { 
    title: string; 
    message: string; 
    itemId: number; 
    itemName: string;
    variant?: "danger" | "warning" | "info";
  }) => {
    setState({
      isOpen: true,
      title: params.title,
      message: params.message,
      itemId: params.itemId,
      itemName: params.itemName,
      variant: params.variant || "danger",
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({
      isOpen: false,
      title: "",
      message: "",
      itemId: null,
      itemName: "",
      variant: "danger",
    });
  }, []);

  return {
    state,
    isOpen: state.isOpen,
    itemId: state.itemId,
    itemName: state.itemName,
    open,
    close,
    clear,
  };
}

export interface InputModalState {
  isOpen: boolean;
  mode: "create" | "edit";
  itemId: number | null;
  initialValue: string;
  title: string;
  placeholder?: string;
}

export interface UseInputModalResult {
  state: InputModalState;
  isOpen: boolean;
  mode: "create" | "edit";
  itemId: number | null;
  initialValue: string;
  openCreate: (params: { title: string; placeholder?: string }) => void;
  openEdit: (params: { 
    title: string; 
    itemId: number; 
    initialValue: string;
    placeholder?: string;
  }) => void;
  close: () => void;
  clear: () => void;
}

export function useInputModal(): UseInputModalResult {
  const [state, setState] = useState<InputModalState>({
    isOpen: false,
    mode: "create",
    itemId: null,
    initialValue: "",
    title: "",
    placeholder: "",
  });

  const openCreate = useCallback((params: { title: string; placeholder?: string }) => {
    setState({
      isOpen: true,
      mode: "create",
      itemId: null,
      initialValue: "",
      title: params.title,
      placeholder: params.placeholder,
    });
  }, []);

  const openEdit = useCallback((params: { 
    title: string; 
    itemId: number; 
    initialValue: string;
    placeholder?: string;
  }) => {
    setState({
      isOpen: true,
      mode: "edit",
      itemId: params.itemId,
      initialValue: params.initialValue,
      title: params.title,
      placeholder: params.placeholder,
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({
      isOpen: false,
      mode: "create",
      itemId: null,
      initialValue: "",
      title: "",
      placeholder: "",
    });
  }, []);

  return {
    state,
    isOpen: state.isOpen,
    mode: state.mode,
    itemId: state.itemId,
    initialValue: state.initialValue,
    openCreate,
    openEdit,
    close,
    clear,
  };
}
