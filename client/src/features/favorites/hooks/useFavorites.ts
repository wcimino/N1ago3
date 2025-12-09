import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../lib/queryClient";

interface FavoriteConversation {
  favoriteId: number;
  favoritedAt: string;
  conversationId: number;
  externalConversationId: string;
  userId: string | null;
  userExternalId: string | null;
  status: string;
  currentHandler: string | null;
  currentHandlerName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FavoritesResponse {
  favorites: FavoriteConversation[];
}

interface FavoriteIdsResponse {
  conversationIds: number[];
}

export function useFavorites() {
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery<FavoritesResponse>({
    queryKey: ["favorites"],
    queryFn: () => fetchApi<FavoritesResponse>("/api/favorites"),
  });

  const { data: favoriteIds } = useQuery<FavoriteIdsResponse>({
    queryKey: ["favorite-ids"],
    queryFn: () => fetchApi<FavoriteIdsResponse>("/api/favorites/ids"),
  });

  const addFavorite = useMutation({
    mutationFn: async (conversationId: number) => {
      const response = await fetch(`/api/favorites/${conversationId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to add favorite");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (conversationId: number) => {
      const response = await fetch(`/api/favorites/${conversationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to remove favorite");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
    },
  });

  const toggleFavorite = (conversationId: number) => {
    const isFavorite = favoriteIds?.conversationIds.includes(conversationId);
    if (isFavorite) {
      removeFavorite.mutate(conversationId);
    } else {
      addFavorite.mutate(conversationId);
    }
  };

  const isFavorite = (conversationId: number) => {
    return favoriteIds?.conversationIds.includes(conversationId) ?? false;
  };

  return {
    favorites: favorites?.favorites ?? [],
    favoriteIds: favoriteIds?.conversationIds ?? [],
    isLoading,
    addFavorite: addFavorite.mutate,
    removeFavorite: removeFavorite.mutate,
    toggleFavorite,
    isFavorite,
    isToggling: addFavorite.isPending || removeFavorite.isPending,
  };
}
