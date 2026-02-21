import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
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

// Limite email : 3 envois par heure par IP (évite le spam d'emails)
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop d'envois. Réessayez dans une heure." },
});
app.use("/api/auth/forgot-password", emailLimiter);
app.use("/api/auth/resend-verification", emailLimiter);

// ============================================
// CORS
// ============================================
const corsOptions = {
  origin: [
    "https://www.relance-work.fr",
    "https://www.relancework-production.up.railway.app",
  ],
  credentials: true,
};

app.options(/(.*)/, cors(corsOptions));
app.use(cors(corsOptions));

// ============================================
// MIDDLEWARE
// ============================================
// Raw body for Stripe webhook signature verification (must be BEFORE express.json)
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
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
