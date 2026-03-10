import { supabase } from '../config/supabase';
import { getEmailEnrichmentService } from './emailEnrichmentService';
import { enrichCompany } from './companyEnrichmentService';
import { generateSpontaneousEmail } from './spontaneousEmailGenerator';
import { gmailMultiUserService } from './gmailMultiUserService';
import {
  CompanyTarget,
  discoverCompaniesFromJobListings,
  buildManualTargets,
} from './companyDiscoveryService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpontaneousOptions {
  // Source des entreprises
  source: 'indeed' | 'jsearch' | 'manual';
  keyword?: string;
  location?: string;
  maxPages?: number;
  manualCompanies?: Array<{ name: string; domain?: string; website?: string }>;

  // Profil candidat
  userProfile: string;
  userName?: string;
  targetRole?: string;      // Poste visé (optionnel)

  // Envoi
  autoSend?: boolean;       // Si true : envoie directement via Gmail
  cvBase64?: string;        // CV en base64 (PDF)
  cvFileName?: string;      // Nom du fichier CV (ex: "CV_Jean_Dupont.pdf")
}

export interface SpontaneousResult {
  discovered: number;
  enriched: number;
  emailsFound: number;
  generated: number;
  sent: number;
  saved: number;
  errors: number;
}

export interface ProspectRow {
  id: string;
  company_name: string;
  company_domain: string | null;
  company_website: string | null;
  company_description: string | null;
  company_favicon: string | null;
  contact_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  cv_attached: boolean;
  status: string;
  search_keyword: string | null;
  source: string;
  gmail_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline principal
// ─────────────────────────────────────────────────────────────────────────────

export async function runSpontaneousPipeline(
  userId: string,
  options: SpontaneousOptions
): Promise<SpontaneousResult> {
  const {
    source,
    keyword = '',
    location = 'France',
    maxPages = 1,
    manualCompanies = [],
    userProfile,
    userName = '',
    targetRole,
    autoSend = false,
    cvBase64,
    cvFileName = 'CV.pdf',
  } = options;

  const result: SpontaneousResult = {
    discovered: 0,
    enriched: 0,
    emailsFound: 0,
    generated: 0,
    sent: 0,
    saved: 0,
    errors: 0,
  };

  // ── 1. Récupérer les entreprises ─────────────────────────────────────────
  let companies: CompanyTarget[] = [];
  try {
    if (source === 'manual') {
      companies = buildManualTargets(manualCompanies);
    } else {
      companies = await discoverCompaniesFromJobListings(keyword, location, maxPages, source);
    }
    result.discovered = companies.length;
    console.log(`🏢 ${companies.length} entreprises à traiter`);
  } catch (err: any) {
    console.error('❌ Découverte échouée:', err.message);
    throw new Error(`Découverte d'entreprises échouée: ${err.message}`);
  }

  if (companies.length === 0) return result;

  // ── 2. Dédoublonner avec les prospects existants ─────────────────────────
  const { data: existing } = await supabase
    .from('spontaneous_prospects')
    .select('company_name')
    .eq('user_id', userId);

  const existingNames = new Set(
    (existing || []).map((p: any) => p.company_name.toLowerCase().trim())
  );
  const newCompanies = companies.filter(
    c => !existingNames.has(c.name.toLowerCase().trim())
  );
  console.log(`🔁 ${companies.length - newCompanies.length} doublons ignorés, ${newCompanies.length} nouvelles entreprises`);

  const enrichmentSvc = getEmailEnrichmentService();

  // ── 3. Traiter chaque entreprise ─────────────────────────────────────────
  for (const company of newCompanies) {
    try {
      // 3a. Enrichir le site de l'entreprise
      let description = company.description ?? '';
      let domain = company.domain ?? '';
      let favicon = company.favicon ?? '';
      let website = company.website ?? '';

      if (website) {
        try {
          const info = await enrichCompany(website);
          if (info) {
            description = info.description || description;
            domain = info.domain || domain;
            favicon = info.favicon || favicon;
          }
          result.enriched++;
        } catch {
          // Non-bloquant
        }
      }

      // Extraire le domaine si pas encore défini
      if (!domain && company.name) {
        domain = company.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.fr';
      }

      // 3b. Trouver l'email de contact via Hunter.io
      let contactEmail: string | null = null;
      try {
        const emailResult = await enrichmentSvc.findCompanyEmails(company.name, domain);
        if (emailResult.emails.length > 0) {
          contactEmail = emailResult.emails[0] ?? null;
          result.emailsFound++;
          console.log(`  📧 Email trouvé pour ${company.name}: ${contactEmail}`);
        } else {
          console.log(`  ⚠️ Pas d'email trouvé pour ${company.name}`);
        }
      } catch {
        // Non-bloquant — on sauvegarde quand même le prospect
      }

      // 3c. Générer l'email de candidature spontanée
      let subject = '';
      let body = '';
      try {
        const generated = await generateSpontaneousEmail(
          company.name,
          description,
          userProfile,
          userName,
          targetRole
        );
        subject = generated.subject;
        body = generated.body;
        result.generated++;
      } catch (err: any) {
        console.error(`  ❌ Génération email échouée pour ${company.name}:`, err.message);
        result.errors++;
        // On continue pour sauvegarder le prospect sans email généré
      }

      // 3d. Envoyer si demandé ET email trouvé
      let gmailMessageId: string | null = null;
      let sentAt: string | null = null;
      let sendStatus: string = 'pending';

      if (autoSend && contactEmail && subject && body) {
        try {
          const sendResult = await gmailMultiUserService.sendEmailWithAttachment(
            userId,
            contactEmail,
            subject,
            body,
            cvBase64 ? { base64: cvBase64, filename: cvFileName } : undefined
          );
          gmailMessageId = sendResult.messageId;
          sentAt = new Date().toISOString();
          sendStatus = 'sent';
          result.sent++;
          console.log(`  ✉️ Email envoyé à ${contactEmail} (${company.name})`);
        } catch (err: any) {
          console.error(`  ❌ Envoi échoué pour ${company.name}:`, err.message);
          sendStatus = 'failed';
          result.errors++;
        }
      } else if (!contactEmail) {
        sendStatus = 'pending'; // Pas d'email → en attente
      }

      // 3e. Sauvegarder le prospect en base
      const { error: insertError } = await supabase.from('spontaneous_prospects').insert({
        user_id: userId,
        company_name: company.name,
        company_domain: domain || null,
        company_website: website || null,
        company_description: description || null,
        company_favicon: favicon || null,
        contact_email: contactEmail,
        email_subject: subject || null,
        email_body: body || null,
        cv_attached: !!(autoSend && cvBase64 && sendStatus === 'sent'),
        status: sendStatus,
        search_keyword: keyword || null,
        source: company.source,
        gmail_message_id: gmailMessageId,
        sent_at: sentAt,
      });

      if (insertError) {
        console.error(`  ❌ Erreur insert pour ${company.name}:`, insertError.message);
        result.errors++;
      } else {
        result.saved++;
      }

      // Pause pour respecter les rate limits
      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      console.error(`❌ Erreur traitement ${company.name}:`, err.message);
      result.errors++;
    }
  }

  console.log('🏁 Pipeline spontané terminé:', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoyer un prospect existant (depuis l'UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendSpontaneousProspect(
  userId: string,
  prospectId: string,
  cvBase64?: string,
  cvFileName: string = 'CV.pdf'
): Promise<{ success: boolean; messageId?: string }> {
  // Récupérer le prospect
  const { data: prospect, error } = await supabase
    .from('spontaneous_prospects')
    .select('*')
    .eq('id', prospectId)
    .eq('user_id', userId)
    .single();

  if (error || !prospect) throw new Error('Prospect introuvable');
  if (!prospect.contact_email) throw new Error('Pas d\'email de contact pour ce prospect');
  if (!prospect.email_subject || !prospect.email_body) throw new Error('Email non généré — lancez d\'abord la génération');

  const sendResult = await gmailMultiUserService.sendEmailWithAttachment(
    userId,
    prospect.contact_email,
    prospect.email_subject,
    prospect.email_body,
    cvBase64 ? { base64: cvBase64, filename: cvFileName } : undefined
  );

  // Mettre à jour le statut
  await supabase
    .from('spontaneous_prospects')
    .update({
      status: 'sent',
      gmail_message_id: sendResult.messageId,
      sent_at: new Date().toISOString(),
      cv_attached: !!cvBase64,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  return { success: true, messageId: sendResult.messageId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Régénérer l'email d'un prospect existant
// ─────────────────────────────────────────────────────────────────────────────

export async function regenerateSpontaneousEmail(
  userId: string,
  prospectId: string,
  userProfile: string,
  userName?: string,
  targetRole?: string
): Promise<{ subject: string; body: string }> {
  const { data: prospect, error } = await supabase
    .from('spontaneous_prospects')
    .select('company_name, company_description')
    .eq('id', prospectId)
    .eq('user_id', userId)
    .single();

  if (error || !prospect) throw new Error('Prospect introuvable');

  const generated = await generateSpontaneousEmail(
    prospect.company_name,
    prospect.company_description ?? '',
    userProfile,
    userName,
    targetRole
  );

  await supabase
    .from('spontaneous_prospects')
    .update({
      email_subject: generated.subject,
      email_body: generated.body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  return generated;
}
