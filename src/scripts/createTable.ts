import db from '../config/database';
import fs from 'fs';
import path from 'path';

function createTable() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const query = `
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
    `;

    db.exec(query);
    console.log('Table created successfully with all columns');
    console.log(`Database location: ${db.name}`);
    console.log('Columns: id, company, poste, status, date, created_at, relanced, email, userEmail, relance_count');
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

createTable();