import db from '../config/database';

function addRelanceCountColumn() {
  try {
    // Ajouter la colonne 'relance_count' pour compter le nombre de relances envoyées
    const query = `
      ALTER TABLE applications
      ADD COLUMN relance_count INTEGER DEFAULT 0;
    `;

    db.exec(query);
    console.log('Column "relance_count" added successfully');
    console.log('Default value: 0 (no relances sent yet)');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('Column "relance_count" already exists - nothing to do');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    db.close();
  }
}

addRelanceCountColumn();
