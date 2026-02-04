import db from "../config/database";

function createUsersTable() {
  try {
    console.log("Création de la table users...");

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
      );
    `);

    console.log("✅ Table users créée avec succès");

    // Create index on email for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    console.log("✅ Index sur email créé");

    // Check if user_id column exists in applications table
    const tableInfo = db.prepare("PRAGMA table_info(applications)").all() as any[];
    const hasUserIdColumn = tableInfo.some((col: any) => col.name === "user_id");

    if (!hasUserIdColumn) {
      // Add user_id column to applications table
      db.exec(`
        ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
      `);

      console.log("✅ Colonne user_id ajoutée à la table applications");
    } else {
      console.log("ℹ️ Colonne user_id existe déjà");
    }

  } catch (error) {
    console.error("❌ Erreur lors de la création de la table:", error);
    throw error;
  } finally {
    db.close();
  }
}

createUsersTable();
