import { db } from "../../../db.js";
import { sql } from "drizzle-orm";
import { PeriodFilter, getPeriodDateFilter } from "../utils/dateFilter.js";

export interface ProductProblemCount {
  product: string;
  subproduct: string | null;
  problem: string;
  count: number;
}

export interface SubproductNode {
  subproduct: string;
  count: number;
}

export interface ProductNode {
  product: string;
  count: number;
  subproducts: SubproductNode[];
}

export interface ProblemNode {
  problem: string;
  count: number;
  products: ProductNode[];
}

export interface HierarchicalProblemData {
  problems: ProblemNode[];
  total: number;
}

export interface CustomerConversationCount {
  customerName: string;
  conversationCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export const reportsService = {
  async getProductProblemCounts(
    period: PeriodFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductProblemCount>> {
    const dateFilter = getPeriodDateFilter(period, "cs");
    const { limit, offset } = pagination;

    const countResult = await db.execute(sql.raw(`
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
      SELECT COUNT(*) as total FROM (
        SELECT product, subproduct, problem->>'name' as problem_name
        FROM problem_data
        GROUP BY product, subproduct, problem->>'name'
      ) subq
    `));

    const total = parseInt((countResult.rows[0] as any)?.total || "0", 10);

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
      LIMIT ${limit} OFFSET ${offset}
    `));

    const data = results.rows.map((row: any) => ({
      product: row.product || "Não identificado",
      subproduct: row.subproduct || null,
      problem: row.problem_name || "Não identificado",
      count: parseInt(row.count, 10),
    }));

    return { data, total };
  },

  async getCustomerConversationCounts(
    period: PeriodFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CustomerConversationCount>> {
    const dateFilter = getPeriodDateFilter(period, "c");
    const { limit, offset } = pagination;

    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as total FROM (
        SELECT c.user_id
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.sunshine_id
        WHERE c.user_id IS NOT NULL ${dateFilter}
        GROUP BY c.user_id
      ) subq
    `));

    const total = parseInt((countResult.rows[0] as any)?.total || "0", 10);

    const results = await db.execute(sql.raw(`
      SELECT 
        COALESCE(
          NULLIF(TRIM(CONCAT(
            COALESCE(u.profile->>'givenName', ''),
            ' ',
            COALESCE(u.profile->>'surname', '')
          )), ''),
          u.profile->>'email',
          c.user_id
        ) as customer_name,
        COUNT(DISTINCT c.id) as conversation_count
      FROM conversations c
      LEFT JOIN users u ON c.user_id = u.sunshine_id
      WHERE c.user_id IS NOT NULL ${dateFilter}
      GROUP BY 
        c.user_id,
        u.profile->>'givenName',
        u.profile->>'surname',
        u.profile->>'email'
      ORDER BY conversation_count DESC
      LIMIT ${limit} OFFSET ${offset}
    `));

    const data = results.rows.map((row: any) => ({
      customerName: row.customer_name?.trim() || "Cliente não identificado",
      conversationCount: parseInt(row.conversation_count, 10),
    }));

    return { data, total };
  },

  async getHierarchicalProblemData(
    period: PeriodFilter
  ): Promise<HierarchicalProblemData> {
    const dateFilter = getPeriodDateFilter(period, "cs");

    const results = await db.execute(sql.raw(`
      WITH problem_data AS (
        SELECT 
          COALESCE(cs.product_standard, cs.product, 'Não identificado') as product,
          COALESCE(cs.subproduct, '-') as subproduct,
          jsonb_array_elements(cs.objective_problems::jsonb)->>'name' as problem_name
        FROM conversations_summary cs
        WHERE cs.objective_problems IS NOT NULL 
          AND cs.objective_problems::text != '[]'
          AND cs.objective_problems::text != 'null'
          ${dateFilter}
      )
      SELECT 
        COALESCE(problem_name, 'Não identificado') as problem,
        product,
        subproduct,
        COUNT(*) as count
      FROM problem_data
      GROUP BY problem_name, product, subproduct
      ORDER BY problem_name, product, subproduct
    `));

    const problemMap = new Map<string, {
      count: number;
      products: Map<string, {
        count: number;
        subproducts: Map<string, number>;
      }>;
    }>();

    let total = 0;

    for (const row of results.rows as any[]) {
      const problem = row.problem || "Não identificado";
      const product = row.product || "Não identificado";
      const subproduct = row.subproduct || "-";
      const count = parseInt(row.count, 10);

      total += count;

      if (!problemMap.has(problem)) {
        problemMap.set(problem, { count: 0, products: new Map() });
      }
      const problemNode = problemMap.get(problem)!;
      problemNode.count += count;

      if (!problemNode.products.has(product)) {
        problemNode.products.set(product, { count: 0, subproducts: new Map() });
      }
      const productNode = problemNode.products.get(product)!;
      productNode.count += count;

      productNode.subproducts.set(
        subproduct,
        (productNode.subproducts.get(subproduct) || 0) + count
      );
    }

    const problems: ProblemNode[] = Array.from(problemMap.entries())
      .map(([problem, data]) => ({
        problem,
        count: data.count,
        products: Array.from(data.products.entries())
          .map(([product, prodData]) => ({
            product,
            count: prodData.count,
            subproducts: Array.from(prodData.subproducts.entries())
              .map(([subproduct, count]) => ({ subproduct, count }))
              .sort((a, b) => b.count - a.count),
          }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.count - a.count);

    return { problems, total };
  },
};
