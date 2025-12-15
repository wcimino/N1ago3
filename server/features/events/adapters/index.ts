import type { SourceAdapter } from "../../../../shared/types/adapters.js";
import { ZendeskAdapter } from "./zendesk/index.js";

const adapters: Record<string, SourceAdapter> = {};

export function registerAdapter(adapter: SourceAdapter) {
  adapters[adapter.source] = adapter;
}

export function getAdapter(source: string): SourceAdapter | null {
  return adapters[source] || null;
}

export function getAllAdapters(): SourceAdapter[] {
  return Object.values(adapters);
}

registerAdapter(new ZendeskAdapter());

export { ZendeskAdapter } from "./zendesk/index.js";
export type { SourceAdapter, StandardEventInput as StandardEvent, ExtractedUser, ExtractedConversation, AuthorType } from "../../../../shared/types/index.js";
