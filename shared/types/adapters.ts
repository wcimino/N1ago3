import type { StandardEventInput } from "./events";
import type { ExtractedUser, StandardUser } from "./users";
import type { StandardOrganization } from "./organizations";
import type { ExtractedConversation } from "./conversations";

export interface SourceAdapter {
  source: string;
  normalize(rawPayload: any): StandardEventInput[];
  extractUser(rawPayload: any): ExtractedUser | null;
  extractStandardUser(rawPayload: any): StandardUser | null;
  extractStandardOrganization(rawPayload: any): StandardOrganization | null;
  extractConversation(rawPayload: any): ExtractedConversation | null;
  verifyAuth(rawBody: Buffer, headers: Record<string, string>, secret?: string): { isValid: boolean; errorMessage?: string };
}
