import { Bot, Brain, UserCircle, MessageCircle } from "lucide-react";

interface HandlerBadgeProps {
  handlerName: string | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
}

interface HandlerInfo {
  label: string;
  icon: typeof Bot;
  bgClassName: string;
  iconClassName: string;
}

export function getHandlerInfo(handlerName: string | null | undefined): HandlerInfo | null {
  if (!handlerName) return null;

  const name = handlerName.toLowerCase();

  if (name.includes("answerbot") || name.includes("zd-answerbot")) {
    return {
      label: "Bot",
      icon: Bot,
      bgClassName: "bg-emerald-100",
      iconClassName: "text-emerald-600",
    };
  }

  if (name.includes("n1ago")) {
    return {
      label: "n1ago",
      icon: Brain,
      bgClassName: "bg-purple-100",
      iconClassName: "text-purple-600",
    };
  }

  if (name.includes("agentworkspace") || name.includes("zd-agentworkspace")) {
    return {
      label: "Humano",
      icon: UserCircle,
      bgClassName: "bg-amber-100",
      iconClassName: "text-amber-600",
    };
  }

  return {
    label: handlerName,
    icon: MessageCircle,
    bgClassName: "bg-gray-100",
    iconClassName: "text-gray-600",
  };
}

export function HandlerBadge({ handlerName, size = "md", showLabel = false }: HandlerBadgeProps) {
  const info = getHandlerInfo(handlerName);
  if (!info) return null;

  const sizeClasses = {
    sm: { container: "w-8 h-8", icon: "w-4 h-4" },
    md: { container: "w-10 h-10", icon: "w-5 h-5" },
  };

  const Icon = info.icon;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size].container} rounded-full flex items-center justify-center flex-shrink-0 ${info.bgClassName}`}
      >
        <Icon className={`${sizeClasses[size].icon} ${info.iconClassName}`} />
      </div>
      {showLabel && (
        <span className={`text-sm font-medium ${info.iconClassName}`}>{info.label}</span>
      )}
    </div>
  );
}
