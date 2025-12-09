import { db } from "../server/db.js";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function runMigrations() {
  console.log("Running database migrations...");
  
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Database migrations completed successfully");
  } catch (error: any) {
    console.error("Migration error:", error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigrations();
