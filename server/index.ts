import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

app.use(express.json({
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use(router);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../public")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.redirect("http://localhost:5173");
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor N1ago iniciado em http://0.0.0.0:${PORT}`);
});
