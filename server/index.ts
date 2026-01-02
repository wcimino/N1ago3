import express from "express";
import { setupAuth } from "./features/auth/services/replitAuth.js";
import { registerRoutes } from "./routes/index.js";
import { bootstrap, getBootstrapHealth } from "./bootstrap/index.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import "./features/events/services/eventProcessor.js";

const app = express();
const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 5000 : 3000);

let serverReady = false;
let initializationError: Error | null = null;
let databaseHealthy: boolean | null = null;
let lastDbCheck: Date | null = null;

const STARTUP_TIMEOUT_MS = 30000;
const DB_HEALTH_CHECK_INTERVAL_MS = 30000;

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("[Health] Database check failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

async function updateDatabaseHealth() {
  const now = new Date();
  if (lastDbCheck && now.getTime() - lastDbCheck.getTime() < DB_HEALTH_CHECK_INTERVAL_MS) {
    return;
  }
  databaseHealthy = await checkDatabaseHealth();
  lastDbCheck = now;
}

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (req, res) => {
  await updateDatabaseHealth();
  
  res.status(200).json({ 
    status: "ok", 
    ready: serverReady,
    database: databaseHealthy,
    error: initializationError?.message || null,
    timestamp: new Date().toISOString() 
  });
});

app.get("/ready", async (req, res) => {
  const bootstrapHealth = serverReady ? getBootstrapHealth() : null;
  
  if (serverReady) {
    await updateDatabaseHealth();
    
    res.status(200).json({ 
      ready: true, 
      database: databaseHealthy,
      timestamp: new Date().toISOString(),
      schedulers: bootstrapHealth?.schedulerStatus || null,
      preflight: bootstrapHealth?.preflight ? {
        canRunSchedulers: bootstrapHealth.preflight.canRunSchedulers,
        warnings: bootstrapHealth.preflight.warnings,
        errors: bootstrapHealth.preflight.errors,
      } : null,
    });
  } else {
    res.status(503).json({ 
      ready: false, 
      error: initializationError?.message || "Server initializing",
      timestamp: new Date().toISOString() 
    });
  }
});

async function initializeServices() {
  const startTime = Date.now();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Initialization timeout after ${STARTUP_TIMEOUT_MS}ms`));
    }, STARTUP_TIMEOUT_MS);
  });

  try {
    await Promise.race([
      (async () => {
        console.log("[Startup] Checking database connectivity...");
        databaseHealthy = await checkDatabaseHealth();
        lastDbCheck = new Date();
        
        if (databaseHealthy) {
          console.log("[Startup] Database connection successful");
        } else {
          console.warn("[Startup] WARNING: Database connection failed - server will start but some features may not work");
        }

        console.log("[Startup] Initializing authentication...");
        await setupAuth(app);
        console.log("[Startup] Authentication ready");

        console.log("[Startup] Registering routes...");
        registerRoutes(app);
        console.log("[Startup] Routes registered");

        await bootstrap(app, {
          isProduction: process.env.NODE_ENV === "production",
          enableSchedulers: process.env.DISABLE_SCHEDULERS !== "true" && databaseHealthy === true,
        });

        serverReady = true;
        const elapsed = Date.now() - startTime;
        console.log(`[Startup] Server fully initialized and ready in ${elapsed}ms`);
        
        if (!databaseHealthy) {
          console.warn("[Startup] Note: Server is running but database is unavailable. Background workers are disabled.");
        }
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error("[Startup] FATAL: Initialization failed:", error);
    console.error("[Startup] Exiting process due to initialization failure");
    process.exit(1);
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
  console.log("[Startup] Health check available, initializing services...");
  initializeServices();
});
