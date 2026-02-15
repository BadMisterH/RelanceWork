import { Request, Response } from "express";
import { supabase } from "../config/supabase";

// GET /applications - Récupérer toutes les applications de l'utilisateur connecté
export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Récupérer uniquement les applications de cet utilisateur
    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true });

    if (error) {
      console.error("❌ Erreur récupération applications:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des applications" });
      return;
    }

    res.json(applications);
  } catch (error) {
    console.error("❌ Erreur récupération applications:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// POST /application - Créer une nouvelle application
export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📥 Requête POST reçue:', JSON.stringify(req.body, null, 2));

    const { company, poste, status, email, isRelance, userEmail, company_website } = req.body;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Vérifier que les champs obligatoires sont présents
    if (!company || !poste || !status) {
      console.warn('⚠️ Champs manquants:', { company, poste, status });
      res.status(400).json({
        message: "Champs obligatoires manquants: company, poste, status"
      });
      return;
    }

    // Générer automatiquement la date au format JJ/MM/AAAA
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const date = `${day}/${month}/${year}`;

    console.log('📝 Données à insérer:', { company, poste, status, date, email, isRelance, userEmail, userId });

    // Convertir isRelance en BOOLEAN (au lieu de INTEGER)
    const relancedValue = isRelance ? true : false;

    // Insérer l'application dans Supabase
    const { data: newApplication, error } = await supabase
      .from('applications')
      .insert({
        company,
        poste,
        status,
        date,
        relanced: relancedValue,
        email: email || null,
        user_email: userEmail || null,
        company_website: company_website || null,
        user_id: userId, // IMPORTANT: Toujours lier à l'utilisateur
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur insertion Supabase:', error);
      res.status(500).json({ message: "Erreur lors de la création de l'application" });
      return;
    }

    console.log(`✅ Application créée:`, newApplication);

    res.status(201).json({
      message: "Application créée avec succès",
      data: newApplication,
    });
  } catch (error) {
    console.error("❌ Erreur création application:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// PUT /applications/:id/relance - Mettre à jour le statut de relance
export const updateRelanceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { relanced } = req.body;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Vérifier que relanced est un booléen
    if (typeof relanced !== 'boolean') {
      res.status(400).json({ message: "relanced doit être true ou false" });
      return;
    }

    // Mettre à jour uniquement si l'application appartient à l'utilisateur
    const { data: updatedApplication, error } = await supabase
      .from('applications')
      .update({ relanced })
      .eq('id', id)
      .eq('user_id', userId) // IMPORTANT: Vérifier ownership
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour Supabase:', error);
      if (error.code === 'PGRST116') {
        res.status(404).json({ message: "Aucune candidature trouvée" });
        return;
      }
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
      return;
    }

    res.json({
      message: "Statut de relance mis à jour",
      data: updatedApplication,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour relance:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// PUT /applications/:id/send-relance - Incrémenter le compteur de relances
export const sendRelance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Récupérer l'application (uniquement si elle appartient à l'utilisateur)
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !application) {
      res.status(404).json({ message: "Aucune candidature trouvée" });
      return;
    }

    // Incrémenter le compteur de relances
    const currentCount = application.relance_count ?? 0;
    const newCount = currentCount + 1;

    const { data: updatedApplication, error: updateError } = await supabase
      .from('applications')
      .update({ relance_count: newCount, relanced: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erreur mise à jour compteur:', updateError);
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
      return;
    }

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

// PUT /applications/:id/status - Mettre à jour le statut d'une candidature
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Valider le statut
    const validStatuses = ["accepté", "refusé", "pas de réponse", "en attente"];
    if (!status || !validStatuses.includes(status.toLowerCase())) {
      res.status(400).json({
        message: "Statut invalide. Valeurs acceptées: accepté, refusé, pas de réponse, en attente"
      });
      return;
    }

    // Mettre à jour uniquement si l'application appartient à l'utilisateur
    const { data: updatedApplication, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      if (error.code === 'PGRST116') {
        res.status(404).json({ message: "Aucune candidature trouvée" });
        return;
      }
      res.status(500).json({ message: "Erreur lors de la mise à jour du statut" });
      return;
    }

    console.log(`✅ Statut mis à jour pour candidature #${id}: ${status}`);

    res.json({
      message: "Statut mis à jour avec succès",
      data: updatedApplication,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour statut:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// DELETE /applications/:id - Supprimer une application
export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Récupérer l'ID de l'utilisateur authentifié
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "Utilisateur non authentifié" });
      return;
    }

    // Récupérer l'application avant de la supprimer
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !application) {
      res.status(404).json({ message: "Aucune candidature trouvée" });
      return;
    }

    // Supprimer l'application
    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Erreur suppression:', deleteError);
      res.status(500).json({ message: "Erreur lors de la suppression" });
      return;
    }

    res.json({ message: "Supprimé", deleted: application });
  } catch (error) {
    console.error("❌ Erreur suppression application:", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// Fonction utilitaire pour ajouter une application programmatiquement (depuis Gmail service)
export const addApplication = async (data: {
  company?: string;
  poste: string;
  status: string;
  email?: string;
  userEmail?: string;
  isRelance?: boolean;
  userId?: string; // NOUVEAU: Nécessaire pour Supabase
}): Promise<any> => {
  try {
    const { company, poste, status, email, isRelance, userEmail, userId } = data;

    // Vérifier que les champs obligatoires sont présents
    if (!poste || !status) {
      throw new Error("Champs obligatoires manquants: poste, status");
    }

    if (!userId) {
      throw new Error("userId est requis pour créer une application");
    }

    // Générer automatiquement la date au format JJ/MM/AAAA
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const date = `${day}/${month}/${year}`;

    console.log('📝 Adding application:', { company, poste, status, date, email, isRelance, userEmail, userId });

    // Convertir isRelance en BOOLEAN
    const relancedValue = isRelance ? true : false;

    // Insérer dans Supabase
    const { data: newApplication, error } = await supabase
      .from('applications')
      .insert({
        company: company || '',
        poste,
        status,
        date,
        relanced: relancedValue,
        email: email || null,
        user_email: userEmail || null,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur insertion:', error);
      throw error;
    }

    console.log(`✅ Application created:`, newApplication);

    return newApplication;
  } catch (error) {
    console.error("❌ Error creating application:", error);
    throw error;
  }
};
