import db from "../config/database";
import { sendRelanceReminder } from "./emailServices";

// Nombre de jours avant de marquer comme "à relancer"
const DAYS_BEFORE_RELANCE = 3;

// Intervalle de vérification (en millisecondes) - toutes les heures
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 heure

/**
 * Convertit une date au format JJ/MM/AAAA en objet Date
 */
function parseDate(dateStr: string): Date | null {
  // Format attendu: JJ/MM/AAAA
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0] ?? "", 10);
  const month = parseInt(parts[1] ?? "", 10) - 1; // Les mois commencent à 0
  const year = parseInt(parts[2] ?? "", 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  return new Date(year, month, day);
}

/**
 * Calcule le nombre de jours entre deux dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // millisecondes dans un jour
  return Math.floor((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Vérifie et met à jour automatiquement les candidatures
 * qui ont dépassé le délai de relance
 */
export async function checkAndUpdateRelances(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normaliser à minuit

    // Récupérer toutes les candidatures non relancées
    const applications = db
      .prepare("SELECT id, date, company, poste FROM applications WHERE relanced = 0")
      .all() as Array<{ id: number; date: string; company: string; poste: string }>;

    const applicationsToRelance: Array<{ company: string; poste: string; date: string }> = [];

    for (const app of applications) {
      const applicationDate = parseDate(app.date);

      if (!applicationDate) {
        console.warn(`⚠️ Date invalide pour candidature #${app.id}: ${app.date}`);
        continue;
      }

      const daysPassed = daysBetween(applicationDate, today);

      if (daysPassed >= DAYS_BEFORE_RELANCE) {
        // Marquer comme à relancer
        db.prepare("UPDATE applications SET relanced = 1 WHERE id = ?").run(app.id);
        applicationsToRelance.push({
          company: app.company,
          poste: app.poste,
          date: app.date,
        });
        console.log(
          `📧 Auto-relance: ${app.company} - ${app.poste} (${daysPassed} jours écoulés)`
        );
      }
    }

    // Envoyer un email si des candidatures ont été marquées
    if (applicationsToRelance.length > 0) {
      console.log(`✅ ${applicationsToRelance.length} candidature(s) marquée(s) à relancer`);
      await sendRelanceReminder(applicationsToRelance);
    }

    return applicationsToRelance.length;
  } catch (error) {
    console.error("❌ Erreur lors de la vérification auto-relance:", error);
    return 0;
  }
}

/**
 * Démarre le service de vérification automatique
 */
export function startAutoRelanceService(): void {
  console.log("🔄 Service auto-relance démarré (vérification toutes les heures)");
  console.log(`⏰ Délai de relance configuré: ${DAYS_BEFORE_RELANCE} jours`);

  // Vérification immédiate au démarrage
  checkAndUpdateRelances().catch(console.error);

  // Puis vérification périodique
  setInterval(() => {
    console.log("🔄 Vérification automatique des relances...");
    checkAndUpdateRelances().catch(console.error);
  }, CHECK_INTERVAL);
}
