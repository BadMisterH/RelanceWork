import db from '../config/database';

function addRelancedColumn() {
  try {
    // Ajouter la colonne 'relanced' avec une valeur par défaut à false (0 en SQLite)
    const query = `
      ALTER TABLE applications
      ADD COLUMN relanced INTEGER DEFAULT 0;
    `;

    db.exec(query);
    console.log('Column "relanced" added successfully');
    console.log('Default value: 0 (false)');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('Column "relanced" already exists - nothing to do');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    db.close();
  }
}

addRelancedColumn();
