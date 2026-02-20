import { supabase } from "../config/supabase";
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

    // Récupérer les candidatures non relancées et encore en attente de réponse
    const { data: applications, error } = await supabase
      .from('applications')
      .select('id, date, company, poste, user_email')
      .eq('relanced', false)
      .in('status', ['en attente', 'pas de réponse']);

    if (error) {
      console.error("❌ Erreur récupération applications:", error);
      return 0;
    }

    if (!applications || applications.length === 0) return 0;

    // Grouper les candidatures par user_email
    const applicationsByUser: Map<string, Array<{ company: string; poste: string; date: string }>> = new Map();

    let totalRelanced = 0;

    for (const app of applications) {
      const applicationDate = parseDate(app.date);

      if (!applicationDate) {
        console.warn(`⚠️ Date invalide pour candidature #${app.id}: ${app.date}`);
        continue;
      }

      const daysPassed = daysBetween(applicationDate, today);

      if (daysPassed >= DAYS_BEFORE_RELANCE) {
        // Marquer comme à relancer
        await supabase
          .from('applications')
          .update({ relanced: true })
          .eq('id', app.id);

        // Grouper par user_email
        const userEmail = app.user_email || process.env.EMAIL_TO || "default";

        if (!applicationsByUser.has(userEmail)) {
          applicationsByUser.set(userEmail, []);
        }
        applicationsByUser.get(userEmail)!.push({
          company: app.company,
          poste: app.poste,
          date: app.date,
        });

        totalRelanced++;
      }
    }

    // Envoyer un email à chaque utilisateur avec ses candidatures à relancer
    for (const [userEmail, apps] of applicationsByUser) {
      if (apps.length > 0 && userEmail !== "default") {
        await sendRelanceReminder(apps, userEmail);
      }
    }

    return totalRelanced;
  } catch (error) {
    console.error("❌ Erreur lors de la vérification auto-relance:", error);
    return 0;
  }
}

/**
 * Démarre le service de vérification automatique
 */
export function startAutoRelanceService(): void {

  // Vérification immédiate au démarrage
  checkAndUpdateRelances().catch(console.error);

  // Puis vérification périodique
  setInterval(() => {
    checkAndUpdateRelances().catch(console.error);
  }, CHECK_INTERVAL);
}
