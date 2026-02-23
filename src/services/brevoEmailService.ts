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
    html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a2e;"><div style="text-align:center;margin-bottom:32px;"><div style="display:inline-block;background:#2563eb;color:white;font-size:28px;font-weight:800;width:48px;height:48px;line-height:48px;border-radius:12px;">R</div><h1 style="font-size:22px;font-weight:700;margin:16px 0 0;color:#0f172a;">RelanceWork</h1></div><h2 style="font-size:20px;font-weight:600;margin-bottom:12px;">Bienvenue${userName ? " " + userName : ""} !</h2><p style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">Merci de vous être inscrit. Cliquez ci-dessous pour activer votre compte.</p><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#2563eb;border-radius:10px;padding:14px 32px;"><a href="${verificationLink}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:block;" target="_blank">Vérifier mon email</a></td></tr></table></td></tr></table><p style="font-size:13px;color:#94a3b8;line-height:1.5;">Si vous n'avez pas créé de compte, ignorez cet email.<br>Ce lien expire dans 24 heures.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;"><p style="font-size:12px;color:#94a3b8;text-align:center;">RelanceWork - Gérez vos candidatures avec confiance</p></div>`,
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

export interface ApplicationToRelance {
  company: string;
  poste: string;
  date: string;
}

export async function sendRelanceReminderEmail(
  to: string,
  applications: ApplicationToRelance[]
): Promise<boolean> {
  const rows = applications
    .map(
      (app) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${app.company}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#475569;">${app.poste}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#94a3b8;white-space:nowrap;">${app.date}</td>
        </tr>`
    )
    .join("");

  return sendEmail({
    to,
    subject: `🔔 ${applications.length} candidature${applications.length > 1 ? "s" : ""} à relancer – RelanceWork`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 24px;color:#1a1a2e;background:#f8fafc;">
        <div style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:#2563eb;color:white;font-size:22px;font-weight:800;width:48px;height:48px;line-height:48px;border-radius:12px;">R</div>
            <h1 style="font-size:20px;font-weight:700;margin:12px 0 0;color:#0f172a;">RelanceWork</h1>
          </div>

          <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px;">
            ${applications.length} candidature${applications.length > 1 ? "s" : ""} à relancer
          </h2>
          <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 28px;">
            Ces candidatures ont plus de 3 jours sans réponse. C'est le bon moment pour envoyer une relance !
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:32px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Entreprise</th>
                <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Poste</th>
                <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div style="text-align:center;">
            <a href="${process.env.FRONTEND_URL ?? "https://www.relance-work.fr"}/app"
               style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;box-shadow:0 4px 14px rgba(37,99,235,0.3);">
              Voir mes candidatures
            </a>
          </div>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
          <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
            RelanceWork · Vous recevez cet email car vous avez des candidatures en attente de relance.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Réinitialisez votre mot de passe - RelanceWork",
    html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a2e;"><div style="text-align:center;margin-bottom:32px;"><div style="display:inline-block;background:#2563eb;color:white;font-size:28px;font-weight:800;width:48px;height:48px;line-height:48px;border-radius:12px;">R</div><h1 style="font-size:22px;font-weight:700;margin:16px 0 0;color:#0f172a;">RelanceWork</h1></div><h2 style="font-size:20px;font-weight:600;margin-bottom:12px;">Réinitialisation du mot de passe</h2><p style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau.</p><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#2563eb;border-radius:10px;padding:14px 32px;"><a href="${resetLink}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:block;" target="_blank">Réinitialiser mon mot de passe</a></td></tr></table></td></tr></table><p style="font-size:13px;color:#94a3b8;line-height:1.5;">Si vous n'avez pas fait cette demande, ignorez cet email.<br>Ce lien expire dans 1 heure.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;"><p style="font-size:12px;color:#94a3b8;text-align:center;">RelanceWork - Gérez vos candidatures avec confiance</p></div>`,
  });
}
