import { Zap, ZapOff } from "lucide-react";

interface AutopilotToggleButtonProps {
  enabled: boolean;
  onToggle: () => void;
  isLoading: boolean;
  size?: "sm" | "md";
}

export function AutopilotToggleButton({
  enabled,
  onToggle,
  isLoading,
  size = "sm",
}: AutopilotToggleButtonProps) {
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  
  return (
    <button
      onClick={onToggle}
      disabled={isLoading}
      className={`inline-flex items-center justify-center ${sizeClasses} text-sm border rounded-lg transition-colors ${
        enabled
          ? "text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50"
          : "text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={enabled ? "Pausar AutoPilot" : "Ativar AutoPilot"}
    >
      {enabled ? (
        <ZapOff className={iconSize} />
      ) : (
        <Zap className={iconSize} />
      )}
    </button>
  );
}
