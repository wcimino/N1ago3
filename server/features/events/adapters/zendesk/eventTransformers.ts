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
    const messageSource = message.source || {};
    
    // Extract the active switchboard integration info
    const activeSwitchboard = conversationData.activeSwitchboardIntegration;
    const activeSwitchboardId = activeSwitchboard?.id;
    const activeSwitchboardName = activeSwitchboard?.name;
    
    // Determine authorId based on message source:
    // - For user messages: use author.userId
    // - For API messages (source.type = "api:conversations"): use activeSwitchboardIntegration.id
    // - For other business messages: use author.appId or activeSwitchboardId as fallback
    let authorId: string | undefined;
    if (author.type === "user") {
      authorId = author.userId;
    } else if (messageSource.type === "api:conversations") {
      // Messages sent via our API - use the switchboard integration ID
      authorId = activeSwitchboardId;
    } else {
      // Other business/bot messages
      authorId = author.appId || activeSwitchboardId;
    }
    
    // Check if this message was sent by N1ago:
    // - Message is not from a user (customer)
    // - Message came via API (source.type = "api:conversations")
    // - AND the active switchboard is N1ago (by ID or by name containing "n1ago")
    const isN1agoMessage = 
      author.type !== "user" &&
      messageSource.type === "api:conversations" && 
      (isN1agoIntegration(authorId) || activeSwitchboardName?.toLowerCase().includes("n1ago"));

    const authorName = isN1agoMessage ? "N1ago" : author.displayName;

    const hasActions = Array.isArray(content.actions) && content.actions.length > 0;
    const contentPayload = content.type !== "text" 
      ? content 
      : hasActions 
        ? { actions: content.actions } 
        : null;

    // For file/image messages, use altText or text as contentText fallback
    let contentText = content.text;
    if (!contentText && (content.type === "file" || content.type === "image")) {
      contentText = content.altText || content.name || null;
    }

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
      contentText,
      contentPayload,
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

export function mapReadReceipt(event: any, root: any, source: string): StandardEvent {
  const payload = event.payload || {};
  const conversationData = payload.conversation || root.conversation || {};
  const userData = payload.user || root.user;

  return {
    eventType: "read_receipt",
    source,
    sourceEventId: event.id,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: mapAuthorType(payload.author?.type || payload.activity?.author?.type),
    authorId: payload.author?.userId || payload.activity?.author?.userId,
    occurredAt: event.createdAt ? new Date(event.createdAt) : new Date(),
    channelType: "chat",
  };
}

export function mapTypingEvent(event: any, root: any, source: string, subtype: "start" | "stop"): StandardEvent {
  const payload = event.payload || {};
  const conversationData = payload.conversation || root.conversation || {};
  const userData = payload.user || payload.activity?.author?.user || root.user;
  const activityType = payload.activity?.type;
  const resolvedSubtype = activityType === "typing:start" ? "start" : activityType === "typing:stop" ? "stop" : subtype;

  return {
    eventType: "typing",
    eventSubtype: resolvedSubtype,
    source,
    sourceEventId: event.id,
    externalConversationId: conversationData.id,
    externalUserId: userData?.id,
    authorType: mapAuthorType(payload.activity?.author?.type || "user"),
    authorId: userData?.id,
    occurredAt: event.createdAt ? new Date(event.createdAt) : new Date(),
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
