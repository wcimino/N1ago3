interface EventTypeBadgeProps {
  type: string;
  subtype?: string | null;
  displayName?: string | null;
}

export function EventTypeBadge({ type, subtype, displayName }: EventTypeBadgeProps) {
  const styles: Record<string, string> = {
    message: "bg-green-100 text-green-800",
    conversation_started: "bg-blue-100 text-blue-800",
    typing: "bg-yellow-100 text-yellow-800",
    read_receipt: "bg-gray-100 text-gray-600",
    "conversation:typing": "bg-yellow-100 text-yellow-800",
    "conversation:message": "bg-green-100 text-green-800",
    "switchboard:passControl": "bg-purple-100 text-purple-800",
    "switchboard:releaseControl": "bg-purple-100 text-purple-800",
  };

  const label = displayName || type;

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || "bg-gray-100 text-gray-800"}`}>
        {label}
      </span>
      {subtype && (
        <span className="text-xs text-gray-500">{subtype}</span>
      )}
    </div>
  );
}
