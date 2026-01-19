import { Resend } from "resend";

const resend = new Resend(process.env.RESEND);

export async function sendRelanceReminder(
  applications: Array<{ compagny: string; poste: string; date: string }>,
) {
  const list = applications
    .map(
      (app) => `- ${app.compagny} (${app.poste}) - candidature du ${app.date}`,
    )
    .join("\n");

  await resend.emails.send({
    from: "RelanceWork <onboarding@resend.dev>", // ou ton domaine vérifié
    to: process.env.EMAIL_TO!,
    subject: `🔔 ${applications.length} candidature(s) à relancer`,
    text: `Bonjour,\n\nLes candidatures suivantes ont plus de 3 jours et attendent une relance :\n\n${list}\n\nBonne chance !`,
  });
}
