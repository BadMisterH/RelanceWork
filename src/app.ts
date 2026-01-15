import express, { Request, Response } from "express";
import path from "path";
import applicationRoutes from "./routes/applicationRoutes";

const app = express();

// CORS - Autoriser Vite (port 5173) et l'extension Chrome à communiquer avec l'API
app.use((req, res, next) => {
  // Autoriser tous les origins pour simplifier (développement local)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  // IMPORTANT : Permettre l'accès depuis des adresses privées (localhost depuis Gmail/extension)
  // Chrome nécessite ce header pour permettre les requêtes depuis un contexte public (Gmail) vers localhost
  if (req.headers['access-control-request-private-network']) {
    res.header("Access-Control-Allow-Private-Network", "true");
  }

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Middleware
app.use(express.json());

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Routes API
app.use("/api", applicationRoutes);

export default app;
