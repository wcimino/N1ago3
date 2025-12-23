import { db } from "../../../db.js";
import { sql } from "drizzle-orm";

export interface DashboardAnalyticsParams {
  period: "lastHour" | "last24Hours";
  timezone?: string;
}

export interface SubproductItem {
  subproduct: string;
  count: number;
}

export interface ProductItem {
  product: string;
  productId: number | null;
  count: number;
  subproducts?: SubproductItem[];
}

export interface EmotionItem {
  emotionLevel: number;
  count: number;
}

export interface ProblemItem {
  problemName: string;
  count: number;
}

export interface HourlyItem {
  hour: number;
  isCurrentHour: boolean;
  isPast: boolean;
  todayCount: number;
  lastWeekCount: number;
}

export interface DashboardAnalyticsResponse {
  products: { items: ProductItem[]; total: number };
  emotions: { items: EmotionItem[]; total: number };
  problems: { items: ProblemItem[]; total: number };
  users: { total: number; authenticated: number; anonymous: number };
  hourly: HourlyItem[];
}

export const dashboardAnalyticsStorage = {
  async getDashboardAnalytics(params: DashboardAnalyticsParams): Promise<DashboardAnalyticsResponse> {
    const { period, timezone = 'America/Sao_Paulo' } = params;
    
    const now = new Date();
    const since = period === "lastHour" 
      ? new Date(now.getTime() - 60 * 60 * 1000)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const minMessages = 2;

    const parseJsonSafe = <T>(json: unknown): T[] => {
      if (!json) return [];
      if (Array.isArray(json)) return json as T[];
      if (typeof json === 'string') {
        try {
          const parsed = JSON.parse(json);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const [mainResult, hourlyResult] = await Promise.all([
      db.execute<{
        products_json: string;
        emotions_json: string;
        problems_json: string;
        problems_total: number;
        users_total: number;
        users_authenticated: number;
      }>(sql`
        WITH conversation_message_counts AS (
          SELECT conversation_id, COUNT(*)::int as msg_count
          FROM events_standard
          WHERE event_type = 'message' AND occurred_at >= ${since}
          GROUP BY conversation_id
          HAVING COUNT(*) > ${minMessages}
        ),
        active_conversations AS (
          SELECT DISTINCT c.id as conversation_id, c.user_id as conv_user_id
          FROM conversations c
          INNER JOIN conversation_message_counts cmc ON c.id = cmc.conversation_id
        ),
        products_subproducts_agg AS (
          SELECT 
            COALESCE(pc.name, 'Sem classificação') as product,
            sc.name as subproduct,
            COUNT(DISTINCT ac.conversation_id)::int as count
          FROM active_conversations ac
          LEFT JOIN conversations_summary cs ON ac.conversation_id = cs.conversation_id
          LEFT JOIN products_catalog pc ON cs.product_id = pc.id
          LEFT JOIN subproducts_catalog sc ON cs.subproduct_id = sc.id
          GROUP BY COALESCE(pc.name, 'Sem classificação'), sc.name
        ),
        products_agg AS (
          SELECT 
            product,
            SUM(count)::int as count,
            json_agg(
              json_build_object('subproduct', subproduct, 'count', count)
              ORDER BY count DESC
            ) FILTER (WHERE subproduct IS NOT NULL) as subproducts
          FROM products_subproducts_agg
          GROUP BY product
          ORDER BY count DESC
        ),
        emotions_agg AS (
          SELECT 
            COALESCE(cs.customer_emotion_level, 0) as emotion_level,
            COUNT(DISTINCT ac.conversation_id)::int as count
          FROM active_conversations ac
          LEFT JOIN conversations_summary cs ON ac.conversation_id = cs.conversation_id
          GROUP BY COALESCE(cs.customer_emotion_level, 0)
          ORDER BY emotion_level
        ),
        conversations_with_problems AS (
          SELECT 
            ac.conversation_id,
            cs.objective_problems
          FROM active_conversations ac
          INNER JOIN conversations_summary cs ON ac.conversation_id = cs.conversation_id
          WHERE cs.objective_problems IS NOT NULL
            AND jsonb_typeof(cs.objective_problems::jsonb) = 'array'
            AND jsonb_array_length(cs.objective_problems::jsonb) > 0
        ),
        problems_agg AS (
          SELECT 
            problem_obj->>'name' as problem_name,
            COUNT(DISTINCT cwp.conversation_id)::int as count
          FROM conversations_with_problems cwp
          CROSS JOIN LATERAL jsonb_array_elements(cwp.objective_problems::jsonb) AS problem_obj
          GROUP BY problem_obj->>'name'
          ORDER BY count DESC
        ),
        problems_total AS (
          SELECT COUNT(DISTINCT conversation_id)::int as total FROM conversations_with_problems
        ),
        users_agg AS (
          SELECT 
            COUNT(DISTINCT ac.conversation_id)::int as total,
            COUNT(DISTINCT ac.conversation_id) FILTER (WHERE u.authenticated = true)::int as authenticated
          FROM active_conversations ac
          LEFT JOIN users u ON ac.conv_user_id = u.sunshine_id
        )
        SELECT 
          (SELECT json_agg(json_build_object('product', product, 'count', count, 'subproducts', subproducts)) FROM products_agg) as products_json,
          (SELECT json_agg(json_build_object('emotionLevel', emotion_level, 'count', count)) FROM emotions_agg) as emotions_json,
          (SELECT json_agg(json_build_object('problemName', problem_name, 'count', count)) FROM problems_agg) as problems_json,
          (SELECT total FROM problems_total) as problems_total,
          (SELECT total FROM users_agg) as users_total,
          (SELECT authenticated FROM users_agg) as users_authenticated
      `),
      
      db.execute<{ hourly_json: string }>(sql`
        WITH tz AS (
          SELECT ${timezone}::text AS name
        ),
        now_local AS (
          SELECT NOW() AT TIME ZONE (SELECT name FROM tz) AS ts
        ),
        current_hour AS (
          SELECT EXTRACT(HOUR FROM (SELECT ts FROM now_local))::int AS hour
        ),
        today_start AS (
          SELECT DATE_TRUNC('day', (SELECT ts FROM now_local)) AS ts
        ),
        today_end AS (
          SELECT (SELECT ts FROM today_start) + INTERVAL '1 day' AS ts
        ),
        last_week_start AS (
          SELECT (SELECT ts FROM today_start) - INTERVAL '7 days' AS ts
        ),
        last_week_end AS (
          SELECT (SELECT ts FROM today_start) - INTERVAL '6 days' AS ts
        ),
        hours_series AS (
          SELECT generate_series(0, 23) AS hour
        ),
        today_conversation_msg_counts AS (
          SELECT conversation_id, COUNT(*)::int as msg_count
          FROM events_standard
          WHERE event_type = 'message'
            AND ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM today_start)
            AND ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM today_end)
          GROUP BY conversation_id
          HAVING COUNT(*) > ${minMessages}
        ),
        today_data AS (
          SELECT 
            EXTRACT(HOUR FROM (e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz))::int AS hour,
            COUNT(DISTINCT c.id) AS count
          FROM events_standard e
          INNER JOIN conversations c ON e.conversation_id = c.id
          INNER JOIN today_conversation_msg_counts tcmc ON c.id = tcmc.conversation_id
          WHERE e.event_type = 'message'
            AND ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM today_start)
            AND ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM today_end)
          GROUP BY 1
        ),
        last_week_conversation_msg_counts AS (
          SELECT conversation_id, COUNT(*)::int as msg_count
          FROM events_standard
          WHERE event_type = 'message'
            AND ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM last_week_start)
            AND ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM last_week_end)
          GROUP BY conversation_id
          HAVING COUNT(*) > ${minMessages}
        ),
        last_week_data AS (
          SELECT 
            EXTRACT(HOUR FROM (e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz))::int AS hour,
            COUNT(DISTINCT c.id) AS count
          FROM events_standard e
          INNER JOIN conversations c ON e.conversation_id = c.id
          INNER JOIN last_week_conversation_msg_counts lwcmc ON c.id = lwcmc.conversation_id
          WHERE e.event_type = 'message'
            AND ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) >= (SELECT ts FROM last_week_start)
            AND ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE (SELECT name FROM tz)) < (SELECT ts FROM last_week_end)
          GROUP BY 1
        ),
        hourly_agg AS (
          SELECT 
            hs.hour,
            (hs.hour = (SELECT hour FROM current_hour)) AS is_current_hour,
            (hs.hour <= (SELECT hour FROM current_hour)) AS is_past,
            COALESCE(td.count, 0)::int AS today_count,
            COALESCE(lw.count, 0)::int AS last_week_count
          FROM hours_series hs
          LEFT JOIN today_data td ON hs.hour = td.hour
          LEFT JOIN last_week_data lw ON hs.hour = lw.hour
          ORDER BY hs.hour
        )
        SELECT json_agg(json_build_object('hour', hour, 'isCurrentHour', is_current_hour, 'isPast', is_past, 'todayCount', today_count, 'lastWeekCount', last_week_count) ORDER BY hour) as hourly_json FROM hourly_agg
      `)
    ]);

    const mainRow = mainResult.rows[0];
    const hourlyRow = hourlyResult.rows[0];
    
    const products: ProductItem[] = parseJsonSafe<ProductItem>(mainRow?.products_json);
    const emotions: EmotionItem[] = parseJsonSafe<EmotionItem>(mainRow?.emotions_json);
    const problems: ProblemItem[] = parseJsonSafe<ProblemItem>(mainRow?.problems_json);
    const hourly: HourlyItem[] = parseJsonSafe<HourlyItem>(hourlyRow?.hourly_json);
    
    const productsTotal = products.reduce((sum, p) => sum + p.count, 0);
    const emotionsTotal = emotions.reduce((sum, e) => sum + e.count, 0);
    const usersTotal = mainRow?.users_total || 0;
    const usersAuthenticated = mainRow?.users_authenticated || 0;

    return {
      products: { items: products, total: productsTotal },
      emotions: { items: emotions, total: emotionsTotal },
      problems: { items: problems, total: mainRow?.problems_total || 0 },
      users: { 
        total: usersTotal, 
        authenticated: usersAuthenticated, 
        anonymous: usersTotal - usersAuthenticated 
      },
      hourly,
    };
  },
};
