import db from '../config/database';

function addEmailColumn() {
  try {
    // Ajouter la colonne 'email' pour stocker l'adresse du destinataire
    const query = `
      ALTER TABLE applications
      ADD COLUMN email TEXT;
    `;

    db.exec(query);
    console.log('Column "email" added successfully');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('Column "email" already exists - nothing to do');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    db.close();
  }
}

addEmailColumn();
process.exit(0);
