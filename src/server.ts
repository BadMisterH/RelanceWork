import "dotenv/config";
import app from "./app";
import db from "./config/database";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

  // Tester la connexion DB
  try {
    db.prepare("SELECT 1").get();
    console.log("✅ Database connected");
    console.log(`📁 Database location: ${db.name}`);

    // Démarrer le service de vérification automatique des relances
    startAutoRelanceService();

    // Reprendre le polling Gmail pour les utilisateurs avec tracking actif
    gmailMultiUserService.resumeActiveTracking();
  } catch (err) {
    console.error("❌ Database connection error:", (err as Error).message);
  }
});
