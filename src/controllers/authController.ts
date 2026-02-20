import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { validateEmail } from "../utils/emailValidator";
import { subscriptionService } from "../services/subscriptionService";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from "../services/brevoEmailService";

const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error("FRONTEND_URL is not set");
}
if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(FRONTEND_URL)) {
  throw new Error("FRONTEND_URL points to localhost in production");
}
const FRONTEND_URL_SAFE = FRONTEND_URL;
const FRONTEND_BASE_PATH =
  (process.env.FRONTEND_BASE_PATH ??
    (process.env.NODE_ENV === "production" ? "/app" : "")).replace(/\/$/, "");

function buildFrontendUrl(path: string, baseUrl: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    const base = baseUrl.replace(/\/$/, "");
    return `${base}${path}`;
  }
}

// FRONTEND_URL doit être défini (ex: https://domaine.railway.app)
// FRONTEND_BASE_PATH permet d'ajouter /app si nécessaire
const AUTH_REDIRECT_URL = buildFrontendUrl(
  `${FRONTEND_BASE_PATH}/auth.html`,
  FRONTEND_URL_SAFE
);
if (process.env.NODE_ENV !== "test") {
}

// Force le redirect_to dans le lien Supabase pour pointer vers notre page auth
function fixRedirectUrl(actionLink: string): string {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", AUTH_REDIRECT_URL);
    return url.toString();
  } catch {
    return actionLink;
  }
}

// Signup - Créer un nouveau compte avec Supabase Auth
export const signup = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  try {
    // Validate input
    if (!name || !email || !password) {
      res.status(400).json({ message: "Tous les champs sont requis" });
      return;
    }

    // Valider l'email (format + domaines jetables)
    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ message: emailError });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        message: "Le mot de passe doit contenir au moins 8 caractères",
      });
      return;
    }

    // Créer l'utilisateur avec Supabase Auth Admin API (NON confirmé)
    // @ts-ignore
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: false,
      user_metadata: {
        name: name,
      },
    });

    if (error) {
      console.error("Supabase signup error:", error);

      if (
        error.message.includes("already") ||
        error.message.includes("exists")
      ) {
        res.status(409).json({ message: "Cet email est déjà utilisé" });
        return;
      }

      res.status(400).json({ message: error.message });
      return;
    }

    if (!data.user) {
      res
        .status(500)
        .json({ message: "Erreur lors de la création du compte" });
      return;
    }

    // Générer le lien de vérification via Supabase Admin
    // @ts-ignore
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "signup",
        email: email.toLowerCase(),
        password: password,
        options: {
          redirectTo: AUTH_REDIRECT_URL,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Generate link error:", linkError);
      res.status(201).json({
        message: "Compte créé mais erreur d'envoi de l'email de vérification.",
        emailVerificationRequired: true,
        user: {
          id: data.user.id,
          name: data.user.user_metadata?.name || name,
          email: data.user.email,
        },
      });
      return;
    }

    // Envoyer l'email de vérification via Brevo
    const verificationLink = fixRedirectUrl(linkData.properties.action_link);
    const emailSent = await sendVerificationEmail(
      email.toLowerCase(),
      verificationLink,
      name
    );

    if (!emailSent) {
      console.error(`⚠️ Email de vérification NON envoyé à ${email}`);
    }

    res.status(201).json({
      message: emailSent
        ? "Compte créé ! Vérifiez votre email pour activer votre compte."
        : "Compte créé mais l'email de vérification n'a pas pu être envoyé. Réessayez depuis la page de connexion.",
      emailVerificationRequired: true,
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || name,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Erreur lors de la création du compte" });
  }
};

// Login - Connexion avec Supabase Auth
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      res.status(400).json({ message: "Email et mot de passe requis" });
      return;
    }

    // Se connecter avec Supabase Auth
    // @ts-ignore
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      console.error("Supabase login error:", error);

      // Vérifier si c'est un problème de vérification email
      if (error.message.includes("Email not confirmed")) {
        res.status(403).json({
          message: "Veuillez vérifier votre email avant de vous connecter.",
          emailNotConfirmed: true,
        });
        return;
      }

      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    if (!data.user || !data.session) {
      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    res.status(200).json({
      message: "Connexion réussie",
      token: data.session.access_token,
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || "",
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erreur lors de la connexion" });
  }
};

// Forgot Password - Envoyer un email de réinitialisation via Brevo
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = req.body;

  try {
    if (!email) {
      res.status(400).json({ message: "L'email est requis" });
      return;
    }

    // Générer le lien de reset via Supabase Admin
    // @ts-ignore
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: email.toLowerCase(),
        options: {
          redirectTo: AUTH_REDIRECT_URL,
        },
      });

    if (linkError) {
      console.error("Generate recovery link error:", linkError);
      res.status(200).json({
        message:
          "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
      });
      return;
    }

    if (linkData?.properties?.action_link) {
      const resetLink = fixRedirectUrl(linkData.properties.action_link);
      const emailSent = await sendPasswordResetEmail(
        email.toLowerCase(),
        resetLink
      );
      if (!emailSent) {
        console.error(`⚠️ Email de reset NON envoyé à ${email}`);
      }
    }

    // Toujours retourner 200 (ne pas révéler si le compte existe)
    res.status(200).json({
      message:
        "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(200).json({
      message:
        "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
    });
  }
};

// Resend verification email
export const resendVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = req.body;

  try {
    if (!email) {
      res.status(400).json({ message: "L'email est requis" });
      return;
    }

    // @ts-ignore
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: email.toLowerCase(),
        options: {
          redirectTo: AUTH_REDIRECT_URL,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Generate magiclink error:", linkError);
      res.status(200).json({ message: "Email de vérification renvoyé." });
      return;
    }

    const magicLink = fixRedirectUrl(linkData.properties.action_link);
    const emailSent = await sendVerificationEmail(
      email.toLowerCase(),
      magicLink,
      ""
    );

    res.status(200).json({
      message: emailSent
        ? "Email de vérification renvoyé. Vérifiez votre boîte de réception."
        : "Erreur lors de l'envoi. Réessayez dans quelques minutes.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(200).json({ message: "Email de vérification renvoyé." });
  }
};

// Logout
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: "Déconnexion réussie" });
};

// Notify password changed (called by frontend after successful reset)
export const notifyPasswordChanged = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      res.status(400).json({ message: "Utilisateur non trouvé" });
      return;
    }

    await sendPasswordChangedEmail(user.email);
    res.status(200).json({ message: "Notification envoyée" });
  } catch (error) {
    console.error("Notify password changed error:", error);
    res.status(200).json({ message: "OK" });
  }
};

// Get current user
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(404).json({ message: "Utilisateur non trouvé" });
      return;
    }

    const planInfo = await subscriptionService.getUserPlan(user.id);

    res.status(200).json({
      user: {
        id: user.id,
        name: user.user_metadata?.name || "",
        email: user.email,
        createdAt: user.created_at,
        plan: planInfo.plan,
        planStatus: planInfo.status,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
};
