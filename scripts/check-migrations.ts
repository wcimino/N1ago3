import { db } from "../server/db.js";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

interface MigrationRecord {
  id: number;
  hash: string;
  created_at: string;
}

async function checkMigrations() {
  console.log("🔍 Checking migration status...\n");

  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  const drizzleDir = path.join(process.cwd(), "drizzle");
  const manualMigrationsDir = path.join(process.cwd(), "migrations");

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  console.log(`📋 Journal has ${journal.entries.length} migrations registered\n`);

  const sqlFiles = fs.readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
  console.log(`📁 Found ${sqlFiles.length} SQL files in drizzle/\n`);

  const snapshotDir = path.join(drizzleDir, "meta");
  const snapshots = fs.readdirSync(snapshotDir).filter((f) => f.endsWith("_snapshot.json"));
  console.log(`📸 Found ${snapshots.length} snapshot files\n`);

  console.log("--- Migration Files vs Journal Check ---\n");
  
  const journalTags = new Set(journal.entries.map((e) => e.tag));
  const missingInJournal: string[] = [];
  const duplicateIndices: string[] = [];
  const indexMap = new Map<string, string[]>();

  for (const sqlFile of sqlFiles) {
    const baseName = sqlFile.replace(".sql", "");
    const index = baseName.split("_")[0];
    
    if (!indexMap.has(index)) {
      indexMap.set(index, []);
    }
    indexMap.get(index)!.push(sqlFile);

    if (!journalTags.has(baseName)) {
      missingInJournal.push(sqlFile);
    }
  }

  for (const [index, files] of indexMap) {
    if (files.length > 1) {
      duplicateIndices.push(`Index ${index}: ${files.join(", ")}`);
    }
  }

  if (missingInJournal.length > 0) {
    console.log("⚠️  SQL files NOT in journal (may not be applied):");
    missingInJournal.forEach((f) => console.log(`   - ${f}`));
    console.log("");
  }

  if (duplicateIndices.length > 0) {
    console.log("⚠️  Duplicate migration indices found:");
    duplicateIndices.forEach((d) => console.log(`   - ${d}`));
    console.log("");
  }

  console.log("--- Snapshot Chain Check ---\n");

  const snapshotIds = new Map<string, { id: string; prevId: string; file: string }>();
  
  for (const snapshot of snapshots) {
    const content = JSON.parse(fs.readFileSync(path.join(snapshotDir, snapshot), "utf-8"));
    snapshotIds.set(snapshot, { id: content.id, prevId: content.prevId, file: snapshot });
  }

  let brokenChain = false;
  const sortedSnapshots = [...snapshotIds.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  
  for (let i = 1; i < sortedSnapshots.length; i++) {
    const current = sortedSnapshots[i][1];
    const previous = sortedSnapshots[i - 1][1];
    
    if (current.prevId !== previous.id) {
      console.log(`⚠️  Broken chain: ${current.file} expects prevId ${current.prevId} but ${previous.file} has id ${previous.id}`);
      brokenChain = true;
    }
  }

  if (!brokenChain) {
    console.log("✅ Snapshot chain is intact\n");
  }

  console.log("--- Manual Migrations Check ---\n");

  if (fs.existsSync(manualMigrationsDir)) {
    const manualMigrations = fs.readdirSync(manualMigrationsDir).filter((f) => f.endsWith(".sql"));
    if (manualMigrations.length > 0) {
      console.log(`⚠️  Found ${manualMigrations.length} manual migrations in migrations/ (not managed by Drizzle):`);
      manualMigrations.forEach((f) => console.log(`   - ${f}`));
      console.log("   These need to be applied separately or integrated into Drizzle migrations.\n");
    }
  }

  console.log("--- Database Check ---\n");

  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as exists
    `);
    
    const exists = result.rows[0]?.exists;
    
    if (exists) {
      const migrations = await db.execute(sql`
        SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id
      `);
      console.log(`✅ Found ${migrations.rows.length} applied migrations in database\n`);
      
      const appliedHashes = new Set(migrations.rows.map((r: any) => r.hash));
      const pendingMigrations = journal.entries.filter((e) => !appliedHashes.has(e.tag));
      
      if (pendingMigrations.length > 0) {
        console.log(`⚠️  ${pendingMigrations.length} migrations pending:`);
        pendingMigrations.forEach((m) => console.log(`   - ${m.tag}`));
        console.log("");
      } else {
        console.log("✅ All migrations applied\n");
      }
    } else {
      console.log("⚠️  Table __drizzle_migrations not found - migrations may have been applied via db:push\n");
      console.log("   To use proper migrations, run: npm run db:migrate\n");
    }
  } catch (error: any) {
    console.log(`❌ Database check failed: ${error.message}\n`);
  }

  console.log("--- Summary ---\n");
  
  const issues: string[] = [];
  if (missingInJournal.length > 0) issues.push(`${missingInJournal.length} SQL files not in journal`);
  if (duplicateIndices.length > 0) issues.push(`${duplicateIndices.length} duplicate migration indices`);
  if (brokenChain) issues.push("Snapshot chain is broken");
  
  if (issues.length > 0) {
    console.log("❌ Issues found:");
    issues.forEach((i) => console.log(`   - ${i}`));
    console.log("\n💡 Run 'npm run db:generate' to regenerate migrations from schema");
    process.exit(1);
  } else {
    console.log("✅ All migration checks passed!\n");
  }

  process.exit(0);
}

checkMigrations().catch((error) => {
  console.error("Migration check failed:", error);
  process.exit(1);
});
