import { pool } from "../config/database";

async function createUsersTable() {
  const client = await pool.connect();

  try {
    console.log("Création de la table users...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);

    console.log("✅ Table users créée avec succès");

    // Create index on email for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    console.log("✅ Index sur email créé");

    // Add user_id column to applications table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='applications' AND column_name='user_id'
        ) THEN
          ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
          CREATE INDEX idx_applications_user_id ON applications(user_id);
        END IF;
      END $$;
    `);

    console.log("✅ Colonne user_id ajoutée à la table applications");

  } catch (error) {
    console.error("❌ Erreur lors de la création de la table:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createUsersTable();
