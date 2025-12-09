import { Star } from "lucide-react";

interface FavoriteButtonProps {
  conversationId: number;
  isFavorite: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  size?: "sm" | "md";
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  isLoading = false,
  size = "md",
}: FavoriteButtonProps) {
  const sizeClasses = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const buttonClasses = size === "sm" ? "p-1" : "p-1.5";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={isLoading}
      className={`${buttonClasses} rounded-lg transition-colors hover:bg-gray-100 disabled:opacity-50`}
      title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Star
        className={`${sizeClasses} transition-colors ${
          isFavorite
            ? "text-yellow-500 fill-yellow-500"
            : "text-gray-400 hover:text-yellow-500"
        }`}
      />
    </button>
  );
}
