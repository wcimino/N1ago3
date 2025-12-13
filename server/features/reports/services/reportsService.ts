import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { PeriodFilter, getPeriodDateFilter } from "../utils/dateFilter.js";

export interface ProductProblemCount {
  product: string;
  subproduct: string | null;
  problem: string;
  count: number;
}

export interface CustomerConversationCount {
  customerName: string;
  conversationCount: number;
}

export const reportsService = {
  async getProductProblemCounts(period: PeriodFilter): Promise<ProductProblemCount[]> {
    const dateFilter = getPeriodDateFilter(period, "cs");

    const results = await db.execute(sql.raw(`
      WITH problem_data AS (
        SELECT 
          COALESCE(cs.product_standard, cs.product, 'Não identificado') as product,
          cs.subproduct,
          jsonb_array_elements(cs.objective_problems::jsonb) as problem
        FROM conversations_summary cs
        WHERE cs.objective_problems IS NOT NULL 
          AND cs.objective_problems::text != '[]'
          AND cs.objective_problems::text != 'null'
          ${dateFilter}
      )
      SELECT 
        product,
        subproduct,
        problem->>'name' as problem_name,
        COUNT(*) as count
      FROM problem_data
      GROUP BY product, subproduct, problem->>'name'
      ORDER BY count DESC, product, subproduct, problem_name
    `));

    return results.rows.map((row: any) => ({
      product: row.product || "Não identificado",
      subproduct: row.subproduct || null,
      problem: row.problem_name || "Não identificado",
      count: parseInt(row.count, 10),
    }));
  },

  async getCustomerConversationCounts(period: PeriodFilter): Promise<CustomerConversationCount[]> {
    const dateFilter = getPeriodDateFilter(period, "c");

    const results = await db.execute(sql.raw(`
      SELECT 
        COALESCE(
          NULLIF(TRIM(CONCAT(
            COALESCE(u.profile->>'givenName', ''),
            ' ',
            COALESCE(u.profile->>'surname', '')
          )), ''),
          u.profile->>'email',
          u.external_id,
          'Cliente não identificado'
        ) as customer_name,
        COUNT(DISTINCT c.id) as conversation_count
      FROM conversations c
      LEFT JOIN users u ON c.user_external_id = u.external_id
      WHERE 1=1 ${dateFilter}
      GROUP BY 
        u.profile->>'givenName',
        u.profile->>'surname',
        u.profile->>'email',
        u.external_id
      ORDER BY conversation_count DESC
    `));

    return results.rows.map((row: any) => ({
      customerName: row.customer_name?.trim() || "Cliente não identificado",
      conversationCount: parseInt(row.conversation_count, 10),
    }));
  },
};
