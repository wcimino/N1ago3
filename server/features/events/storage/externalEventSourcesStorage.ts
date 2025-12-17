import { db } from "../../../db.js";
import { externalEventSources } from "../../../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import type { ExternalEventSource, InsertExternalEventSource } from "../../../../shared/schema.js";
import crypto from "crypto";

function generateApiKey(): string {
  return `ees_${crypto.randomBytes(32).toString("hex")}`;
}

export const externalEventSourcesStorage = {
  async getAll(): Promise<ExternalEventSource[]> {
    return await db.select()
      .from(externalEventSources)
      .orderBy(desc(externalEventSources.createdAt));
  },

  async getById(id: number): Promise<ExternalEventSource | null> {
    const [source] = await db.select()
      .from(externalEventSources)
      .where(eq(externalEventSources.id, id));
    return source || null;
  },

  async getByApiKey(apiKey: string): Promise<ExternalEventSource | null> {
    const [source] = await db.select()
      .from(externalEventSources)
      .where(eq(externalEventSources.apiKey, apiKey));
    return source || null;
  },

  async getBySource(source: string): Promise<ExternalEventSource | null> {
    const [result] = await db.select()
      .from(externalEventSources)
      .where(eq(externalEventSources.source, source));
    return result || null;
  },

  async create(data: Omit<InsertExternalEventSource, "apiKey">): Promise<ExternalEventSource> {
    const apiKey = generateApiKey();
    const [source] = await db.insert(externalEventSources)
      .values({
        ...data,
        apiKey,
      })
      .returning();
    return source;
  },

  async update(id: number, data: Partial<Pick<InsertExternalEventSource, "name" | "channelType" | "isActive">>): Promise<ExternalEventSource | null> {
    const [source] = await db.update(externalEventSources)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(externalEventSources.id, id))
      .returning();
    return source || null;
  },

  async regenerateApiKey(id: number): Promise<ExternalEventSource | null> {
    const newApiKey = generateApiKey();
    const [source] = await db.update(externalEventSources)
      .set({
        apiKey: newApiKey,
        updatedAt: new Date(),
      })
      .where(eq(externalEventSources.id, id))
      .returning();
    return source || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(externalEventSources)
      .where(eq(externalEventSources.id, id));
    return (result.rowCount ?? 0) > 0;
  },

  async validateApiKeyAndSource(apiKey: string, source: string, channelType?: string): Promise<{ valid: boolean; reason?: string }> {
    const externalSource = await this.getByApiKey(apiKey);
    
    if (!externalSource) {
      return { valid: false, reason: "API key inválida" };
    }
    
    if (!externalSource.isActive) {
      return { valid: false, reason: "Sistema externo desativado" };
    }
    
    if (externalSource.source !== source) {
      return { valid: false, reason: `Source '${source}' não corresponde ao cadastrado para esta API key` };
    }
    
    if (channelType && externalSource.channelType !== channelType) {
      return { valid: false, reason: `Channel type '${channelType}' não corresponde ao cadastrado ('${externalSource.channelType}')` };
    }
    
    return { valid: true };
  },
};
