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

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  // Health check endpoint (before auth setup to ensure it responds quickly)
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Setup authentication
  await setupAuth(app);

  // Register routes
  registerRoutes(app);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../public")));
    // Only handle non-API routes with the catch-all
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/webhook") || req.path === "/health") {
        return next();
      }
      res.sendFile(path.join(__dirname, "../public/index.html"));
    });
  }

  startPollingWorker();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
