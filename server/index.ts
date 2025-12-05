import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth } from "./replitAuth";
import { registerRoutes } from "./routes";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

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
  // Setup authentication
  await setupAuth(app);

  // Register routes
  registerRoutes(app);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../public")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../public/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
