import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SpontaneousEmailResult {
  subject: string;
  body: string;
}

/**
 * Génère un email de candidature spontanée personnalisé via GPT-4o.
 * Adapte le ton selon la description de l'entreprise et le profil du candidat.
 */
export async function generateSpontaneousEmail(
  companyName: string,
  companyDescription: string,
  userProfile: string,
  userName: string = '',
  targetRole?: string  // Poste visé optionnel (ex: "Développeur React")
): Promise<SpontaneousEmailResult> {
  const roleBlock = targetRole
    ? `Poste visé par le candidat : ${targetRole}`
    : 'Le candidat recherche un poste en lien avec ses compétences (déduire depuis le profil).';

  const prompt = `Tu es un expert en recherche d'emploi spécialisé dans les candidatures spontanées. Tu rédiges des emails qui obtiennent des réponses parce qu'ils sont courts, précis et hyper-personnalisés.

━━━ ENTREPRISE CIBLE ━━━
Nom : ${companyName}
Description : ${companyDescription || 'Entreprise dans le secteur ciblé par le candidat.'}

━━━ PROFIL DU CANDIDAT ━━━
${userProfile.substring(0, 3000)}

━━━ POSTE VISÉ ━━━
${roleBlock}

━━━ MISSION ━━━
Rédige un email de candidature spontanée en 2 parties :

1. OBJET (sujet de l'email) — court, direct, professionnel
   Format recommandé : "Candidature spontanée – [Poste] | [Prénom Nom]"

2. CORPS DE L'EMAIL — structure en 3 paragraphes max :
   • Accroche : 1 phrase montrant que tu connais l'entreprise (utilise la description)
   • Valeur ajoutée : 2-3 phrases sur ce que le candidat apporte concrètement (compétences réelles du profil)
   • CTA : 1 phrase de conclusion + disponibilité entretien
   • Signature : ${userName || 'Le candidat'}

━━━ RÈGLES ABSOLUES ━━━
✓ Corps : 120-160 mots maximum — les recruteurs ne lisent pas les romans
✓ Ton : humain et direct, pas corporatif
✓ Chaque phrase = valeur concrète, pas du remplissage
✗ Pas de "je me permets de vous contacter", "dynamique", "passionné", "challenge"
✗ Pas de Markdown, pas de bullet points — texte brut uniquement
✗ Ne pas inventer de compétences absentes du profil

Retourne UNIQUEMENT ce format JSON (sans markdown) :
{"subject": "...", "body": "..."}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    return {
      subject: parsed.subject ?? `Candidature spontanée – ${companyName}`,
      body: parsed.body ?? '',
    };
  } catch {
    return {
      subject: `Candidature spontanée – ${companyName}`,
      body: raw,
    };
  }
}
