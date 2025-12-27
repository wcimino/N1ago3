import { db } from "../../../db.js";
import { conversationsSummary } from "../../../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { isValidOwnerTransition, type ConversationOwner } from "../../ai/services/conversationOrchestrator/types.js";
import type { ClientHubData } from "../../../../shared/schema/clientHub.js";

export const conversationOrchestratorState = {
  async updateOrchestratorStatus(conversationId: number, orchestratorStatus: string) {
    const result = await db.update(conversationsSummary)
      .set({
        orchestratorStatus,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId))
      .returning();
    
    if (result[0]) {
      return result[0];
    }
    
    const now = new Date();
    const insertResult = await db.insert(conversationsSummary)
      .values({
        conversationId,
        summary: "",
        orchestratorStatus,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: { orchestratorStatus, updatedAt: now },
      })
      .returning();
    
    return insertResult[0] || null;
  },

  async getOrchestratorStatus(conversationId: number): Promise<string | null> {
    const result = await db.select({ orchestratorStatus: conversationsSummary.orchestratorStatus })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    return result[0]?.orchestratorStatus || null;
  },

  async getOrchestratorState(conversationId: number): Promise<{
    orchestratorStatus: string | null;
    conversationOwner: string | null;
    waitingForCustomer: boolean;
    lastProcessedEventId: number | null;
  }> {
    const result = await db.select({
      orchestratorStatus: conversationsSummary.orchestratorStatus,
      conversationOwner: conversationsSummary.conversationOwner,
      waitingForCustomer: conversationsSummary.waitingForCustomer,
      lastProcessedEventId: conversationsSummary.lastProcessedEventId,
    })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    if (result[0]) {
      return {
        orchestratorStatus: result[0].orchestratorStatus,
        conversationOwner: result[0].conversationOwner,
        waitingForCustomer: result[0].waitingForCustomer ?? false,
        lastProcessedEventId: result[0].lastProcessedEventId,
      };
    }
    return {
      orchestratorStatus: null,
      conversationOwner: null,
      waitingForCustomer: false,
      lastProcessedEventId: null,
    };
  },

  async updateOrchestratorState(conversationId: number, state: {
    orchestratorStatus?: string;
    conversationOwner?: string | null;
    waitingForCustomer?: boolean;
    lastProcessedEventId?: number;
  }) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (state.orchestratorStatus !== undefined) {
      updateData.orchestratorStatus = state.orchestratorStatus;
    }
    if (state.conversationOwner !== undefined) {
      const currentState = await this.getOrchestratorState(conversationId);
      const currentOwner = currentState.conversationOwner as ConversationOwner | null;
      const newOwner = state.conversationOwner as ConversationOwner | null;
      
      if (!isValidOwnerTransition(currentOwner, newOwner)) {
        console.warn(`[ConversationStorage] Invalid owner transition for conversation ${conversationId}: ${currentOwner} -> ${newOwner}`);
      }
      
      updateData.conversationOwner = state.conversationOwner;
    }
    if (state.waitingForCustomer !== undefined) {
      updateData.waitingForCustomer = state.waitingForCustomer;
    }
    if (state.lastProcessedEventId !== undefined) {
      updateData.lastProcessedEventId = state.lastProcessedEventId;
    }
    
    const result = await db.update(conversationsSummary)
      .set(updateData)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .returning();
    
    if (result[0]) {
      return result[0];
    }
    
    const now = new Date();
    const insertResult = await db.insert(conversationsSummary)
      .values({
        conversationId,
        summary: "",
        orchestratorStatus: state.orchestratorStatus || "new",
        conversationOwner: state.conversationOwner || null,
        waitingForCustomer: state.waitingForCustomer || false,
        lastProcessedEventId: state.lastProcessedEventId || null,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: updateData,
      })
      .returning();
    
    return insertResult[0] || null;
  },

  async tryClaimEventForProcessing(
    conversationId: number,
    eventId: number,
    expectedLastEventId: number | null
  ): Promise<boolean> {
    const condition = expectedLastEventId === null
      ? and(
          eq(conversationsSummary.conversationId, conversationId),
          sql`${conversationsSummary.lastProcessedEventId} IS NULL`
        )
      : and(
          eq(conversationsSummary.conversationId, conversationId),
          eq(conversationsSummary.lastProcessedEventId, expectedLastEventId)
        );
    
    const result = await db.update(conversationsSummary)
      .set({
        lastProcessedEventId: eventId,
        waitingForCustomer: false,
        updatedAt: new Date(),
      })
      .where(condition)
      .returning({ id: conversationsSummary.id });
    
    if (result.length > 0) {
      return true;
    }
    
    const existing = await db.select({ id: conversationsSummary.id })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    if (existing.length === 0) {
      const now = new Date();
      await db.insert(conversationsSummary)
        .values({
          conversationId,
          summary: "",
          orchestratorStatus: "new",
          conversationOwner: null,
          waitingForCustomer: false,
          lastProcessedEventId: eventId,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      return true;
    }
    
    return false;
  },

  async appendOrchestratorLog(conversationId: number, entry: {
    turn: number;
    agent: string;
    state: { status: string; owner: string | null; waitingForCustomer: boolean };
    solutionCenterResults: number;
    aiDecision: string | null;
    aiReason: string | null;
    action: string;
    details?: Record<string, unknown>;
  }) {
    const logEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    
    await db.update(conversationsSummary)
      .set({
        conversationOrchestratorLog: sql`COALESCE(${conversationsSummary.conversationOrchestratorLog}, '[]'::jsonb) || ${JSON.stringify(logEntry)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId));
  },

  async getClientHubData(conversationId: number): Promise<ClientHubData | null> {
    const result = await db.select({
      clientHubData: conversationsSummary.clientHubData,
    })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    return result[0]?.clientHubData || null;
  },
};
