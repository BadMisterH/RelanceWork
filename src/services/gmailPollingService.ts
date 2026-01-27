import { gmailAuthService } from './gmailAuthService';
import { gmailWatchService } from './gmailWatchService';
import { addApplication } from '../controllers/applicationController';

const POLLING_INTERVAL = 30000; // 30 secondes

export class GmailPollingService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckedMessageId: string | null = null;
  private processedMessageIds: Set<string> = new Set();

  /**
   * Démarre le polling automatique
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️  Gmail polling already running');
      return;
    }

    if (!gmailAuthService.isAuthenticated()) {
      console.log('⚠️  Cannot start Gmail polling: Not authenticated');
      console.log('💡 Please authenticate first using: GET /api/gmail/auth/url');
      return;
    }

    console.log('🚀 Starting Gmail automatic polling...');
    console.log(`⏱️  Checking for new sent emails every ${POLLING_INTERVAL / 1000} seconds`);

    this.isRunning = true;

    // Vérification initiale
    this.checkForNewEmails();

    // Vérification périodique
    this.intervalId = setInterval(() => {
      this.checkForNewEmails();
    }, POLLING_INTERVAL);
  }

  /**
   * Arrête le polling automatique
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️  Gmail polling is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('⏹️  Gmail polling stopped');
  }

  /**
   * Vérifie s'il y a de nouveaux emails
   */
  private async checkForNewEmails(): Promise<void> {
    try {
      // Récupérer les 10 derniers emails envoyés
      const recentEmails = await gmailWatchService.listRecentSentEmails(10);

      if (!recentEmails || recentEmails.length === 0) {
        return;
      }

      // Si c'est la première vérification, on marque le dernier email comme référence
      if (!this.lastCheckedMessageId) {
        this.lastCheckedMessageId = recentEmails[0].id;
        console.log(`📌 Initial check: Marked message ${this.lastCheckedMessageId} as reference`);
        return;
      }

      // Trouver les nouveaux emails (ceux qui sont après le dernier vérifié)
      const newEmails: any[] = [];
      for (const email of recentEmails) {
        if (email.id === this.lastCheckedMessageId) {
          break; // On arrête dès qu'on trouve le dernier email traité
        }
        if (!this.processedMessageIds.has(email.id)) {
          newEmails.push(email);
        }
      }

      if (newEmails.length === 0) {
        return;
      }

      console.log(`📬 Found ${newEmails.length} new email(s)`);

      // Traiter chaque nouveau email
      for (const email of newEmails) {
        await this.processNewEmail(email.id);
      }

      // Mettre à jour la référence
      if (newEmails.length > 0) {
        this.lastCheckedMessageId = recentEmails[0].id;
      }
    } catch (error: any) {
      console.error('❌ Error checking for new emails:', error.message);

      // Si l'erreur est liée à l'authentification, arrêter le polling
      if (error.message.includes('invalid_grant') || error.message.includes('Token')) {
        console.log('🔐 Authentication error - stopping polling');
        this.stop();
      }
    }
  }

  /**
   * Traite un nouvel email
   */
  private async processNewEmail(messageId: string): Promise<void> {
    try {
      // Marquer comme traité immédiatement pour éviter les doublons
      this.processedMessageIds.add(messageId);

      console.log(`📧 Processing new email: ${messageId}`);

      // Analyser l'email
      const emailData = await gmailWatchService.processEmail(messageId);

      if (!emailData) {
        console.log(`ℹ️  Email ${messageId} is not a job application (format not recognized)`);
        return;
      }

      // Vérifier si c'est une candidature valide
      if (!emailData.poste || !emailData.status) {
        console.log(`⚠️  Email ${messageId} missing required fields`);
        return;
      }

      console.log('✨ Job application detected:');
      console.log(`   Company: ${emailData.company || 'N/A'}`);
      console.log(`   Position: ${emailData.poste}`);
      console.log(`   Status: ${emailData.status}`);
      console.log(`   Email: ${emailData.email || 'N/A'}`);

      // Ajouter à la base de données
      await addApplication(emailData);

      console.log(`✅ Application added successfully (ID: ${messageId})`);
    } catch (error: any) {
      console.error(`❌ Error processing email ${messageId}:`, error.message);

      // En cas d'erreur, retirer de la liste des traités pour réessayer plus tard
      this.processedMessageIds.delete(messageId);
    }
  }

  /**
   * Retourne le statut du polling
   */
  public getStatus(): {
    isRunning: boolean;
    interval: number;
    lastCheckedMessageId: string | null;
    processedCount: number;
  } {
    return {
      isRunning: this.isRunning,
      interval: POLLING_INTERVAL,
      lastCheckedMessageId: this.lastCheckedMessageId,
      processedCount: this.processedMessageIds.size
    };
  }

  /**
   * Nettoie les anciens IDs traités (garde seulement les 100 derniers)
   */
  private cleanupProcessedIds(): void {
    if (this.processedMessageIds.size > 100) {
      const idsArray = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(idsArray.slice(-100));
    }
  }
}

// Export singleton instance
export const gmailPollingService = new GmailPollingService();
