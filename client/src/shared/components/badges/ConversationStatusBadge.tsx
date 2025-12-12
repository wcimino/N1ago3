interface ConversationStatusBadgeProps {
  status: string;
  closedReason?: string | null;
}

const closedReasonLabels: Record<string, string> = {
  inactivity: "inatividade",
  new_conversation: "nova conversa",
  manual: "manual",
  external: "sistema externo",
};

export function ConversationStatusBadge({ status, closedReason }: ConversationStatusBadgeProps) {
  const isActive = status === "active";
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isActive ? "Ativa" : "Fechada"}
      {!isActive && closedReason && ` (${closedReasonLabels[closedReason] || closedReason})`}
    </span>
  );
}
