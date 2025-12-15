import { db } from "../../../db.js";
import { conversations, eventsStandard } from "../../../../shared/schema.js";
import { sql } from "drizzle-orm";
import { getConversationsGroupedByUser, getConversationsList, getUserConversationsWithMessages } from "./conversationQueries.js";

export { type ConversationFilterParams } from "./conversationFilters.js";

export const conversationStats = {
  async getConversationsStats() {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(conversations);
    const [{ active }] = await db.select({ 
      active: sql<number>`count(*) filter (where status = 'active')` 
    }).from(conversations);
    const [{ totalMessages }] = await db.select({ 
      totalMessages: sql<number>`count(*) filter (where event_type = 'message')` 
    }).from(eventsStandard);
    
    return {
      total: Number(total),
      active: Number(active),
      closed: Number(total) - Number(active),
      totalMessages: Number(totalMessages),
    };
  },

  getConversationsGroupedByUser(
    limit = 50,
    offset = 0,
    productStandardFilter?: string,
    handlerFilter?: string,
    emotionLevelFilter?: number,
    clientFilter?: string,
    userAuthenticatedFilter?: string,
    handledByN1agoFilter?: string
  ) {
    return getConversationsGroupedByUser({
      limit,
      offset,
      productStandardFilter,
      handlerFilter,
      emotionLevelFilter,
      clientFilter,
      userAuthenticatedFilter,
      handledByN1agoFilter,
    });
  },

  getConversationsList(
    limit = 50,
    offset = 0,
    productStandardFilter?: string,
    handlerFilter?: string,
    emotionLevelFilter?: number,
    clientFilter?: string,
    userAuthenticatedFilter?: string,
    handledByN1agoFilter?: string,
    objectiveProblemFilter?: string,
    productIdFilter?: number,
    customerRequestTypeFilter?: string
  ) {
    return getConversationsList({
      limit,
      offset,
      productStandardFilter,
      handlerFilter,
      emotionLevelFilter,
      clientFilter,
      userAuthenticatedFilter,
      handledByN1agoFilter,
      objectiveProblemFilter,
      productIdFilter,
      customerRequestTypeFilter,
    });
  },

  getUserConversationsWithMessages,
};
