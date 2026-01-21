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
    console.log('📥 Requête POST reçue:', JSON.stringify(req.body, null, 2));
    
    const { company, poste, status, email, isRelance, userEmail } = req.body;

    // Vérifier que les champs obligatoires sont présents
    if (!company || !poste || !status) {
      console.warn('⚠️ Champs manquants:', { company, poste, status });
      return res.status(400).json({ 
        message: "Missing required fields: company, poste, status" 
      });
    }

    // Générer automatiquement la date au format JJ/MM/AAAA
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const date = `${day}/${month}/${year}`;

    console.log('📝 Données à insérer:', { company, poste, status, date, email, isRelance, userEmail });

    // Vérifier la structure de la table
    try {
      const tableInfo = db.prepare("PRAGMA table_info(applications)").all();
      console.log('📊 Structure de la table:', tableInfo);
    } catch (e) {
      console.error('❌ Erreur lecture table_info:', e);
    }

    const stmt = db.prepare(
      `INSERT INTO applications (company, poste, status, date, relanced, email, userEmail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    // Convertir isRelance en booléen (0 ou 1)
    const relancedValue = isRelance ? 1 : 0;
    const result = stmt.run(company, poste, status, date, relancedValue, email || null, userEmail || null);

    console.log('✅ Insert résultat - lastInsertRowid:', result.lastInsertRowid, '- changes:', result.changes);

    // Récupérer l'application créée
    const newApplication = db.prepare("SELECT * FROM applications WHERE id = ?").get(result.lastInsertRowid);

    console.log(`✅ Application créée et récupérée:`, newApplication);

    res.status(201).json({
      message: "Application created",
      data: newApplication,
    });
  } catch (error) {
    console.error("❌ Erreur création application:", error);
    res.status(500).json({ 
      message: "Database error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
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

// PUT /applications/:id/send-relance - Incrémenter le compteur de relances (appelé quand on envoie une relance)
export const sendRelance = (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Vérifier que l'application existe
    const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as { relance_count?: number } | undefined;

    if (!application) {
      return res.status(404).json({ message: "Aucune candidature trouvée" });
    }

    // Incrémenter le compteur de relances
    const currentCount = application.relance_count ?? 0;
    const newCount = currentCount + 1;

    const stmt = db.prepare("UPDATE applications SET relance_count = ? WHERE id = ?");
    stmt.run(newCount, id);

    // Récupérer l'application mise à jour
    const updatedApplication = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);

    console.log(`📧 Relance envoyée pour candidature #${id} - Total relances: ${newCount}`);

    res.json({
      message: `Relance #${newCount} enregistrée`,
      relance_count: newCount,
      data: updatedApplication,
    });
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement de la relance:", error);
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
