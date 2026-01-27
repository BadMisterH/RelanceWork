import { google } from 'googleapis';
import { gmailAuthService } from './gmailAuthService';

const TOPIC_NAME = 'projects/YOUR_PROJECT_ID/topics/gmail-notifications';

export interface EmailData {
  company?: string;
  poste: string;
  email?: string;
  userEmail?: string;
  status: string;
  isRelance: boolean;
}

/**
 * Parser l'objet de l'email pour extraire les informations
 * (Même logique que content.js de l'extension Chrome)
 */
export function parseEmailSubject(subject: string): EmailData | null {
  // Format 1: "Candidature - Poste - Entreprise" ou "Candidature : Poste - Entreprise"
  const format1 = /^candidature\s*[-–:]\s*(.+?)\s*[-–:]\s*(.+)$/i;
  let match = subject.match(format1);
  if (match && match[1] && match[2]) {
    return {
      poste: match[1].trim(),
      company: match[2].trim(),
      status: 'Candidature envoyée',
      isRelance: false
    };
  }

  // Format 2: "Candidature au poste de [Poste] - [Entreprise]"
  const format2 = /candidature\s*(?:au\s*)?(?:poste\s*)?(?:de\s*)?(.+?)\s*[-–]\s*(.+)/i;
  match = subject.match(format2);
  if (match && match[1] && match[2]) {
    return {
      poste: match[1].trim(),
      company: match[2].trim(),
      status: 'Candidature envoyée',
      isRelance: false
    };
  }

  // Format 3: "Suite à ma candidature - [Poste]" (pour les relances)
  const format3 = /suite\s*(?:à|a)\s*ma\s*candidature\s*[-–:]\s*(.+)/i;
  match = subject.match(format3);
  if (match && match[1]) {
    return {
      poste: match[1].trim(),
      company: '',
      status: 'Relance envoyée',
      isRelance: true
    };
  }

  // Format 4: Ancien format "[CANDIDATURE] Entreprise - Poste"
  const format4 = /\[(CANDIDATURE|RELANCE)\]\s*(.+?)\s*[-–]\s*(.+)/i;
  match = subject.match(format4);
  if (match && match[1] && match[2] && match[3]) {
    const type = match[1].toUpperCase();
    return {
      company: match[2].trim(),
      poste: match[3].trim(),
      status: type === 'RELANCE' ? 'Relance envoyée' : 'Candidature envoyée',
      isRelance: type === 'RELANCE'
    };
  }

  return null;
}

export class GmailWatchService {
  private gmail: any;
  private watchRenewalInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeGmail();
  }

  /**
   * Initialise le client Gmail API
   */
  private initializeGmail(): void {
    if (!gmailAuthService.isAuthenticated()) {
      console.log('⚠️  Gmail not authenticated yet. Please authenticate first.');
      return;
    }

    const auth = gmailAuthService.getOAuth2Client();
    this.gmail = google.gmail({ version: 'v1', auth });
    console.log('✅ Gmail API client initialized');
  }

  /**
   * Configure la surveillance Gmail avec Push Notifications
   */
  public async setupWatch(topicName: string): Promise<void> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized. Please authenticate first.');
      }

      await gmailAuthService.refreshTokenIfNeeded();

      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: ['SENT']
        }
      });

      console.log('✅ Gmail watch enabled:', response.data);
      console.log(`📧 Watching for sent emails. Expires at: ${new Date(parseInt(response.data.expiration)).toLocaleString()}`);

      // Renouveler automatiquement avant expiration (tous les 6 jours, watch expire après 7 jours)
      this.scheduleWatchRenewal(topicName);

      return response.data;
    } catch (error: any) {
      console.error('❌ Error setting up Gmail watch:', error.message);
      if (error.message.includes('Precondition check failed')) {
        console.log('💡 Tip: Make sure the Pub/Sub topic exists and Gmail has publish permissions.');
      }
      throw error;
    }
  }

  /**
   * Programme le renouvellement automatique du watch
   */
  private scheduleWatchRenewal(topicName: string): void {
    if (this.watchRenewalInterval) {
      clearInterval(this.watchRenewalInterval);
    }

    // Renouveler tous les 6 jours (watch expire après 7 jours)
    const sixDaysInMs = 6 * 24 * 60 * 60 * 1000;
    this.watchRenewalInterval = setInterval(() => {
      console.log('🔄 Renewing Gmail watch...');
      this.setupWatch(topicName).catch(error => {
        console.error('❌ Failed to renew watch:', error);
      });
    }, sixDaysInMs);
  }

  /**
   * Arrête la surveillance Gmail
   */
  public async stopWatch(): Promise<void> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized');
      }

      if (this.watchRenewalInterval) {
        clearInterval(this.watchRenewalInterval);
        this.watchRenewalInterval = null;
      }

      await this.gmail.users.stop({
        userId: 'me'
      });

      console.log('✅ Gmail watch stopped');
    } catch (error) {
      console.error('❌ Error stopping Gmail watch:', error);
      throw error;
    }
  }

  /**
   * Récupère les détails d'un message Gmail
   */
  public async getMessage(messageId: string): Promise<any> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized');
      }

      await gmailAuthService.refreshTokenIfNeeded();

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error getting message:', error);
      throw error;
    }
  }

  /**
   * Extrait les informations d'un message Gmail
   */
  public extractEmailInfo(message: any): { subject: string; to: string; from: string } | null {
    try {
      const headers = message.payload.headers;

      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
      const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';

      return { subject, to, from };
    } catch (error) {
      console.error('❌ Error extracting email info:', error);
      return null;
    }
  }

  /**
   * Extrait l'adresse email d'une chaîne (ex: "John Doe <john@example.com>")
   */
  public extractEmailAddress(emailString: string): string | null {
    const match = emailString.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match ? match[0] : null;
  }

  /**
   * Traite un email envoyé et extrait les informations de candidature
   */
  public async processEmail(messageId: string): Promise<EmailData | null> {
    try {
      console.log(`📧 Processing email ${messageId}...`);

      const message = await this.getMessage(messageId);
      const emailInfo = this.extractEmailInfo(message);

      if (!emailInfo) {
        console.log('⚠️  Could not extract email info');
        return null;
      }

      console.log('📝 Subject:', emailInfo.subject);
      console.log('👤 From:', emailInfo.from);
      console.log('📧 To:', emailInfo.to);

      // Parser le sujet
      const parsed = parseEmailSubject(emailInfo.subject);

      if (!parsed) {
        console.log('ℹ️  Email ignored (format not recognized)');
        return null;
      }

      console.log('✨ Application detected:', parsed);

      // Ajouter les emails
      const recipientEmail = this.extractEmailAddress(emailInfo.to);
      const userEmail = this.extractEmailAddress(emailInfo.from);

      if (recipientEmail) {
        parsed.email = recipientEmail;
      }

      if (userEmail) {
        parsed.userEmail = userEmail;
      }

      return parsed;
    } catch (error) {
      console.error('❌ Error processing email:', error);
      return null;
    }
  }

  /**
   * Liste les derniers emails envoyés (pour test ou fallback)
   */
  public async listRecentSentEmails(maxResults: number = 10): Promise<any[]> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized');
      }

      await gmailAuthService.refreshTokenIfNeeded();

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        labelIds: ['SENT'],
        maxResults: maxResults
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('❌ Error listing sent emails:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const gmailWatchService = new GmailWatchService();
