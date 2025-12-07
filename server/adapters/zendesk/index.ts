import type { SourceAdapter, StandardEvent, ExtractedUser, ExtractedConversation, StandardUser } from "../types.js";
import { verifyZendeskAuth, type AuthVerificationResult } from "./auth.js";
import {
  mapMessageEvents,
  mapConversationCreated,
  mapReadReceipt,
  mapTypingEvent,
  mapGenericEvent,
} from "./eventTransformers.js";
import { extractUser, extractStandardUser } from "./userTransformers.js";
import { extractConversation } from "./conversationTransformers.js";

export class ZendeskAdapter implements SourceAdapter {
  source = "zendesk";

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
        return mapMessageEvents(payload, rootPayload, this.source);
      case "conversation:create":
        return [mapConversationCreated(payload, rootPayload, this.source)];
      case "conversation:read":
        return [mapReadReceipt(payload, rootPayload, this.source)];
      case "typing:start":
        return [mapTypingEvent(payload, rootPayload, this.source, "start")];
      case "typing:stop":
        return [mapTypingEvent(payload, rootPayload, this.source, "stop")];
      default:
        return [mapGenericEvent(event, rootPayload, this.source)];
    }
  }

  extractUser(rawPayload: any): ExtractedUser | null {
    return extractUser(rawPayload);
  }

  extractStandardUser(rawPayload: any): StandardUser | null {
    return extractStandardUser(rawPayload, this.source);
  }

  extractConversation(rawPayload: any): ExtractedConversation | null {
    return extractConversation(rawPayload);
  }

  verifyAuth(
    rawBody: Buffer,
    headers: Record<string, string>,
    secret?: string
  ): AuthVerificationResult {
    return verifyZendeskAuth(rawBody, headers, secret);
  }
}
