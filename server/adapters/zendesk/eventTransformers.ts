import type { StandardEvent, AuthorType } from "../types.js";

const N1AGO_INTEGRATION_IDS = [
  "69357782256891c6fda71018",
  "693577c73ef61062218d9705",
];

function isN1agoIntegration(appId: string | undefined): boolean {
  return !!appId && N1AGO_INTEGRATION_IDS.includes(appId);
}

export function mapAuthorType(type: string | undefined): AuthorType {
  const mapping: Record<string, AuthorType> = {
    user: "customer",
    business: "agent",
    app: "bot",
  };
  return mapping[type || ""] || "system";
}

export function mapMessageEvents(payload: any, root: any, source: string): StandardEvent[] {
  const events: StandardEvent[] = [];
  
  let messages = payload.messages || [];
  if (!messages.length && payload.message) {
    messages = [payload.message];
  }

  for (const message of messages) {
    const author = message.author || {};
    const content = message.content || {};
    const conversationData = payload.conversation || root.conversation || {};
    const userData = payload.user || root.user;
    
    const authorId = author.userId || author.appId;
    const authorName = isN1agoIntegration(author.appId) ? "N1ago" : author.displayName;

    events.push({
      eventType: "message",
      eventSubtype: content.type || "text",
      source,
      sourceEventId: message.id,
      externalConversationId: conversationData.id,
      externalUserId: userData?.id,
      authorType: mapAuthorType(author.type),
      authorId,
      authorName,
      contentText: content.text,
      contentPayload: content.type !== "text" ? content : null,
      occurredAt: message.received ? new Date(message.received) : new Date(),
      channelType: "chat",
      metadata: message.metadata,
    });
  }

  return events;
}

export function mapConversationCreated(payload: any, root: any, source: string): StandardEvent {
  const conversationData = payload.conversation || {};
  const userData = payload.user || root.user;

  return {
    eventType: "conversation_started",
    source,
    sourceEventId: conversationData.id,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: "system",
    occurredAt: new Date(),
    channelType: "chat",
    metadata: { conversation: conversationData },
  };
}

export function mapReadReceipt(payload: any, root: any, source: string): StandardEvent {
  const conversationData = payload.conversation || root.conversation || {};
  const userData = payload.user || root.user;

  return {
    eventType: "read_receipt",
    source,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: mapAuthorType(payload.author?.type),
    authorId: payload.author?.userId,
    occurredAt: new Date(),
    channelType: "chat",
  };
}

export function mapTypingEvent(payload: any, root: any, source: string, subtype: "start" | "stop"): StandardEvent {
  const conversationData = payload.conversation || root.conversation || {};
  const userData = payload.user || payload.activity?.author?.user || root.user;

  return {
    eventType: "typing",
    eventSubtype: subtype,
    source,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: mapAuthorType(payload.activity?.author?.type || "user"),
    authorId: userData?.id,
    occurredAt: new Date(),
    channelType: "chat",
  };
}

export function mapGenericEvent(event: any, root: any, source: string): StandardEvent {
  const payload = event.payload || {};
  const userData = payload.user || root.user;
  const conversationData = payload.conversation || root.conversation || {};

  return {
    eventType: event.type || "unknown",
    source,
    sourceEventId: payload.id || event.id,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: "system",
    occurredAt: new Date(),
    channelType: "chat",
    metadata: { originalEvent: event },
  };
}

export function mapSwitchboardPassControl(root: any, source: string): StandardEvent {
  const conversationData = root.conversation || {};
  const appUser = root.appUser;
  
  // Extract activeSwitchboardIntegration from multiple possible locations
  // New format: root.switchboardConversation.activeSwitchboardIntegration
  // Legacy format: root.activeSwitchboardIntegration
  const activeSwitchboard = 
    root.switchboardConversation?.activeSwitchboardIntegration ||
    root.activeSwitchboardIntegration ||
    {};
  
  // Get event ID from the first event or generate from switchboard data
  const firstEvent = root.events?.[0];
  const sourceEventId = firstEvent?.id || 
    root.switchboardConversation?.id || 
    `passControl_${conversationData.id}`;

  return {
    eventType: "switchboard:passControl",
    eventSubtype: "received",
    source,
    sourceEventId,
    externalConversationId: conversationData.id,
    externalUserId: appUser?.id || root.user?.id,
    authorType: "system",
    occurredAt: new Date(),
    channelType: "chat",
    metadata: {
      trigger: root.trigger,
      activeSwitchboardIntegration: activeSwitchboard,
      appUser: appUser,
    },
  };
}
