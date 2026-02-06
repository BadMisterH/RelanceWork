/**
 * Script de migration SQLite → Supabase PostgreSQL
 *
 * Ce script migre toutes les candidatures depuis SQLite
 * vers Supabase en les attachant à un utilisateur spécifique
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('Assurez-vous que SUPABASE_URL et SUPABASE_SERVICE_KEY sont définis dans .env');
  process.exit(1);
}

// Initialiser les clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const dbPath = path.join(__dirname, '../data/relancework.sqlite');
const db = new Database(dbPath);

interface SQLiteApplication {
  id: number;
  company: string;
  poste: string;
  status: string;
  date: string;
  created_at?: string;
  relanced: number; // SQLite boolean (0/1)
  email?: string;
  userEmail?: string;
  relance_count?: number;
}

async function migrate() {
  console.log('🚀 Début de la migration SQLite → Supabase\n');

  try {
    // 1. Demander l'email de l'utilisateur cible
    const userEmail = process.argv[2];

    if (!userEmail) {
      console.error('❌ Veuillez fournir l\'email de l\'utilisateur');
      console.log('\nUsage:');
      console.log('  npm run migrate-data votre@email.com');
      process.exit(1);
    }

    console.log(`📧 Email utilisateur: ${userEmail}\n`);

    // 2. Récupérer l'utilisateur Supabase
    console.log('🔍 Recherche de l\'utilisateur dans Supabase...');
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', userError);
      process.exit(1);
    }

    const targetUser = users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());

    if (!targetUser) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé dans Supabase`);
      console.log('\nUtilisateurs disponibles:');
      users?.forEach(u => console.log(`  - ${u.email}`));
      process.exit(1);
    }

    console.log(`✅ Utilisateur trouvé: ${targetUser.email} (${targetUser.id})\n`);

    // 3. Lire les applications depuis SQLite
    console.log('📖 Lecture des candidatures depuis SQLite...');
    const applications = db.prepare('SELECT * FROM applications ORDER BY id').all() as SQLiteApplication[];

    console.log(`✅ ${applications.length} candidatures trouvées\n`);

    if (applications.length === 0) {
      console.log('ℹ️  Aucune candidature à migrer');
      return;
    }

    // 4. Migrer les applications
    console.log('📤 Migration vers Supabase...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const app of applications) {
      try {
        // Convertir le format SQLite → PostgreSQL
        const supabaseApp = {
          company: app.company,
          poste: app.poste,
          status: app.status,
          date: app.date,
          relanced: app.relanced === 1, // Convertir 0/1 en boolean
          email: app.email || null,
          user_email: app.userEmail || null,
          relance_count: app.relance_count || 0,
          user_id: targetUser.id, // Attacher à l'utilisateur
        };

        const { error } = await supabase
          .from('applications')
          .insert(supabaseApp);

        if (error) {
          console.error(`  ❌ Erreur pour "${app.company}" - ${app.poste}:`, error.message);
          errorCount++;
        } else {
          console.log(`  ✅ ${app.company} - ${app.poste}`);
          successCount++;
        }
      } catch (err) {
        console.error(`  ❌ Erreur inattendue pour "${app.company}":`, err);
        errorCount++;
      }
    }

    // 5. Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(50));
    console.log(`✅ Succès: ${successCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`📦 Total: ${applications.length}`);
    console.log('='.repeat(50) + '\n');

    if (successCount > 0) {
      console.log('🎉 Migration terminée avec succès !');
      console.log(`\nVos ${successCount} candidatures sont maintenant dans Supabase`);
      console.log('Rechargez votre application pour les voir.\n');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Exécuter la migration
migrate();
