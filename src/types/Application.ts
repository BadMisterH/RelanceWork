export type Application = {
  id: number;
  company: string;
  poste: string;
  status: string;
  date: string;
  created_at?: string;
  relanced?: number; // 0 or 1 (boolean in SQLite)
  email?: string; // Email du destinataire (entreprise)
  userEmail?: string; // Email de l'utilisateur (expéditeur)
  relance_count?: number; // Nombre de relances envoyées
};
