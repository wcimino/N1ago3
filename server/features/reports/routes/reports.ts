import { Router } from "express";
import { db } from "../../../db.js";
import { conversationsSummary } from "../../../../shared/schema.js";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/api/reports/product-problem-counts", async (req, res) => {
  try {
    const period = req.query.period as string || "all";
    
    let dateFilter = "";
    if (period === "1h") {
      dateFilter = "AND cs.created_at >= NOW() - INTERVAL '1 hour'";
    } else if (period === "24h") {
      dateFilter = "AND cs.created_at >= NOW() - INTERVAL '24 hours'";
    }

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

    const formattedResults = results.rows.map((row: any) => ({
      product: row.product || "Não identificado",
      subproduct: row.subproduct || null,
      problem: row.problem_name || "Não identificado",
      count: parseInt(row.count, 10),
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error("Error fetching product-problem counts:", error);
    res.status(500).json({ error: "Falha ao gerar relatório" });
  }
});

export default router;
