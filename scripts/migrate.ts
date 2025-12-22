import { db, pool } from "../server/db.js";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const MIGRATION_TIMEOUT_MS = 60000;

async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

async function testConnection(): Promise<boolean> {
  try {
    console.log("Testing database connection...");
    const result = await withTimeout(
      db.execute(sql`SELECT 1 as test`),
      10000,
      "Database connection test"
    );
    console.log("✅ Database connection successful");
    return true;
  } catch (error: any) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

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
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const statements = sqlContent
      .split(/;[\s]*$|;[\s]*\n/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await client.query(statement);
      }
    }
    
    await client.query(
      'INSERT INTO __manual_migrations (name) VALUES ($1)',
      [name]
    );
    
    await client.query('COMMIT');
    console.log(`  ✅ Successfully applied: ${name}`);
  } catch (error: any) {
    console.error(`  ❌ Failed to apply ${name}: ${error.message}`);
    try {
      await client.query('ROLLBACK');
      console.log(`  ↩️ Rolled back changes for: ${name}`);
    } catch (rollbackError: any) {
      console.error(`  ⚠️ Rollback failed: ${rollbackError.message}`);
    }
    throw error;
  } finally {
    client.release();
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
  
  const connected = await testConnection();
  if (!connected) {
    console.error("\n❌ Cannot proceed without database connection");
    process.exit(1);
  }
  
  try {
    console.log("\nStep 1: Running Drizzle migrations...");
    await withTimeout(
      migrate(db, { migrationsFolder: "./drizzle" }),
      MIGRATION_TIMEOUT_MS,
      "Drizzle migrations"
    );
    console.log("✅ Drizzle migrations completed successfully\n");
    
    console.log("Step 2: Running manual migrations...");
    await withTimeout(
      runManualMigrations(),
      MIGRATION_TIMEOUT_MS,
      "Manual migrations"
    );
    console.log("\n🎉 All migrations completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Migration error:", error.message);
    
    if (error.message.includes("timed out")) {
      console.error("\n💡 Migration timeout - possible causes:");
      console.error("   1. Long-running migration (consider breaking it up)");
      console.error("   2. Database connection issues");
      console.error("   3. Lock contention on database tables");
    } else {
      console.error("\n💡 Recovery steps:");
      console.error("   1. Check which migrations were applied in __drizzle_migrations and __manual_migrations");
      console.error("   2. Fix the failing migration file");
      console.error("   3. Re-run npm run db:migrate");
    }
    
    process.exit(1);
  }
  
  try {
    await pool.end();
  } catch (e) {
  }
  
  process.exit(0);
}

runMigrations();
