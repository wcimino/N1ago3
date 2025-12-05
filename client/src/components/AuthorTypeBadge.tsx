interface AuthorTypeBadgeProps {
  type: string;
}

export function AuthorTypeBadge({ type }: AuthorTypeBadgeProps) {
  const styles: Record<string, string> = {
    customer: "bg-blue-100 text-blue-800",
    agent: "bg-purple-100 text-purple-800",
    bot: "bg-teal-100 text-teal-800",
    system: "bg-gray-100 text-gray-800",
  };

  const labels: Record<string, string> = {
    customer: "Cliente",
    agent: "Agente",
    bot: "Bot",
    system: "Sistema",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || "bg-gray-100 text-gray-800"}`}>
      {labels[type] || type}
    </span>
  );
}
