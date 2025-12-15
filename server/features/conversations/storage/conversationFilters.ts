import { sql, type SQL } from "drizzle-orm";

export interface ConversationFilterParams {
  productStandardFilter?: string;
  handlerFilter?: string;
  emotionLevelFilter?: number;
  clientFilter?: string;
  userAuthenticatedFilter?: string;
  handledByN1agoFilter?: string;
  objectiveProblemFilter?: string;
  productIdFilter?: number;
  customerRequestTypeFilter?: string;
}

export type TableContext = 'conversation' | 'grouped_user';

export function buildFiltersForConversationList(params: ConversationFilterParams): {
  productCondition: SQL;
  emotionCondition: SQL;
  handlerCondition: SQL;
  userAuthenticatedCondition: SQL;
  handledByN1agoCondition: SQL;
  clientCondition: SQL;
  objectiveProblemCondition: SQL;
  customerRequestTypeCondition: SQL;
} {
  const {
    productStandardFilter,
    handlerFilter,
    emotionLevelFilter,
    clientFilter,
    userAuthenticatedFilter,
    handledByN1agoFilter,
    objectiveProblemFilter,
    productIdFilter,
    customerRequestTypeFilter,
  } = params;

  let productCondition = sql``;
  if (productIdFilter) {
    productCondition = sql`AND cs.product_id = ${productIdFilter}`;
  } else if (productStandardFilter) {
    productCondition = sql`AND pc.produto = ${productStandardFilter}`;
  }

  const emotionCondition = emotionLevelFilter 
    ? sql`AND cs.customer_emotion_level = ${emotionLevelFilter}` 
    : sql``;

  let handlerCondition = sql``;
  if (handlerFilter === 'bot') {
    handlerCondition = sql`AND (LOWER(c.current_handler_name) LIKE '%answerbot%' OR LOWER(c.current_handler_name) LIKE '%zd-answerbot%')`;
  } else if (handlerFilter === 'human') {
    handlerCondition = sql`AND (LOWER(c.current_handler_name) LIKE '%agentworkspace%' OR LOWER(c.current_handler_name) LIKE '%zd-agentworkspace%')`;
  } else if (handlerFilter === 'n1ago') {
    handlerCondition = sql`AND LOWER(c.current_handler_name) LIKE '%n1ago%'`;
  }

  let userAuthenticatedCondition = sql``;
  if (userAuthenticatedFilter === 'authenticated') {
    userAuthenticatedCondition = sql`AND u.authenticated = true`;
  } else if (userAuthenticatedFilter === 'not_authenticated') {
    userAuthenticatedCondition = sql`AND (u.authenticated = false OR u.authenticated IS NULL)`;
  }

  const handledByN1agoCondition = handledByN1agoFilter === 'yes' 
    ? sql`AND c.handled_by_n1ago = true` 
    : sql``;

  let clientCondition = sql``;
  if (clientFilter) {
    const clientSearchPattern = `%${clientFilter}%`;
    clientCondition = sql`AND (
      c.user_id ILIKE ${clientSearchPattern}
      OR u.profile->>'givenName' ILIKE ${clientSearchPattern}
      OR u.profile->>'surname' ILIKE ${clientSearchPattern}
      OR u.profile->>'email' ILIKE ${clientSearchPattern}
      OR CONCAT(u.profile->>'givenName', ' ', u.profile->>'surname') ILIKE ${clientSearchPattern}
    )`;
  }

  const objectiveProblemCondition = objectiveProblemFilter 
    ? sql`AND cs.objective_problems IS NOT NULL 
      AND jsonb_typeof(cs.objective_problems::jsonb) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(cs.objective_problems::jsonb) AS elem
        WHERE elem->>'name' = ${objectiveProblemFilter}
      )` 
    : sql``;

  const customerRequestTypeCondition = customerRequestTypeFilter 
    ? sql`AND cs.customer_request_type = ${customerRequestTypeFilter}` 
    : sql``;

  return {
    productCondition,
    emotionCondition,
    handlerCondition,
    userAuthenticatedCondition,
    handledByN1agoCondition,
    clientCondition,
    objectiveProblemCondition,
    customerRequestTypeCondition,
  };
}

export function buildFiltersForGroupedByUser(params: Omit<ConversationFilterParams, 'objectiveProblemFilter' | 'productIdFilter' | 'customerRequestTypeFilter'>): {
  productCondition: SQL;
  emotionCondition: SQL;
  handlerCondition: SQL;
  userAuthenticatedCondition: SQL;
  handledByN1agoCondition: SQL;
  clientCondition: SQL;
} {
  const {
    productStandardFilter,
    handlerFilter,
    emotionLevelFilter,
    clientFilter,
    userAuthenticatedFilter,
    handledByN1agoFilter,
  } = params;

  const productCondition = productStandardFilter 
    ? sql`AND lc_filter.last_product_standard = ${productStandardFilter}` 
    : sql``;

  const emotionCondition = emotionLevelFilter 
    ? sql`AND lc_filter.last_customer_emotion_level = ${emotionLevelFilter}` 
    : sql``;

  let handlerCondition = sql``;
  if (handlerFilter === 'bot') {
    handlerCondition = sql`AND (LOWER(lc_filter.current_handler_name) LIKE '%answerbot%' OR LOWER(lc_filter.current_handler_name) LIKE '%zd-answerbot%')`;
  } else if (handlerFilter === 'human') {
    handlerCondition = sql`AND (LOWER(lc_filter.current_handler_name) LIKE '%agentworkspace%' OR LOWER(lc_filter.current_handler_name) LIKE '%zd-agentworkspace%')`;
  } else if (handlerFilter === 'n1ago') {
    handlerCondition = sql`AND LOWER(lc_filter.current_handler_name) LIKE '%n1ago%'`;
  }

  let userAuthenticatedCondition = sql``;
  if (userAuthenticatedFilter === 'authenticated') {
    userAuthenticatedCondition = sql`AND lc_filter.user_authenticated = true`;
  } else if (userAuthenticatedFilter === 'not_authenticated') {
    userAuthenticatedCondition = sql`AND (lc_filter.user_authenticated = false OR lc_filter.user_authenticated IS NULL)`;
  }

  const handledByN1agoCondition = handledByN1agoFilter === 'yes' 
    ? sql`AND lc_filter.has_n1ago_conversation = true` 
    : sql``;

  let clientCondition = sql``;
  if (clientFilter) {
    const clientSearchPattern = `%${clientFilter}%`;
    clientCondition = sql`AND (
      lc_filter.user_id ILIKE ${clientSearchPattern}
      OR lc_filter.profile_given_name ILIKE ${clientSearchPattern}
      OR lc_filter.profile_surname ILIKE ${clientSearchPattern}
      OR lc_filter.profile_email ILIKE ${clientSearchPattern}
      OR CONCAT(lc_filter.profile_given_name, ' ', lc_filter.profile_surname) ILIKE ${clientSearchPattern}
    )`;
  }

  return {
    productCondition,
    emotionCondition,
    handlerCondition,
    userAuthenticatedCondition,
    handledByN1agoCondition,
    clientCondition,
  };
}
