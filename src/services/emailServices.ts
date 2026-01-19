import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ApplicationToRelance {
  company: string;
  poste: string;
  date: string;
}

/**
 * Envoie un email de rappel pour les candidatures à relancer
 */
export async function sendRelanceReminder(
  applications: ApplicationToRelance[]
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY non configurée - email non envoyé");
    return false;
  }

  if (!process.env.EMAIL_TO) {
    console.warn("⚠️ EMAIL_TO non configurée - email non envoyé");
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
      to: process.env.EMAIL_TO,
      subject: `🔔 ${applications.length} candidature(s) à relancer`,
      text: `Bonjour,

Les candidatures suivantes ont plus de 3 jours et attendent une relance :

${list}

Connectez-vous à RelanceWork pour envoyer vos relances.

Bonne chance dans vos recherches !`,
    });

    console.log(`📧 Email envoyé à ${process.env.EMAIL_TO}`);
    return true;
  } catch (error) {
    console.error("❌ Erreur envoi email:", error);
    return false;
  }
}
