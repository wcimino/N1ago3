import express from "express";
import { setupAuth } from "./features/auth/index.js";
import { registerRoutes } from "./routes/index.js";
import { bootstrap, getBootstrapHealth } from "./bootstrap/index.js";
import "./features/events/services/eventProcessor.js";

const app = express();
const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 5000 : 3000);

let serverReady = false;
let initializationError: Error | null = null;

const STARTUP_TIMEOUT_MS = 30000;

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    ready: serverReady,
    error: initializationError?.message || null,
    timestamp: new Date().toISOString() 
  });
});

app.get("/ready", (req, res) => {
  const bootstrapHealth = serverReady ? getBootstrapHealth() : null;
  
  if (serverReady) {
    res.status(200).json({ 
      ready: true, 
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
        console.log("[Startup] Initializing authentication...");
        await setupAuth(app);
        console.log("[Startup] Authentication ready");

        console.log("[Startup] Registering routes...");
        registerRoutes(app);
        console.log("[Startup] Routes registered");

        bootstrap(app, {
          isProduction: process.env.NODE_ENV === "production",
          enableSchedulers: process.env.DISABLE_SCHEDULERS !== "true",
        });

        serverReady = true;
        const elapsed = Date.now() - startTime;
        console.log(`[Startup] Server fully initialized and ready in ${elapsed}ms`);
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
