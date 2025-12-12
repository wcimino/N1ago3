export type AuthorType = "customer" | "user" | "agent" | "business" | "app" | "bot" | "system";

export type MessageSender = "customer" | "n1ago" | "zendeskBot" | "human";

const N1AGO_INTEGRATION_IDS = [
  "69357782256891c6fda71018",
  "693577c73ef61062218d9705",
];

export function getMessageSender(authorType: string, authorName?: string | null, authorId?: string | null): MessageSender {
  if (authorType === "customer" || authorType === "user") {
    return "customer";
  }
  
  const name = (authorName || "").toLowerCase();
  
  // N1ago detection - messages sent by our AI agent (by integration ID or name)
  if (authorId && N1AGO_INTEGRATION_IDS.includes(authorId)) {
    return "n1ago";
  }
  if (name.includes("n1ago")) {
    return "n1ago";
  }
  
  // Zendesk bot detection - Answer Bot or app-type messages
  // The bot often uses the company name (e.g., "iFood Pago") as displayName
  if (
    authorType === "bot" ||
    name.includes("answerbot") || 
    name.includes("zd-answerbot") ||
    name === "ifood pago" ||
    name.includes("pago")
  ) {
    return "zendeskBot";
  }
  
  return "human";
}

export function getAuthorColor(authorType: string, authorName?: string | null, authorId?: string | null): string {
  const sender = getMessageSender(authorType, authorName, authorId);
  
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
