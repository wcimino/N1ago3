import { db } from "../../core/db.js";
import { organizationsStandard, organizationsStandardHistory, userStandardHasOrganizationStandard, usersStandard } from "../../shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import type { OrganizationStandard, UserStandardHasOrganizationStandard, UserStandard } from "../../shared/schema.js";
import type { StandardOrganization } from "../../adapters/types.js";

const TRACKED_FIELDS = ["name", "cnpj"] as const;

export const organizationsStandardStorage = {
  async upsertStandardOrganization(org: StandardOrganization): Promise<OrganizationStandard> {
    const existingOrg = await db.select()
      .from(organizationsStandard)
      .where(eq(organizationsStandard.cnpjRoot, org.cnpjRoot))
      .limit(1);

    if (existingOrg.length === 0) {
      const [newOrg] = await db.insert(organizationsStandard)
        .values({
          cnpjRoot: org.cnpjRoot,
          cnpj: org.cnpj || null,
          source: org.source,
          name: org.name || null,
          metadata: org.metadata || null,
        })
        .returning();
      return newOrg;
    }

    const current = existingOrg[0];
    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

    const getValue = (val: string | null | undefined): string | null => {
      if (val === null || val === undefined || val === "") return null;
      return val;
    };

    for (const field of TRACKED_FIELDS) {
      const oldVal = getValue(current[field] as string | null);
      const newVal = getValue(org[field] as string | undefined);
      
      if (newVal !== null && newVal !== oldVal) {
        changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }

    if (changes.length > 0) {
      for (const change of changes) {
        await db.insert(organizationsStandardHistory).values({
          organizationCnpjRoot: org.cnpjRoot,
          fieldName: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          source: org.source,
        });
      }
    }

    const [updatedOrg] = await db.update(organizationsStandard)
      .set({
        source: org.source,
        cnpj: sql`COALESCE(NULLIF(${org.cnpj || ""}, ''), ${organizationsStandard.cnpj})`,
        name: sql`COALESCE(NULLIF(${org.name || ""}, ''), ${organizationsStandard.name})`,
        metadata: org.metadata || current.metadata,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizationsStandard.cnpjRoot, org.cnpjRoot))
      .returning();

    return updatedOrg;
  },

  async linkUserToOrganization(userEmail: string, orgCnpjRoot: string): Promise<UserStandardHasOrganizationStandard | null> {
    const [user] = await db.select({ id: usersStandard.id })
      .from(usersStandard)
      .where(eq(usersStandard.email, userEmail.toLowerCase()))
      .limit(1);

    if (!user) return null;

    const [org] = await db.select({ id: organizationsStandard.id })
      .from(organizationsStandard)
      .where(eq(organizationsStandard.cnpjRoot, orgCnpjRoot))
      .limit(1);

    if (!org) return null;

    const existingLink = await db.select()
      .from(userStandardHasOrganizationStandard)
      .where(and(
        eq(userStandardHasOrganizationStandard.userStandardId, user.id),
        eq(userStandardHasOrganizationStandard.organizationStandardId, org.id)
      ))
      .limit(1);

    if (existingLink.length > 0) {
      return existingLink[0];
    }

    const [newLink] = await db.insert(userStandardHasOrganizationStandard)
      .values({
        userStandardId: user.id,
        organizationStandardId: org.id,
      })
      .returning();

    return newLink;
  },

  async getOrganizationByCnpjRoot(cnpjRoot: string): Promise<OrganizationStandard | null> {
    const [org] = await db.select()
      .from(organizationsStandard)
      .where(eq(organizationsStandard.cnpjRoot, cnpjRoot));
    return org || null;
  },

  async getOrganizationHistory(cnpjRoot: string): Promise<Array<{
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    changedAt: Date;
    source: string | null;
  }>> {
    const history = await db.select()
      .from(organizationsStandardHistory)
      .where(eq(organizationsStandardHistory.organizationCnpjRoot, cnpjRoot))
      .orderBy(organizationsStandardHistory.changedAt);
    return history;
  },

  async getAllOrganizations(limit: number = 50, offset: number = 0): Promise<{ organizations: OrganizationStandard[]; total: number }> {
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(organizationsStandard);
    const total = Number(countResult.count);

    const organizations = await db.select()
      .from(organizationsStandard)
      .orderBy(sql`${organizationsStandard.lastSeenAt} DESC`)
      .limit(limit)
      .offset(offset);

    return { organizations, total };
  },

  async getOrganizationsByUser(userEmail: string): Promise<OrganizationStandard[]> {
    const result = await db.select({
      organization: organizationsStandard,
    })
      .from(userStandardHasOrganizationStandard)
      .innerJoin(usersStandard, eq(userStandardHasOrganizationStandard.userStandardId, usersStandard.id))
      .innerJoin(organizationsStandard, eq(userStandardHasOrganizationStandard.organizationStandardId, organizationsStandard.id))
      .where(eq(usersStandard.email, userEmail.toLowerCase()));

    return result.map(r => r.organization);
  },

  async getUsersByOrganization(cnpjRoot: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(userStandardHasOrganizationStandard)
      .innerJoin(organizationsStandard, eq(userStandardHasOrganizationStandard.organizationStandardId, organizationsStandard.id))
      .where(eq(organizationsStandard.cnpjRoot, cnpjRoot));

    return Number(result.count);
  },

  async getUsersListByOrganization(cnpjRoot: string): Promise<UserStandard[]> {
    const result = await db.select({
      user: usersStandard,
    })
      .from(userStandardHasOrganizationStandard)
      .innerJoin(usersStandard, eq(userStandardHasOrganizationStandard.userStandardId, usersStandard.id))
      .innerJoin(organizationsStandard, eq(userStandardHasOrganizationStandard.organizationStandardId, organizationsStandard.id))
      .where(eq(organizationsStandard.cnpjRoot, cnpjRoot));

    return result.map(r => r.user);
  },
};
