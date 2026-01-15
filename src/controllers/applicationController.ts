import { Request, Response } from "express";
import db from "../config/database";

// GET /applications - Récupérer toutes les applications
export const getAllApplications = (_req: Request, res: Response) => {
  try {
    const applications = db.prepare("SELECT * FROM applications ORDER BY id").all();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: "Database error" });
  }
};

// POST /application - Créer une nouvelle application
export const createApplication = (req: Request, res: Response) => {
  try {
    const { company, poste, status, email } = req.body;

    // Générer automatiquement la date au format JJ/MM/AAAA
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const date = `${day}/${month}/${year}`;

    const stmt = db.prepare(
      `INSERT INTO applications (company, poste, status, date, relanced, email)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const result = stmt.run(company, poste, status, date, 0, email || null); // 0 = false par défaut, email optionnel

    // Récupérer l'application créée
    const newApplication = db.prepare("SELECT * FROM applications WHERE id = ?").get(result.lastInsertRowid);

    res.status(201).json({
      message: "Application created",
      data: newApplication,
    });
  } catch (error) {
    res.status(500).json({ message: "Database error" });
  }
};

// PUT /applications/:id/relance - Mettre à jour le statut de relance
export const updateRelanceStatus = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { relanced } = req.body;
    // Vérifier que relanced est 0 ou 1
    if (relanced !== 0 && relanced !== 1) {
      return res.status(400).json({ message: "relanced doit être 0 ou 1" });
    }

    // Vérifier que l'application existe
    const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);

    if (!application) {
      return res.status(404).json({ message: "Aucune candidature trouvée" });
    }

    // Mettre à jour le statut
    const stmt = db.prepare("UPDATE applications SET relanced = ? WHERE id = ?");
    stmt.run(relanced, id);

    // Récupérer l'application mise à jour
    const updatedApplication = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);

    res.json({
      message: "Statut de relance mis à jour",
      data: updatedApplication,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// DELETE /applications/:id - Supprimer une application
export const deleteApplication = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Récupérer l'application avant de la supprimer
    const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);

    if (!application) {
      return res.status(404).json({ message: "Aucune candidature trouvée" });
    }

    const stmt = db.prepare("DELETE FROM applications WHERE id = ?");
    stmt.run(id);

    res.json({ message: "Supprimé", deleted: application });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};
