import { Badge, type BadgeVariant } from "../shared/components/ui/Badge";

interface AuthorTypeBadgeProps {
  type: string;
}

const authorConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  customer: { variant: "info", label: "Cliente" },
  agent: { variant: "purple", label: "Agente" },
  bot: { variant: "teal", label: "Bot" },
  system: { variant: "default", label: "Sistema" },
};

export function AuthorTypeBadge({ type }: AuthorTypeBadgeProps) {
  const config = authorConfig[type] || { variant: "default" as BadgeVariant, label: type };

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
