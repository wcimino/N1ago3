import { pgTable, serial, varchar, timestamp, json, index, uniqueIndex, integer } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

export const authUsers = pgTable("auth_users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const authorizedUsers = pgTable("authorized_users", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  name: varchar("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"),
  lastAccess: timestamp("last_access"),
});

export const authUsersConversationFavorites = pgTable("auth_users_conversation_favorites", {
  id: serial("id").primaryKey(),
  authUserId: varchar("auth_user_id").notNull(),
  conversationId: integer("conversation_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userConversationUnique: uniqueIndex("idx_favorites_user_conversation").on(table.authUserId, table.conversationId),
  authUserIdx: index("idx_favorites_auth_user").on(table.authUserId),
  conversationIdx: index("idx_favorites_conversation").on(table.conversationId),
}));

export type AuthUser = typeof authUsers.$inferSelect;
export type UpsertAuthUser = typeof authUsers.$inferInsert;
export type AuthorizedUser = typeof authorizedUsers.$inferSelect;
export type InsertAuthorizedUser = Omit<typeof authorizedUsers.$inferInsert, "id" | "createdAt">;
export type AuthUserConversationFavorite = typeof authUsersConversationFavorites.$inferSelect;
export type InsertAuthUserConversationFavorite = Omit<typeof authUsersConversationFavorites.$inferInsert, "id" | "createdAt">;
