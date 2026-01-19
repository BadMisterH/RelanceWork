import app from "./app";
import db from "./config/database";
import { startAutoRelanceService } from "./services/autoRelanceService";

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);

  // Tester la connexion DB
  try {
    db.prepare("SELECT 1").get();
    console.log("✅ Database connected");
    console.log(`📁 Database location: ${db.name}`);

    // Démarrer le service de vérification automatique des relances
    startAutoRelanceService();
  } catch (err) {
    console.error("❌ Database connection error:", (err as Error).message);
  }
});
