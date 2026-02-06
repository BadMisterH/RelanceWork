import { Request, Response } from "express";
import { supabase } from "../config/supabase";

// Signup - Créer un nouveau compte avec Supabase Auth
export const signup = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  try {
    // Validate input
    if (!name || !email || !password) {
      res.status(400).json({ message: "Tous les champs sont requis" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        message: "Le mot de passe doit contenir au moins 8 caractères",
      });
      return;
    }

    // Créer l'utilisateur avec Supabase Auth Admin API
    // @ts-ignore - Supabase types may not be fully recognized
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm en dev
      user_metadata: {
        name: name,
      },
    });

    if (error) {
      console.error("Supabase signup error:", error);

      if (error.message.includes("already") || error.message.includes("exists")) {
        res.status(409).json({ message: "Cet email est déjà utilisé" });
        return;
      }

      res.status(400).json({ message: error.message });
      return;
    }

    if (!data.user) {
      res.status(500).json({ message: "Erreur lors de la création du compte" });
      return;
    }

    // Créer une session pour le nouvel utilisateur
    // @ts-ignore
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    res.status(201).json({
      message: "Compte créé avec succès",
      token: sessionData?.session?.access_token || '',
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || name,
        email: data.user.email,
        createdAt: data.user.created_at,
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
        name: data.user.user_metadata?.name || '',
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erreur lors de la connexion" });
  }
};

// Logout - Déconnexion avec Supabase Auth
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: "Déconnexion réussie" });
};

// Get current user - Récupérer l'utilisateur authentifié
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // L'utilisateur a été attaché par le middleware authenticateToken
    const user = (req as any).user;

    if (!user) {
      res.status(404).json({ message: "Utilisateur non trouvé" });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.user_metadata?.name || '',
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
};
