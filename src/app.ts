import express, { Request, Response, NextFunction } from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import applicationRoutes from "./routes/applicationRoutes";
import gmailRoutes from "./routes/gmailRoutes";
import gmailMultiUserRoutes from "./routes/gmailMultiUserRoutes";
import emailEnrichmentRoutes from "./routes/emailEnrichmentRoutes";
import companyEnrichmentRoutes from "./routes/companyEnrichmentRoutes";
import billingRoutes from "./routes/billingRoutes";
import searchRoutes from "./routes/searchRoutes";
import authRoutes from "./routes/authRoutes";
import favoritesRoutes from "./routes/favoritesRoutes";

const app = express();

// Trust reverse proxy (Railway, Render, etc.) for correct IP detection
app.set("trust proxy", 1);

// ============================================
// SECURITY - Helmet (headers de sécurité)
// ============================================
app.use(
  helmet({
    contentSecurityPolicy: false, // Désactivé pour permettre les scripts inline (Google Maps, etc.)
    crossOriginEmbedderPolicy: false, // Nécessaire pour charger Google Maps
  })
);

// ============================================
// RATE LIMITING
// ============================================
// Limite globale : 100 requêtes par minute par IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez dans une minute." },
});
app.use("/api/", globalLimiter);

// Limite stricte pour l'authentification : 10 tentatives par 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

// ============================================
// CORS
// ============================================
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Requêtes sans origin (same-origin, curl, etc.) - autorisées
    res.header("Access-Control-Allow-Origin", "*");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  // Permettre l'accès depuis des adresses privées (extension Chrome vers localhost)
  if (req.headers["access-control-request-private-network"]) {
    res.header("Access-Control-Allow-Private-Network", "true");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ============================================
// ROUTES API
// ============================================
app.use("/api/auth", authRoutes);
app.use("/api", applicationRoutes);
app.use("/api", favoritesRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/gmail-user", gmailMultiUserRoutes);
app.use("/api/email-enrichment", emailEnrichmentRoutes);
app.use("/api/company-enrichment", companyEnrichmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/search", searchRoutes);

// ============================================
// STATIC FILES
// ============================================
const clientPath = path.join(__dirname, "../client/dist");
app.use("/app", express.static(clientPath));
app.use("/app", (_req: Request, res: Response) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// Fallback SPA
app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/app")) {
    res.sendFile(path.join(clientPath, "index.html"));
  } else {
    res.sendFile(path.join(publicPath, "index.html"));
  }
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Erreur interne du serveur"
      : err.message;

  res.status(status).json({ error: message });
});

export default app;
