import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth } from "./features/auth/index.js";
import { registerRoutes } from "./routes/index.js";
import { startPollingWorker } from "./features/sync/services/pollingWorker.js";
import "./features/events/services/eventProcessor.js";
import { vacuumService, archiveService } from "./features/maintenance/services/index.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 5000 : 3000);

// Track server readiness
let serverReady = false;
let initializationError: Error | null = null;

// Startup timeout - fail fast if initialization takes too long (30 seconds)
const STARTUP_TIMEOUT_MS = 30000;

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - returns 200 for autoscale provisioning
// Autoscale needs this to respond quickly to consider instance healthy
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    ready: serverReady,
    error: initializationError?.message || null,
    timestamp: new Date().toISOString() 
  });
});

// Readiness check - returns 503 until server is fully ready
// Use this for load balancer readiness probes
app.get("/ready", (req, res) => {
  if (serverReady) {
    res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
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
  
  // Setup timeout to fail fast
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

        if (process.env.NODE_ENV === "production") {
          const publicPath = path.join(process.cwd(), "dist", "public");
          app.use(express.static(publicPath));
          app.get("*", (req, res) => {
            res.sendFile(path.join(publicPath, "index.html"));
          });
          console.log("[Startup] Static files configured");
        }

        if (process.env.DISABLE_SCHEDULERS === "true") {
          console.log("[Schedulers] Disabled via DISABLE_SCHEDULERS env var");
        } else {
          console.log("[Schedulers] Starting background workers...");
          startPollingWorker();
          vacuumService.start();
          archiveService.start();
        }

        serverReady = true;
        const elapsed = Date.now() - startTime;
        console.log(`[Startup] Server fully initialized and ready in ${elapsed}ms`);
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error("[Startup] FATAL: Initialization failed:", error);
    
    // Exit process on fatal startup error so autoscale can retry with a new instance
    console.error("[Startup] Exiting process due to initialization failure");
    process.exit(1);
  }
}

// Start listening FIRST, then initialize services
// This ensures health check responds immediately for autoscale provisioning
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
  console.log("[Startup] Health check available, initializing services...");
  
  // Initialize services after server is listening
  initializeServices();
});
