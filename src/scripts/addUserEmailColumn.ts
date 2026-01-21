import db from '../config/database';

function addUserEmailColumn() {
  try {
    // Ajouter la colonne 'userEmail' pour stocker l'email de l'utilisateur (expéditeur)
    // Cet email sera utilisé pour envoyer les rappels de relance
    const query = `
      ALTER TABLE applications
      ADD COLUMN userEmail TEXT;
    `;

    db.exec(query);
    console.log('Column "userEmail" added successfully');
  } catch (error: any) {
    if (error.message.includes('duplicate column name')) {
      console.log('Column "userEmail" already exists - nothing to do');
    } else {
      console.error('Error adding column:', error);
    }
  } finally {
    db.close();
  }
}

addUserEmailColumn();
process.exit(0);
