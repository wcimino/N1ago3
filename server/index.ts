import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth } from "./replitAuth.js";
import { registerRoutes } from "./routes/index.js";
import { startPollingWorker } from "./features/sync/services/pollingWorker.js";
import "./features/events/services/eventProcessor.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 5000 : 3000);

// Track initialization status
let isInitialized = false;
let initError: Error | null = null;

// Health check endpoint - MUST be first to respond to deployment health checks
app.get("/health", (req, res) => {
  if (initError) {
    res.status(503).json({ status: "error", error: initError.message });
  } else if (!isInitialized) {
    res.status(200).json({ status: "starting", timestamp: new Date().toISOString() });
  } else {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  }
});

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

async function initializeApp() {
  try {
    console.log("Initializing app...");
    
    // Setup authentication
    await setupAuth(app);
    console.log("Auth setup complete");

    // Register routes
    registerRoutes(app);
    console.log("Routes registered");

    if (process.env.NODE_ENV === "production") {
      app.use(express.static(path.join(__dirname, "../public")));
      // Only handle non-API routes with the catch-all
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/webhook") || req.path === "/health") {
          return next();
        }
        res.sendFile(path.join(__dirname, "../public/index.html"));
      });
      console.log("Static files configured");
    }

    startPollingWorker();
    console.log("Polling worker started");
    
    isInitialized = true;
    console.log("App initialization complete");
  } catch (error) {
    console.error("App initialization failed:", error);
    initError = error as Error;
  }
}

// Start server immediately, then initialize async
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
  // Initialize app after server is listening
  initializeApp();
});

server.on("error", (error) => {
  console.error("Server error:", error);
  process.exit(1);
});
