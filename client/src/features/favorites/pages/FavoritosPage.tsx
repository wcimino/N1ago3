import { useLocation } from "wouter";
import { Star, MessageCircle } from "lucide-react";
import { useFavorites } from "../hooks/useFavorites";
import { LoadingState, EmptyState } from "../../../shared/components/ui";
import { useDateFormatters } from "../../../shared/hooks";
import { HandlerBadge } from "../../../shared/components/badges/HandlerBadge";
import { FavoriteButton } from "../components/FavoriteButton";

export function FavoritosPage() {
  const [, navigate] = useLocation();
  const { favorites, isLoading, toggleFavorite, isToggling } = useFavorites();
  const { formatShortDateTime } = useDateFormatters();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Favoritos</h2>
          <p className="text-sm text-gray-500 mt-1">Atendimentos marcados como favoritos</p>
        </div>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">Favoritos</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">Atendimentos marcados como favoritos</p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Star className="w-12 h-12 text-gray-300" />}
          title="Nenhum favorito ainda"
          description="Clique na estrela ao lado de um atendimento para marcá-lo como favorito"
        />
      ) : (
        <div className="divide-y divide-gray-200">
          {favorites.map((favorite) => (
            <div key={favorite.favoriteId} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <HandlerBadge handlerName={favorite.currentHandlerName} size="lg" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {favorite.userExternalId || favorite.userId || favorite.externalConversationId}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      favorite.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {favorite.status === "active" ? "Ativa" : "Fechada"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>ID: {favorite.externalConversationId.slice(0, 12)}...</span>
                    <span>Criado: {formatShortDateTime(favorite.createdAt)}</span>
                    <span>Favoritado: {formatShortDateTime(favorite.favoritedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <FavoriteButton
                    conversationId={favorite.conversationId}
                    isFavorite={true}
                    onToggle={() => toggleFavorite(favorite.conversationId)}
                    isLoading={isToggling}
                  />
                  <button
                    onClick={() => navigate(`/atendimentos/${encodeURIComponent(favorite.userId || favorite.externalConversationId)}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Ver
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
