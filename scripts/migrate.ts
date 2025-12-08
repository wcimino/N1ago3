import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running database migrations...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products_catalog (
        id SERIAL PRIMARY KEY,
        produto TEXT NOT NULL,
        subproduto TEXT,
        categoria1 TEXT,
        categoria2 TEXT,
        full_name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ifood_products_produto ON products_catalog(produto)
    `);
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ifood_products_full_name ON products_catalog(full_name)
    `);
    
    console.log("Database migrations completed successfully");
  } catch (error: any) {
    console.error("Migration error:", error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

migrate();
