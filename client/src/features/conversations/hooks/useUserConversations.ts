import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import type { UserConversationsMessagesResponse } from "../../../types";

interface UseUserConversationsOptions {
  userId: string;
  conversationIdFromUrl?: number | null;
}

export function useUserConversations({ userId, conversationIdFromUrl }: UseUserConversationsOptions) {
  const queryClient = useQueryClient();
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);
  const hasInitializedSelection = useRef(false);

  const { data, isLoading, error, refetch } = useQuery<UserConversationsMessagesResponse>({
    queryKey: ["user-conversations-messages", userId],
    queryFn: () => fetchApi<UserConversationsMessagesResponse>(
      `/api/conversations/user/${encodeURIComponent(userId)}/messages`
    ),
    refetchInterval: 10000,
  });

  const sortedConversations = useMemo(() => {
    if (!data?.conversations) return [];
    return [...data.conversations].sort((a, b) => 
      new Date(b.conversation.created_at).getTime() - new Date(a.conversation.created_at).getTime()
    );
  }, [data?.conversations]);

  const toggleAutopilotMutation = useMutation({
    mutationFn: async ({ conversationId, enabled }: { conversationId: number; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/conversations/${conversationId}/autopilot`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-conversations-messages", userId] });
    },
  });

  const closeConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/close`, { reason: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-conversations-messages", userId] });
    },
    onError: (error: Error) => {
      alert(`Erro ao encerrar conversa: ${error.message}`);
    },
  });

  useEffect(() => {
    hasInitializedSelection.current = false;
    setSelectedConversationIndex(0);
  }, [userId]);

  useEffect(() => {
    if (sortedConversations.length > 0) {
      if (conversationIdFromUrl) {
        const targetIndex = sortedConversations.findIndex(
          (item) => item.conversation.id === conversationIdFromUrl
        );
        const newIndex = targetIndex >= 0 ? targetIndex : 0;
        if (newIndex !== selectedConversationIndex || !hasInitializedSelection.current) {
          setSelectedConversationIndex(newIndex);
        }
      } else if (!hasInitializedSelection.current) {
        setSelectedConversationIndex(0);
      }
      hasInitializedSelection.current = true;
    }
    if (sortedConversations.length > 0 && selectedConversationIndex >= sortedConversations.length) {
      setSelectedConversationIndex(sortedConversations.length - 1);
    }
  }, [sortedConversations.length, selectedConversationIndex, conversationIdFromUrl]);

  const selectedConversation = sortedConversations[selectedConversationIndex];
  const totalMessages = data?.conversations?.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;

  const goToPreviousConversation = useCallback(() => {
    setSelectedConversationIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const goToNextConversation = useCallback(() => {
    setSelectedConversationIndex((prev) => 
      prev < sortedConversations.length - 1 ? prev + 1 : prev
    );
  }, [sortedConversations.length]);

  const toggleAutopilot = useCallback((conversationId: number, enabled: boolean) => {
    toggleAutopilotMutation.mutate({ conversationId, enabled });
  }, [toggleAutopilotMutation]);

  const closeConversation = useCallback((conversationId: number) => {
    closeConversationMutation.mutate(conversationId);
  }, [closeConversationMutation]);

  return {
    data,
    isLoading,
    error,
    refetch,
    sortedConversations,
    selectedConversation,
    selectedConversationIndex,
    totalMessages,
    userProfile: data?.user_profile,
    goToPreviousConversation,
    goToNextConversation,
    toggleAutopilot,
    isTogglingAutopilot: toggleAutopilotMutation.isPending,
    closeConversation,
    isClosingConversation: closeConversationMutation.isPending,
  };
}
