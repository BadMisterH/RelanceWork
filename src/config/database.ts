import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database file path - defaults to ./data/relancework.sqlite
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "relancework.sqlite");

// Create data directory if it doesn't exist
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: Database.Database = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

export default db;
