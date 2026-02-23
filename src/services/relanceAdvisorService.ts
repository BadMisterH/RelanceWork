import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
import axios from "axios";

export interface DiagnosticResult {
  points_forts: string[];
  points_adapter: string[];
  conseils_relance: string[];
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function extractJobText(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout: 8000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RelanceWork/1.0)" },
    maxRedirects: 3,
    maxContentLength: 500_000,
    responseType: "text",
  });

  return String(response.data)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

async function extractCvText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.replace(/\s+/g, " ").trim().slice(0, 5000);
}

export async function analyzeRelance(params: {
  cvBuffer: Buffer;
  jobUrl: string;
  company: string;
  poste: string;
}): Promise<DiagnosticResult> {
  const [cvText, jobText] = await Promise.all([
    extractCvText(params.cvBuffer),
    extractJobText(params.jobUrl).catch(() => {
      throw new Error(
        "Impossible de lire la fiche de poste. Vérifiez que l'URL est accessible."
      );
    }),
  ]);

  if (!cvText.trim()) {
    throw new Error(
      "Le PDF ne contient pas de texte lisible. Utilisez un PDF non scanné."
    );
  }

  const prompt = `Tu es un conseiller en recherche d'emploi. Analyse ce candidat pour une relance.

Entreprise : ${params.company}
Poste visé : ${params.poste}

CV du candidat (extrait) :
${cvText}

Fiche de poste (extrait) :
${jobText}

Retourne UNIQUEMENT un objet JSON valide avec exactement ces 3 clés (2 à 3 items maximum par liste) :
{"points_forts":["...","..."],"points_adapter":["...","..."],"conseils_relance":["...","..."]}

Règles strictes :
- Aucun score, aucun pourcentage
- Chaque item = 1 phrase courte et actionnable
- points_forts : ce que le candidat peut valoriser dans sa relance
- points_adapter : ce qui mérite attention ou pourrait être mieux mis en avant
- conseils_relance : conseils concrets pour personnaliser CET email de relance (pas une candidature initiale)
- Réponds uniquement avec le JSON, rien d'autre`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const first = message.content[0];
  const text = first?.type === "text" ? first.text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Format de réponse invalide.");
  }

  const result = JSON.parse(jsonMatch[0]) as DiagnosticResult;

  return {
    points_forts: Array.isArray(result.points_forts)
      ? result.points_forts.slice(0, 3)
      : [],
    points_adapter: Array.isArray(result.points_adapter)
      ? result.points_adapter.slice(0, 3)
      : [],
    conseils_relance: Array.isArray(result.conseils_relance)
      ? result.conseils_relance.slice(0, 3)
      : [],
  };
}
