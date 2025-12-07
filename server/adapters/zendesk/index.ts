import type { SourceAdapter, StandardEvent, ExtractedUser, ExtractedConversation, AuthorType, StandardUser } from "../types.js";
import { verifyZendeskAuth, type AuthVerificationResult } from "./auth.js";

export class ZendeskAdapter implements SourceAdapter {
  source = "zendesk";

  private extractValidCpf(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 11) {
      return digitsOnly;
    }
    return undefined;
  }

  normalize(rawPayload: any): StandardEvent[] {
    const events: StandardEvent[] = [];
    
    for (const event of rawPayload.events || []) {
      const standardEvents = this.mapEvent(event, rawPayload);
      events.push(...standardEvents);
    }
    
    return events;
  }

  private mapEvent(event: any, rootPayload: any): StandardEvent[] {
    const eventType = event.type;
    const payload = event.payload || {};
    
    switch (eventType) {
      case "conversation:message":
      case "message":
        return this.mapMessageEvents(payload, rootPayload);
      case "conversation:create":
        return [this.mapConversationCreated(payload, rootPayload)];
      case "conversation:read":
        return [this.mapReadReceipt(payload, rootPayload)];
      case "typing:start":
        return [this.mapTypingEvent(payload, rootPayload, "start")];
      case "typing:stop":
        return [this.mapTypingEvent(payload, rootPayload, "stop")];
      default:
        return [this.mapGenericEvent(event, rootPayload)];
    }
  }

  private mapMessageEvents(payload: any, root: any): StandardEvent[] {
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

      events.push({
        eventType: "message",
        eventSubtype: content.type || "text",
        source: this.source,
        sourceEventId: message.id,
        externalConversationId: conversationData.id,
        externalUserId: userData?.id,
        authorType: this.mapAuthorType(author.type),
        authorId: author.userId || author.appId,
        authorName: author.displayName,
        contentText: content.text,
        contentPayload: content.type !== "text" ? content : null,
        occurredAt: message.received ? new Date(message.received) : new Date(),
        channelType: "chat",
        metadata: message.metadata,
      });
    }

    return events;
  }

  private mapConversationCreated(payload: any, root: any): StandardEvent {
    const conversationData = payload.conversation || {};
    const userData = payload.user || root.user;

    return {
      eventType: "conversation_started",
      source: this.source,
      sourceEventId: conversationData.id,
      externalConversationId: conversationData.id,
      externalUserId: userData?.id,
      authorType: "system",
      occurredAt: new Date(),
      channelType: "chat",
      metadata: { conversation: conversationData },
    };
  }

  private mapReadReceipt(payload: any, root: any): StandardEvent {
    const conversationData = payload.conversation || root.conversation || {};
    const userData = payload.user || root.user;

    return {
      eventType: "read_receipt",
      source: this.source,
      externalConversationId: conversationData.id,
      externalUserId: userData?.id,
      authorType: this.mapAuthorType(payload.author?.type),
      authorId: payload.author?.userId,
      occurredAt: new Date(),
      channelType: "chat",
    };
  }

  private mapTypingEvent(payload: any, root: any, subtype: "start" | "stop"): StandardEvent {
    const conversationData = payload.conversation || root.conversation || {};
    const userData = payload.user || payload.activity?.author?.user || root.user;

    return {
      eventType: "typing",
      eventSubtype: subtype,
      source: this.source,
      externalConversationId: conversationData.id,
      externalUserId: userData?.id,
      authorType: this.mapAuthorType(payload.activity?.author?.type || "user"),
      authorId: userData?.id,
      occurredAt: new Date(),
      channelType: "chat",
    };
  }

  private mapGenericEvent(event: any, root: any): StandardEvent {
    const payload = event.payload || {};
    const userData = payload.user || root.user;
    const conversationData = payload.conversation || root.conversation || {};

    return {
      eventType: event.type || "unknown",
      source: this.source,
      sourceEventId: payload.id || event.id,
      externalConversationId: conversationData.id,
      externalUserId: userData?.id,
      authorType: "system",
      occurredAt: new Date(),
      channelType: "chat",
      metadata: { originalEvent: event },
    };
  }

  private mapAuthorType(type: string | undefined): AuthorType {
    const mapping: Record<string, AuthorType> = {
      user: "customer",
      business: "agent",
      app: "bot",
    };
    return mapping[type || ""] || "system";
  }

  extractUser(rawPayload: any): ExtractedUser | null {
    const events = rawPayload.events || [];
    
    for (const event of events) {
      const payload = event.payload || {};
      const userData = payload.user || payload.activity?.author?.user || rawPayload.user;
      
      if (userData?.id) {
        let signedUpAt: Date | undefined;
        if (userData.signedUpAt) {
          try {
            signedUpAt = new Date(userData.signedUpAt);
          } catch {}
        }

        return {
          externalId: userData.id,
          signedUpAt,
          authenticated: userData.authenticated,
          profile: userData.profile,
          metadata: userData.metadata,
          identities: userData.identities,
        };
      }
    }

    if (rawPayload.user?.id) {
      return {
        externalId: rawPayload.user.id,
        authenticated: rawPayload.user.authenticated,
        profile: rawPayload.user.profile,
        metadata: rawPayload.user.metadata,
        identities: rawPayload.user.identities,
      };
    }

    return null;
  }

  extractStandardUser(rawPayload: any): StandardUser | null {
    const events = rawPayload.events || [];
    
    for (const event of events) {
      const payload = event.payload || {};
      const userData = payload.user || payload.activity?.author?.user || rawPayload.user;
      
      if (userData?.profile?.email) {
        const profile = userData.profile || {};
        
        let signedUpAt: Date | undefined;
        if (userData.signedUpAt) {
          try {
            signedUpAt = new Date(userData.signedUpAt);
          } catch {}
        }

        return {
          email: profile.email.toLowerCase().trim(),
          source: this.source,
          sourceUserId: userData.id,
          externalId: userData.externalId,
          name: profile.surname || undefined,
          cpf: this.extractValidCpf(profile.givenName),
          phone: profile.phone || undefined,
          locale: profile.locale || undefined,
          signedUpAt,
          metadata: userData.metadata,
        };
      }
    }

    if (rawPayload.user?.profile?.email) {
      const user = rawPayload.user;
      const profile = user.profile || {};
      
      let signedUpAt: Date | undefined;
      if (user.signedUpAt) {
        try {
          signedUpAt = new Date(user.signedUpAt);
        } catch {}
      }

      return {
        email: profile.email.toLowerCase().trim(),
        source: this.source,
        sourceUserId: user.id,
        externalId: user.externalId,
        name: profile.surname || undefined,
        cpf: this.extractValidCpf(profile.givenName),
        phone: profile.phone || undefined,
        locale: profile.locale || undefined,
        signedUpAt,
        metadata: user.metadata,
      };
    }

    return null;
  }

  extractConversation(rawPayload: any): ExtractedConversation | null {
    const events = rawPayload.events || [];
    
    for (const event of events) {
      const payload = event.payload || {};
      const conversationData = payload.conversation || rawPayload.conversation;
      
      if (conversationData?.id) {
        const userData = payload.user || rawPayload.user;
        
        return {
          externalConversationId: conversationData.id,
          externalAppId: rawPayload.app?.id,
          externalUserId: userData?.id,
          userExternalId: userData?.externalId,
          metadata: conversationData,
        };
      }
    }

    if (rawPayload.conversation?.id) {
      return {
        externalConversationId: rawPayload.conversation.id,
        externalAppId: rawPayload.app?.id,
        externalUserId: rawPayload.user?.id,
        userExternalId: rawPayload.user?.externalId,
        metadata: rawPayload.conversation,
      };
    }

    return null;
  }

  verifyAuth(
    rawBody: Buffer,
    headers: Record<string, string>,
    secret?: string
  ): AuthVerificationResult {
    return verifyZendeskAuth(rawBody, headers, secret);
  }
}
