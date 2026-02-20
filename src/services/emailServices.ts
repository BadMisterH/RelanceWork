import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ApplicationToRelance {
  company: string;
  poste: string;
  date: string;
}

/**
 * Envoie un email de rappel pour les candidatures à relancer
 * @param applications - Liste des candidatures à relancer
 * @param toEmail - Email du destinataire (optionnel, utilise EMAIL_TO par défaut)
 */
export async function sendRelanceReminder(
  applications: ApplicationToRelance[],
  toEmail?: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY non configurée - email non envoyé");
    return false;
  }

  const recipientEmail = toEmail || process.env.EMAIL_TO;
  if (!recipientEmail) {
    console.warn("⚠️ Aucun email destinataire - email non envoyé");
    return false;
  }

  const list = applications
    .map(
      (app) => `• ${app.company} - ${app.poste} (candidature du ${app.date})`
    )
    .join("\n");

  try {
    await resend.emails.send({
      from: "RelanceWork <onboarding@resend.dev>",
      to: recipientEmail,
      subject: `🔔 ${applications.length} candidature(s) à relancer`,
      text: `Bonjour,

Les candidatures suivantes ont plus de 3 jours et attendent une relance :

${list}

Connectez-vous à RelanceWork pour envoyer vos relances.
Bonne chance dans vos recherches !`,
    });

    return true;
  } catch (error) {
    console.error("❌ Erreur envoi email:", error);
    return false;
  }
}
