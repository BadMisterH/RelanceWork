import express, { Request, Response } from "express";
import path from "path";
import applicationRoutes from "./routes/applicationRoutes";
import gmailRoutes from "./routes/gmailRoutes";
import gmailMultiUserRoutes from "./routes/gmailMultiUserRoutes";
import emailEnrichmentRoutes from "./routes/emailEnrichmentRoutes";
import companyEnrichmentRoutes from "./routes/companyEnrichmentRoutes";
import billingRoutes from "./routes/billingRoutes";
import searchRoutes from "./routes/searchRoutes";
import authRoutes from "./routes/authRoutes";

const app = express();

// CORS - Autoriser Vite (port 5173) et l'extension Chrome à communiquer avec l'API
app.use((req, res, next) => {
  // Autoriser tous les origins pour simplifier (développement local)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  // ✅ AJOUT du header Authorization pour l'authentification Supabase
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api", applicationRoutes);
app.use("/api/gmail", gmailRoutes); // Ancien système (global)
app.use("/api/gmail-user", gmailMultiUserRoutes); // ✅ Nouveau système (multi-user)
app.use("/api/email-enrichment", emailEnrichmentRoutes);
app.use("/api/company-enrichment", companyEnrichmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/search", searchRoutes);

// Servir l'application client à /app
const clientPath = path.join(__dirname, "../client/dist");
app.use("/app", express.static(clientPath));
app.use("/app", (_req: Request, res: Response) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// Servir la landing page à la racine
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// Fallback pour toutes les autres routes (SPA)
app.use((req: Request, res: Response) => {
  // Si la route commence par /app, servir l'application client
  if (req.path.startsWith('/app')) {
    res.sendFile(path.join(clientPath, "index.html"));
  } else {
    // Sinon, servir la landing page
    res.sendFile(path.join(publicPath, "index.html"));
  }
});

export default app;
