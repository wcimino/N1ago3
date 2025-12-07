export type AuthorType = "customer" | "user" | "agent" | "business" | "app" | "bot" | "system";

export function getAuthorColor(authorType: string): string {
  switch (authorType) {
    case "customer":
    case "user":
      return "bg-blue-500";
    case "agent":
    case "business":
    case "app":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
}

export function isCustomerMessage(authorType: string): boolean {
  return authorType === "customer" || authorType === "user";
}

export function getAuthorLabel(authorType: string): string {
  const labels: Record<string, string> = {
    customer: "Cliente",
    user: "Cliente",
    agent: "Agente",
    business: "Empresa",
    app: "App",
    bot: "Bot",
    system: "Sistema",
  };
  return labels[authorType] || authorType;
}
