import { db } from "../../../db.js";
import { zendeskConversationsWebhookRaw } from "../../../../shared/schema.js";
import { sql, asc } from "drizzle-orm";
import { ZendeskAdapter } from "../../events/adapters/zendesk/index.js";
import { usersStandardStorage, organizationsStandardStorage } from "../../../storage/index.js";

export type ReprocessingType = "users" | "organizations";

export interface ReprocessingProgress {
  type: ReprocessingType;
  status: "idle" | "running" | "paused" | "completed" | "error";
  total: number;
  processed: number;
  successful: number;
  errors: number;
  currentId: number | null;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

const progressState: Record<ReprocessingType, ReprocessingProgress> = {
  users: {
    type: "users",
    status: "idle",
    total: 0,
    processed: 0,
    successful: 0,
    errors: 0,
    currentId: null,
    lastError: null,
    startedAt: null,
    completedAt: null,
  },
  organizations: {
    type: "organizations",
    status: "idle",
    total: 0,
    processed: 0,
    successful: 0,
    errors: 0,
    currentId: null,
    lastError: null,
    startedAt: null,
    completedAt: null,
  },
};

const runningProcesses: Record<ReprocessingType, boolean> = {
  users: false,
  organizations: false,
};

export const reprocessingService = {
  getProgress(type: ReprocessingType): ReprocessingProgress {
    return { ...progressState[type] };
  },

  getAllProgress(): Record<ReprocessingType, ReprocessingProgress> {
    return {
      users: { ...progressState.users },
      organizations: { ...progressState.organizations },
    };
  },

  async start(type: ReprocessingType): Promise<void> {
    if (runningProcesses[type]) {
      return;
    }

    const currentState = progressState[type];

    if (currentState.status === "paused" && currentState.currentId !== null) {
      progressState[type].status = "running";
      runningProcesses[type] = true;
      this.processNext(type);
      return;
    }

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(zendeskConversationsWebhookRaw);
    const total = Number(countResult.count);

    progressState[type] = {
      type,
      status: "running",
      total,
      processed: 0,
      successful: 0,
      errors: 0,
      currentId: null,
      lastError: null,
      startedAt: new Date(),
      completedAt: null,
    };

    runningProcesses[type] = true;
    this.processNext(type);
  },

  async stop(type: ReprocessingType): Promise<void> {
    runningProcesses[type] = false;
    if (progressState[type].status === "running") {
      progressState[type].status = "paused";
    }
  },

  async processNext(type: ReprocessingType): Promise<void> {
    if (!runningProcesses[type]) {
      return;
    }

    const adapter = new ZendeskAdapter();
    const lastId = progressState[type].currentId || 0;

    const [nextRecord] = await db.select()
      .from(zendeskConversationsWebhookRaw)
      .where(sql`${zendeskConversationsWebhookRaw.id} > ${lastId}`)
      .orderBy(asc(zendeskConversationsWebhookRaw.id))
      .limit(1);

    if (!nextRecord) {
      progressState[type].status = "completed";
      progressState[type].completedAt = new Date();
      runningProcesses[type] = false;
      return;
    }

    progressState[type].currentId = nextRecord.id;

    try {
      const payload = nextRecord.payload as any;

      if (type === "users") {
        const standardUser = adapter.extractStandardUser(payload);
        if (standardUser) {
          await usersStandardStorage.upsertStandardUser(standardUser);
          progressState[type].successful++;
        }
      } else {
        const standardOrg = adapter.extractStandardOrganization(payload);
        if (standardOrg) {
          await organizationsStandardStorage.upsertStandardOrganization(standardOrg);
          
          const standardUser = adapter.extractStandardUser(payload);
          if (standardUser) {
            await organizationsStandardStorage.linkUserToOrganization(
              standardUser.email,
              standardOrg.cnpjRoot
            );
          }
          progressState[type].successful++;
        }
      }
    } catch (error: any) {
      progressState[type].errors++;
      progressState[type].lastError = error.message || String(error);
    }

    progressState[type].processed++;

    setTimeout(() => this.processNext(type), 50);
  },

  async reset(type: ReprocessingType): Promise<void> {
    runningProcesses[type] = false;
    progressState[type] = {
      type,
      status: "idle",
      total: 0,
      processed: 0,
      successful: 0,
      errors: 0,
      currentId: null,
      lastError: null,
      startedAt: null,
      completedAt: null,
    };
  },
};
