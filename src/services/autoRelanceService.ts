import { supabase } from "../config/supabase";
import { sendRelanceReminderEmail } from "./brevoEmailService";

// Nombre de jours avant de marquer comme "à relancer"
const DAYS_BEFORE_RELANCE = 3;

// Intervalle de vérification (en millisecondes) - toutes les heures
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 heure

/**
 * Convertit une date en objet Date.
 * Supporte les formats JJ/MM/AAAA et YYYY-MM-DD.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Format ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format français: JJ/MM/AAAA
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0] ?? "", 10);
    const month = parseInt(parts[1] ?? "", 10) - 1;
    const year = parseInt(parts[2] ?? "", 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  }

  return null;
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

    // Récupérer les candidatures non relancées (tous statuts sauf refusé/accepté)
    const { data: applications, error } = await supabase
      .from('applications')
      .select('id, date, company, poste, user_email, user_id')
      .eq('relanced', false)
      .not('status', 'in', '("accepté","refusé")');

    if (error) {
      console.error("❌ Erreur récupération applications:", error);
      return 0;
    }

    if (!applications || applications.length === 0) return 0;

    // Grouper les candidatures par user_id
    const applicationsByUserId: Map<string, Array<{ company: string; poste: string; date: string }>> = new Map();

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

        // Grouper par user_id (fiable même si user_email est null)
        const userId = app.user_id || app.user_email || "default";

        if (!applicationsByUserId.has(userId)) {
          applicationsByUserId.set(userId, []);
        }
        applicationsByUserId.get(userId)!.push({
          company: app.company,
          poste: app.poste,
          date: app.date,
        });

        totalRelanced++;
      }
    }

    // Envoyer un email à chaque utilisateur avec ses candidatures à relancer
    for (const [userId, apps] of applicationsByUserId) {
      if (apps.length === 0 || userId === "default") continue;

      // Résoudre l'email : soit c'est déjà un email (user_email fallback), soit on fetch via user_id
      let recipientEmail = userId.includes("@") ? userId : null;

      if (!recipientEmail) {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        recipientEmail = userData?.user?.email ?? null;
      }

      if (recipientEmail) {
        await sendRelanceReminderEmail(recipientEmail, apps);
      } else {
        console.warn(`⚠️ Impossible de résoudre l'email pour user_id ${userId}`);
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
