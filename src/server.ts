import "dotenv/config";
import app from "./app";
import db from "./config/database";
import { startAutoRelanceService } from "./services/autoRelanceService";
import { gmailMultiUserService } from "./services/gmailMultiUserService";

const PORT = process.env.PORT || 3000;

// Auto-create tables if they don't exist (for fresh deploys)
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      poste TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      relanced INTEGER DEFAULT 0,
      email TEXT,
      userEmail TEXT,
      relance_count INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      business_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, place_id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_place_id ON favorites(place_id);`);
}

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);

  try {
    initDatabase();
    console.log("✅ Database connected & tables ready");
    console.log(`📁 Database location: ${db.name}`);

    startAutoRelanceService();
    gmailMultiUserService.resumeActiveTracking();
  } catch (err) {
    console.error("❌ Database error:", (err as Error).message);
  }
});
