import { db } from "../server/db.js";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function ensureManualMigrationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __manual_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getAppliedManualMigrations(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT name FROM __manual_migrations ORDER BY id
  `);
  return new Set(result.rows.map((r: any) => r.name));
}

async function applyManualMigration(name: string, sqlContent: string) {
  console.log(`  Applying manual migration: ${name}`);
  
  try {
    await db.execute(sql`BEGIN`);
    
    const statements = sqlContent
      .split(/;[\s]*$|;[\s]*\n/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(sql.raw(statement));
      }
    }
    
    await db.execute(sql`
      INSERT INTO __manual_migrations (name) VALUES (${name})
    `);
    
    await db.execute(sql`COMMIT`);
    console.log(`  ✅ Successfully applied: ${name}`);
  } catch (error: any) {
    console.error(`  ❌ Failed to apply ${name}: ${error.message}`);
    try {
      await db.execute(sql`ROLLBACK`);
      console.log(`  ↩️ Rolled back changes for: ${name}`);
    } catch (rollbackError: any) {
      console.error(`  ⚠️ Rollback failed: ${rollbackError.message}`);
    }
    throw error;
  }
}

async function runManualMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  
  if (!fs.existsSync(migrationsDir)) {
    console.log("No manual migrations directory found, skipping...");
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    console.log("No manual migrations to run");
    return;
  }

  await ensureManualMigrationsTable();
  const appliedMigrations = await getAppliedManualMigrations();

  const pendingMigrations = migrationFiles.filter((f) => !appliedMigrations.has(f));

  if (pendingMigrations.length === 0) {
    console.log("All manual migrations already applied");
    return;
  }

  console.log(`Running ${pendingMigrations.length} manual migration(s)...`);
  console.log("⚠️  Note: Manual migrations should be idempotent (use IF NOT EXISTS, IF EXISTS, etc.)\n");

  for (const file of pendingMigrations) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, "utf-8");
    await applyManualMigration(file, sqlContent);
  }

  console.log("\nManual migrations completed");
}

async function runMigrations() {
  console.log("🚀 Running database migrations...\n");
  
  try {
    console.log("Step 1: Running Drizzle migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Drizzle migrations completed successfully\n");
    
    console.log("Step 2: Running manual migrations...");
    await runManualMigrations();
    console.log("\n🎉 All migrations completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Migration error:", error.message);
    console.error("\n💡 Recovery steps:");
    console.error("   1. Check which migrations were applied in __drizzle_migrations and __manual_migrations");
    console.error("   2. Fix the failing migration file");
    console.error("   3. Re-run npm run db:migrate");
    process.exit(1);
  }
  
  process.exit(0);
}

runMigrations();
