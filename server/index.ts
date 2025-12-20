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

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - registered immediately for autoscale deployments
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

async function startServer() {
  // Setup authentication
  await setupAuth(app);

  // Register routes
  registerRoutes(app);

  if (process.env.NODE_ENV === "production") {
    // In production, dist/server.js runs from dist/, so public is at dist/public
    // Use process.cwd() as fallback for bundled environments where __dirname may not resolve correctly
    const publicPath = path.join(process.cwd(), "dist", "public");
    app.use(express.static(publicPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
    
    if (process.env.DISABLE_SCHEDULERS === "true") {
      console.log("[Schedulers] Disabled via DISABLE_SCHEDULERS env var");
    } else {
      console.log("[Schedulers] Starting background workers...");
      startPollingWorker();
      vacuumService.start();
      archiveService.start();
    }
  });
}

startServer().catch(console.error);
