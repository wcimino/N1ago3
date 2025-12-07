import { Badge, type BadgeVariant } from "../ui";

interface EventTypeBadgeProps {
  type: string;
  subtype?: string | null;
  displayName?: string | null;
}

const eventTypeConfig: Record<string, BadgeVariant> = {
  message: "success",
  conversation_started: "info",
  typing: "warning",
  read_receipt: "default",
  "conversation:typing": "warning",
  "conversation:message": "success",
  "switchboard:passControl": "purple",
  "switchboard:releaseControl": "purple",
};

export function EventTypeBadge({ type, subtype, displayName }: EventTypeBadgeProps) {
  const variant = eventTypeConfig[type] || "default";
  const label = displayName || type;

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={variant}>
        {label}
      </Badge>
      {subtype && (
        <span className="text-xs text-gray-500">{subtype}</span>
      )}
    </div>
  );
}
