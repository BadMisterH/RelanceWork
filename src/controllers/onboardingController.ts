import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import {
  sendWelcomeEmail,
  sendActivationEmail,
  sendLetterPreviewEmail,
  sendSocialProofEmail,
  sendUrgencyEmail,
  sendWeekCheckInEmail,
} from "../services/brevoEmailService";

// POST /api/onboarding/profile
// Saves the user's onboarding profile (poste, ville, experience) and marks onboarding as started.
export const saveOnboardingProfile = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { poste, ville, experience } = req.body;

  if (!poste || !ville || !experience) {
    res.status(400).json({ message: "poste, ville et experience sont requis" });
    return;
  }

  try {
    // @ts-ignore
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        onboarding: {
          completed: true,
          poste,
          ville,
          experience,
          completed_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      console.error("Onboarding profile save error:", error);
      res.status(500).json({ message: "Erreur lors de la sauvegarde du profil" });
      return;
    }

    res.status(200).json({ message: "Profil onboarding sauvegardé" });
  } catch (error) {
    console.error("saveOnboardingProfile error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/onboarding/status
// Returns the onboarding status for the current user.
export const getOnboardingStatus = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  const onboarding = user.user_metadata?.onboarding ?? null;

  res.status(200).json({
    completed: onboarding?.completed ?? false,
    profile: onboarding
      ? {
          poste: onboarding.poste,
          ville: onboarding.ville,
          experience: onboarding.experience,
        }
      : null,
  });
};

// POST /api/onboarding/emails/trigger  (called by cron job — not user-facing)
// Checks all users by days since creation and sends the appropriate onboarding email.
export const triggerOnboardingEmails = async (req: Request, res: Response): Promise<void> => {
  // Require a cron secret to prevent abuse
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    // Fetch all users (page by page, max 1000)
    // @ts-ignore
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data) {
      res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
      return;
    }

    const now = Date.now();
    const results: { email: string; day: number; sent: boolean }[] = [];

    for (const user of data.users) {
      if (!user.email || !user.email_confirmed_at) continue;

      const confirmedAt = new Date(user.email_confirmed_at).getTime();
      const daysSince = Math.floor((now - confirmedAt) / (1000 * 60 * 60 * 24));
      const emailsSent: string[] = user.user_metadata?.onboarding_emails_sent ?? [];
      const name = user.user_metadata?.name || "là";

      // Check how many applications the user has (for J+7 branching)
      const { count: appCount } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const hasApplications = (appCount ?? 0) > 0;

      let sent = false;
      let key = "";

      if (daysSince === 0 && !emailsSent.includes("j0")) {
        sent = await sendWelcomeEmail(user.email, name);
        key = "j0";
      } else if (daysSince === 1 && !emailsSent.includes("j1")) {
        sent = await sendActivationEmail(user.email, name);
        key = "j1";
      } else if (daysSince === 2 && !emailsSent.includes("j2")) {
        sent = await sendLetterPreviewEmail(user.email, name);
        key = "j2";
      } else if (daysSince === 3 && !emailsSent.includes("j3")) {
        sent = await sendSocialProofEmail(user.email, name);
        key = "j3";
      } else if (daysSince === 5 && !emailsSent.includes("j5")) {
        sent = await sendUrgencyEmail(user.email, name);
        key = "j5";
      } else if (daysSince === 7 && !emailsSent.includes("j7")) {
        sent = await sendWeekCheckInEmail(user.email, name, hasApplications);
        key = "j7";
      }

      if (sent && key) {
        // Mark email as sent in user_metadata so we never send twice
        // @ts-ignore
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            onboarding_emails_sent: [...emailsSent, key],
          },
        });

        results.push({ email: user.email, day: daysSince, sent: true });
      }
    }

    res.status(200).json({ processed: results.length, results });
  } catch (error) {
    console.error("triggerOnboardingEmails error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
