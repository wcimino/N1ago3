import { db } from "../../../db.js";
import { authUsersConversationFavorites, conversations } from "../../../../shared/schema.js";
import { eq, and, desc } from "drizzle-orm";
import type { AuthUserConversationFavorite, InsertAuthUserConversationFavorite } from "../../../../shared/schema.js";

export const favoritesStorage = {
  async getFavorites(authUserId: string): Promise<AuthUserConversationFavorite[]> {
    return await db.select()
      .from(authUsersConversationFavorites)
      .where(eq(authUsersConversationFavorites.authUserId, authUserId))
      .orderBy(desc(authUsersConversationFavorites.createdAt));
  },

  async getFavoriteConversationIds(authUserId: string): Promise<number[]> {
    const favorites = await db.select({ conversationId: authUsersConversationFavorites.conversationId })
      .from(authUsersConversationFavorites)
      .where(eq(authUsersConversationFavorites.authUserId, authUserId));
    return favorites.map(f => f.conversationId);
  },

  async isFavorite(authUserId: string, conversationId: number): Promise<boolean> {
    const [favorite] = await db.select()
      .from(authUsersConversationFavorites)
      .where(and(
        eq(authUsersConversationFavorites.authUserId, authUserId),
        eq(authUsersConversationFavorites.conversationId, conversationId)
      ));
    return !!favorite;
  },

  async addFavorite(data: InsertAuthUserConversationFavorite): Promise<AuthUserConversationFavorite> {
    const [favorite] = await db.insert(authUsersConversationFavorites)
      .values(data)
      .onConflictDoNothing()
      .returning();
    
    if (!favorite) {
      const [existing] = await db.select()
        .from(authUsersConversationFavorites)
        .where(and(
          eq(authUsersConversationFavorites.authUserId, data.authUserId),
          eq(authUsersConversationFavorites.conversationId, data.conversationId)
        ));
      return existing;
    }
    return favorite;
  },

  async removeFavorite(authUserId: string, conversationId: number): Promise<boolean> {
    await db.delete(authUsersConversationFavorites)
      .where(and(
        eq(authUsersConversationFavorites.authUserId, authUserId),
        eq(authUsersConversationFavorites.conversationId, conversationId)
      ));
    return true;
  },

  async getFavoriteConversations(authUserId: string) {
    const favorites = await db.select({
      favoriteId: authUsersConversationFavorites.id,
      favoritedAt: authUsersConversationFavorites.createdAt,
      conversationId: conversations.id,
      externalConversationId: conversations.externalConversationId,
      userId: conversations.userId,
      userExternalId: conversations.userExternalId,
      status: conversations.status,
      currentHandler: conversations.currentHandler,
      currentHandlerName: conversations.currentHandlerName,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
      .from(authUsersConversationFavorites)
      .innerJoin(conversations, eq(authUsersConversationFavorites.conversationId, conversations.id))
      .where(eq(authUsersConversationFavorites.authUserId, authUserId))
      .orderBy(desc(authUsersConversationFavorites.createdAt));
    
    return favorites;
  },
};
