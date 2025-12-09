export type AuthorType = "customer" | "user" | "agent" | "business" | "app" | "bot" | "system";

export type MessageSender = "customer" | "n1ago" | "zendeskBot" | "human";

export function getMessageSender(authorType: string, authorName?: string | null): MessageSender {
  if (authorType === "customer" || authorType === "user") {
    return "customer";
  }
  
  const name = (authorName || "").toLowerCase();
  
  if (name.includes("n1ago")) {
    return "n1ago";
  }
  
  if (name.includes("answerbot") || name.includes("zd-answerbot") || authorType === "bot") {
    return "zendeskBot";
  }
  
  return "human";
}

export function getAuthorColor(authorType: string, authorName?: string | null): string {
  const sender = getMessageSender(authorType, authorName);
  
  switch (sender) {
    case "customer":
      return "bg-blue-500";
    case "n1ago":
      return "bg-purple-500";
    case "zendeskBot":
      return "bg-amber-500";
    case "human":
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
