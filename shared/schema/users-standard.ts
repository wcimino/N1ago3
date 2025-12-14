import { pgTable, serial, text, timestamp, json, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

export const usersStandard = pgTable("users_standard", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  source: text("source").notNull(),
  sourceUserId: text("source_user_id"),
  externalId: text("external_id"),
  name: text("name"),
  cpf: text("cpf"),
  phone: text("phone"),
  locale: text("locale"),
  signedUpAt: timestamp("signed_up_at"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  cpfIdx: index("idx_users_standard_cpf").on(table.cpf),
  sourceIdx: index("idx_users_standard_source").on(table.source),
}));

export const usersStandardHistory = pgTable("users_standard_history", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  source: text("source"),
}, (table) => ({
  userEmailIdx: index("idx_users_standard_history_email").on(table.userEmail),
  changedAtIdx: index("idx_users_standard_history_changed_at").on(table.changedAt),
}));

export const organizationsStandard = pgTable("organizations_standard", {
  id: serial("id").primaryKey(),
  cnpj: varchar("cnpj"),
  cnpjRoot: varchar("cnpj_root").notNull().unique(),
  source: text("source").notNull(),
  name: text("name"),
  metadata: json("metadata"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  cnpjRootIdx: uniqueIndex("idx_organizations_standard_cnpj_root").on(table.cnpjRoot),
  cnpjIdx: index("idx_organizations_standard_cnpj").on(table.cnpj),
  sourceIdx: index("idx_organizations_standard_source").on(table.source),
}));

export const organizationsStandardHistory = pgTable("organizations_standard_history", {
  id: serial("id").primaryKey(),
  organizationCnpjRoot: varchar("organization_cnpj_root").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  source: text("source"),
}, (table) => ({
  cnpjRootIdx: index("idx_organizations_standard_history_cnpj_root").on(table.organizationCnpjRoot),
  changedAtIdx: index("idx_organizations_standard_history_changed_at").on(table.changedAt),
}));

export const userStandardHasOrganizationStandard = pgTable("user_standard_has_organization_standard", {
  id: serial("id").primaryKey(),
  userStandardId: integer("user_standard_id").notNull(),
  organizationStandardId: integer("organization_standard_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLink: uniqueIndex("idx_user_org_unique").on(table.userStandardId, table.organizationStandardId),
  userIdx: index("idx_user_standard_has_org_user").on(table.userStandardId),
  orgIdx: index("idx_user_standard_has_org_org").on(table.organizationStandardId),
}));

export type UserStandard = typeof usersStandard.$inferSelect;
export type InsertUserStandard = Omit<typeof usersStandard.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;
export type UserStandardHistory = typeof usersStandardHistory.$inferSelect;
export type InsertUserStandardHistory = Omit<typeof usersStandardHistory.$inferInsert, "id" | "changedAt">;
export type OrganizationStandard = typeof organizationsStandard.$inferSelect;
export type InsertOrganizationStandard = Omit<typeof organizationsStandard.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;
export type OrganizationStandardHistory = typeof organizationsStandardHistory.$inferSelect;
export type InsertOrganizationStandardHistory = Omit<typeof organizationsStandardHistory.$inferInsert, "id" | "changedAt">;
export type UserStandardHasOrganizationStandard = typeof userStandardHasOrganizationStandard.$inferSelect;
export type InsertUserStandardHasOrganizationStandard = Omit<typeof userStandardHasOrganizationStandard.$inferInsert, "id" | "createdAt">;
