export type AuthorType = "customer" | "agent" | "bot" | "system";

export interface StandardEvent {
  eventType: string;
  eventSubtype?: string;
  source: string;
  sourceEventId?: string;
  externalConversationId?: string;
  externalUserId?: string;
  authorType: AuthorType;
  authorId?: string;
  authorName?: string;
  contentText?: string;
  contentPayload?: any;
  occurredAt: Date;
  channelType?: string;
  metadata?: any;
}

export interface ExtractedUser {
  externalId: string;
  signedUpAt?: Date;
  authenticated?: boolean;
  profile?: any;
  metadata?: any;
  identities?: any;
}

export interface StandardUser {
  email: string;
  source: string;
  sourceUserId?: string;
  externalId?: string;
  name?: string;
  cpf?: string;
  phone?: string;
  locale?: string;
  signedUpAt?: Date;
  metadata?: any;
}

export interface ExtractedConversation {
  externalConversationId: string;
  externalAppId?: string;
  externalUserId?: string;
  userExternalId?: string;
  metadata?: any;
}

export interface SourceAdapter {
  source: string;
  normalize(rawPayload: any): StandardEvent[];
  extractUser(rawPayload: any): ExtractedUser | null;
  extractStandardUser(rawPayload: any): StandardUser | null;
  extractConversation(rawPayload: any): ExtractedConversation | null;
  verifyAuth(rawBody: Buffer, headers: Record<string, string>, secret?: string): { isValid: boolean; errorMessage?: string };
}
