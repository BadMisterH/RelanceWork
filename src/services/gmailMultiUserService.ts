/**
 * Service Gmail Multi-Utilisateur
 * Chaque user a son propre compte Gmail connecté
 */

import { google } from 'googleapis';
import { supabase } from '../config/supabase';
import { gmailWatchService } from './gmailWatchService';
import { addApplication } from '../controllers/applicationController';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

interface GmailToken {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  gmail_email: string;
}

export class GmailMultiUserService {
  private oauth2Clients: Map<string, any> = new Map(); // userId -> OAuth2Client

  /**
   * Génère l'URL d'authentification OAuth pour un utilisateur
   */
  public getAuthUrl(userId: string, userEmail: string): string {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: userId, // Passer le userId dans le state pour le callback
      login_hint: userEmail, // ✅ Pré-remplir avec l'email d'inscription
      prompt: 'consent' // Force l'affichage de l'écran de consentement
    });

    return authUrl;
  }

  /**
   * Échange le code OAuth contre des tokens et les stocke
   */
  public async handleOAuthCallback(code: string, userId: string): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Échanger le code contre des tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain Gmail tokens');
    }

    // Récupérer l'email Gmail de l'utilisateur
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailEmail = profile.data.emailAddress!;

    // ✅ VALIDATION : Vérifier que le Gmail correspond à l'email d'inscription
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const registrationEmail = user?.user?.email;

    if (registrationEmail && gmailEmail.toLowerCase() !== registrationEmail.toLowerCase()) {
      throw new Error(
        `Vous devez connecter le Gmail utilisé lors de votre inscription (${registrationEmail}), pas ${gmailEmail}`
      );
    }

    // Calculer l'expiration du token
    const expiryDate = new Date();
    if (tokens.expiry_date) {
      expiryDate.setTime(tokens.expiry_date);
    } else {
      expiryDate.setHours(expiryDate.getHours() + 1); // 1 heure par défaut
    }

    // Stocker les tokens dans Supabase (upsert = insert ou update)
    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiryDate.toISOString(),
        gmail_email: gmailEmail,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id' // ✅ Si user_id existe déjà, mettre à jour au lieu d'insérer
      });

    if (error) {
      throw new Error(`Failed to store Gmail tokens: ${error.message}`);
    }

    console.log(`✅ Gmail connected for user ${userId}: ${gmailEmail}`);
  }

  /**
   * Récupère le client OAuth2 pour un utilisateur (avec refresh automatique)
   */
  private async getOAuth2ClientForUser(userId: string): Promise<any> {
    // Vérifier si on a déjà un client en cache
    if (this.oauth2Clients.has(userId)) {
      return this.oauth2Clients.get(userId);
    }

    // Récupérer les tokens depuis Supabase
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error(`Gmail not connected for user ${userId}`);
    }

    const tokenData = data as GmailToken;

    // Créer le client OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: new Date(tokenData.token_expiry).getTime()
    });

    // Écouter les refresh automatiques et mettre à jour la DB
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        const newExpiry = new Date();
        newExpiry.setTime(tokens.expiry_date || Date.now() + 3600000);

        await supabase
          .from('gmail_tokens')
          .update({
            access_token: tokens.access_token,
            token_expiry: newExpiry.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        console.log(`🔄 Refreshed Gmail token for user ${userId}`);
      }
    });

    // Mettre en cache
    this.oauth2Clients.set(userId, oauth2Client);

    return oauth2Client;
  }

  /**
   * Vérifie les nouveaux emails pour un utilisateur spécifique
   */
  public async checkEmailsForUser(userId: string): Promise<void> {
    try {
      const oauth2Client = await this.getOAuth2ClientForUser(userId);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Récupérer les 10 derniers emails envoyés
      const response = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: 10
      });

      const messages = response.data.messages || [];

      console.log(`📬 Found ${messages.length} recent sent emails for user ${userId}`);

      // Traiter chaque email
      for (const message of messages) {
        if (!message.id) continue;

        // Récupérer le message complet
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        // Analyser si c'est une candidature
        const emailData = this.parseJobApplicationEmail(fullMessage.data);

        if (emailData) {
          console.log(`✨ Job application detected for user ${userId}:`, emailData.company);

          // Ajouter à la base de données avec le user_id
          await supabase
            .from('applications')
            .insert({
              ...emailData,
              user_id: userId // ✅ CRITIQUE: Attacher au bon utilisateur
            });

          console.log(`✅ Application added for user ${userId}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error checking emails for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Analyse un email pour détecter une candidature
   * Format d'objet requis:
   * - "Candidature [Poste] - [Entreprise]"
   * - "Suite à ma candidature - [Poste]"
   */
  private parseJobApplicationEmail(message: any): any | null {
    try {
      const headers = message.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // ✅ Pattern 1: "Candidature [Poste] - [Entreprise]"
      const candidaturePattern = /^Candidature\s+(.+?)\s*-\s*(.+)$/i;
      const candidatureMatch = subject.match(candidaturePattern);

      if (candidatureMatch) {
        const poste = candidatureMatch[1].trim();
        const company = candidatureMatch[2].trim();

        return {
          company,
          poste,
          status: 'Candidature envoyée',
          date: new Date(date).toISOString().split('T')[0],
          relanced: false,
          email: to,
          user_email: null,
          relance_count: 0
        };
      }

      // ✅ Pattern 2: "Suite à ma candidature - [Poste]"
      const relancePattern = /^Suite à ma candidature\s*-\s*(.+)$/i;
      const relanceMatch = subject.match(relancePattern);

      if (relanceMatch) {
        const poste = relanceMatch[1].trim();

        // Extraire l'entreprise depuis le destinataire
        const emailMatch = to.match(/([^@]+)@([^.]+)/);
        const company = emailMatch ? emailMatch[2].charAt(0).toUpperCase() + emailMatch[2].slice(1) : 'Entreprise';

        return {
          company,
          poste,
          status: 'Relance envoyée',
          date: new Date(date).toISOString().split('T')[0],
          relanced: true,
          email: to,
          user_email: null,
          relance_count: 1
        };
      }

      // ❌ Format non reconnu
      console.log(`Format d'objet non reconnu: "${subject}"`);
      return null;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Déconnecte Gmail pour un utilisateur
   */
  public async disconnectGmail(userId: string): Promise<void> {
    // Supprimer de la DB
    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to disconnect Gmail: ${error.message}`);
    }

    // Supprimer du cache
    this.oauth2Clients.delete(userId);

    console.log(`✅ Gmail disconnected for user ${userId}`);
  }

  /**
   * Vérifie si un utilisateur a Gmail connecté
   */
  public async isGmailConnected(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('id')
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  }

  /**
   * Récupère l'email Gmail d'un utilisateur
   */
  public async getGmailEmail(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('gmail_tokens')
      .select('gmail_email')
      .eq('user_id', userId)
      .single();

    return data?.gmail_email || null;
  }
}

// Export singleton
export const gmailMultiUserService = new GmailMultiUserService();
