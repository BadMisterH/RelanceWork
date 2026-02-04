import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const SALT_ROUNDS = 10;

// Signup
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

    // Check if user already exists
    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email.toLowerCase());

    if (existingUser) {
      res.status(409).json({ message: "Cet email est déjà utilisé" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = db
      .prepare(
        "INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, datetime('now')) RETURNING id, name, email, created_at"
      )
      .get(name, email.toLowerCase(), hashedPassword) as any;

    const user = result;

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Compte créé avec succès",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Erreur lors de la création du compte" });
  }
};

// Login
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password, rememberMe } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      res.status(400).json({ message: "Email et mot de passe requis" });
      return;
    }

    // Find user
    const user = db
      .prepare("SELECT id, name, email, password FROM users WHERE email = ?")
      .get(email.toLowerCase()) as any;

    if (!user) {
      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({ message: "Email ou mot de passe incorrect" });
      return;
    }

    // Generate JWT token
    const expiresIn = rememberMe ? "30d" : "7d";
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn }
    );

    // Update last login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(
      user.id
    );

    res.status(200).json({
      message: "Connexion réussie",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erreur lors de la connexion" });
  }
};

// Logout (client-side will remove token, but we can blacklist tokens in future)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: "Déconnexion réussie" });
};

// Get current user
export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const user = db
      .prepare(
        "SELECT id, name, email, created_at, last_login FROM users WHERE id = ?"
      )
      .get(userId) as any;

    if (!user) {
      res.status(404).json({ message: "Utilisateur non trouvé" });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'utilisateur" });
  }
};
