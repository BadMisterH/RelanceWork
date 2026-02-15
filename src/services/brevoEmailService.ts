import axios from "axios";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply@relancework.com";
const SENDER_NAME = "RelanceWork";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.error("❌ BREVO_API_KEY manquante dans .env");
    return false;
  }

  console.log(`📧 Tentative d'envoi email Brevo à ${to} (sender: ${SENDER_EMAIL})`);

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`✅ Email envoyé avec succès à ${to} — messageId: ${response.data?.messageId || "N/A"}`);
    return true;
  } catch (error: any) {
    const errData = error.response?.data;
    const errStatus = error.response?.status;
    console.error(`❌ Erreur envoi email Brevo (HTTP ${errStatus}):`, JSON.stringify(errData, null, 2) || error.message);
    if (errStatus === 401) {
      console.error("   → Vérifiez votre BREVO_API_KEY");
    } else if (errData?.code === "unauthorized" || errData?.message?.includes("sender")) {
      console.error("   → L'email expéditeur n'est pas vérifié dans Brevo. Allez dans Brevo → Expéditeurs → Ajouter un expéditeur");
    }
    return false;
  }
}

export async function sendVerificationEmail(to: string, verificationLink: string, userName: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Vérifiez votre email - RelanceWork",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #2563eb; color: white; font-size: 28px; font-weight: 800; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">R</div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 16px 0 0; color: #0f172a;">RelanceWork</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Bienvenue ${userName} !</h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          Merci de vous être inscrit sur RelanceWork. Cliquez sur le bouton ci-dessous pour vérifier votre adresse email et activer votre compte.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Vérifier mon email
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Si vous n'avez pas créé de compte, ignorez cet email.<br>
          Ce lien expire dans 24 heures.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          RelanceWork - Gérez vos candidatures avec confiance
        </p>
      </div>
    `,
  });
}

export async function sendPasswordChangedEmail(to: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Mot de passe modifié - RelanceWork",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #2563eb; color: white; font-size: 28px; font-weight: 800; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">R</div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 16px 0 0; color: #0f172a;">RelanceWork</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Mot de passe modifié</h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          Votre mot de passe a été modifié avec succès. Si vous n'êtes pas à l'origine de cette action, contactez-nous immédiatement.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: #10b981; color: white; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; font-size: 24px;">&#10003;</div>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Date : ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          RelanceWork - Gérez vos candidatures avec confiance
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Réinitialisez votre mot de passe - RelanceWork",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #2563eb; color: white; font-size: 28px; font-weight: 800; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">R</div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 16px 0 0; color: #0f172a;">RelanceWork</h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">Réinitialisation du mot de passe</h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
          Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.<br>
          Ce lien expire dans 1 heure.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          RelanceWork - Gérez vos candidatures avec confiance
        </p>
      </div>
    `,
  });
}
