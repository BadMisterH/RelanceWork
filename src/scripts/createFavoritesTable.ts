import db from "../config/database";

function createFavoritesTable() {
  try {
    console.log("Création de la table favorites...");

    // Drop existing table if it exists
    db.exec(`DROP TABLE IF EXISTS favorites;`);

    // Create favorites table (sans contrainte FOREIGN KEY car users sont dans Supabase)
    db.exec(`
      CREATE TABLE favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        place_id TEXT NOT NULL,
        business_data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, place_id)
      );
    `);

    console.log("✅ Table favorites créée avec succès");

    // Create indexes for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_favorites_place_id ON favorites(place_id);
    `);

    console.log("✅ Index créés sur user_id et place_id");

  } catch (error) {
    console.error("❌ Erreur lors de la création de la table favorites:", error);
    throw error;
  } finally {
    db.close();
  }
}

createFavoritesTable();
