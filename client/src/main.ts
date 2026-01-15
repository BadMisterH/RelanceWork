import "./style.css";
import axios from "axios";
import { UI } from "./class/UI.ts";

// URL de base de ton API backend
const API_URL = "http://localhost:3000/api";

// Interface TypeScript pour typer les candidatures
export interface Application {
  id: number;
  company: string;
  poste: string;
  status: string;
  date: string;
  relanced: number; // 0 = false, 1 = true (SQLite boolean)
  email?: string; // Adresse email du destinataire
  created_at?: string;
}

const affichage = new UI();

async function GetAllDataPost() {
  try {
    const result = await axios.get<Application[]>(`${API_URL}/applications`);
    affichage.getAffichage(result.data);
  } catch (error) {
    console.error("ERREUR AXIOS", error);
  }
}

GetAllDataPost();
