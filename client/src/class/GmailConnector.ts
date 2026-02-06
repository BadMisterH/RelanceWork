/**
 * Composant pour connecter Gmail
 */

import api from '../lib/api';

export class GmailConnector {
  private container: HTMLElement | null;
  private isConnected: boolean = false;
  private gmailEmail: string | null = null;

  constructor(containerId: string = 'gmailConnector') {
    this.container = document.getElementById(containerId);
    this.init();
  }

  private async init() {
    await this.checkStatus();
    this.render();
  }

  /**
   * Vérifie si Gmail est connecté
   */
  private async checkStatus() {
    try {
      const response = await api.get('/gmail-user/status');
      this.isConnected = response.data.connected;
      this.gmailEmail = response.data.gmail_email;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut Gmail:', error);
    }
  }

  /**
   * Affiche le composant
   */
  private render() {
    if (!this.container) return;

    if (this.isConnected) {
      this.container.innerHTML = `
        <div class="gmail-status connected">
          <div class="gmail-icon">✅</div>
          <div class="gmail-info">
            <strong>Gmail Connecté</strong>
            <p>${this.gmailEmail}</p>
          </div>
          <div class="gmail-actions">
            <button id="checkEmailsBtn" class="btn-check">
              🔍 Vérifier les emails
            </button>
            <button id="disconnectGmailBtn" class="btn-disconnect">
              🔌 Déconnecter
            </button>
          </div>
        </div>
      `;

      this.attachConnectedListeners();
    } else {
      this.container.innerHTML = `
        <div class="gmail-status disconnected">
          <div class="gmail-icon">📧</div>
          <div class="gmail-info">
            <strong>Détection Automatique des Candidatures</strong>
            <p>Connectez votre Gmail pour auto-détecter vos candidatures</p>
          </div>
          <button id="connectGmailBtn" class="btn-connect">
            🔗 Connecter mon Gmail
          </button>
        </div>
      `;

      this.attachDisconnectedListeners();
    }
  }

  /**
   * Gestion des événements (état déconnecté)
   */
  private attachDisconnectedListeners() {
    const connectBtn = document.getElementById('connectGmailBtn');
    connectBtn?.addEventListener('click', () => this.connectGmail());
  }

  /**
   * Gestion des événements (état connecté)
   */
  private attachConnectedListeners() {
    const checkBtn = document.getElementById('checkEmailsBtn');
    const disconnectBtn = document.getElementById('disconnectGmailBtn');

    checkBtn?.addEventListener('click', () => this.checkEmails());
    disconnectBtn?.addEventListener('click', () => this.disconnectGmail());
  }

  /**
   * Connecter Gmail
   */
  private async connectGmail() {
    try {
      const response = await api.get('/gmail-user/connect');
      const authUrl = response.data.auth_url;

      // Ouvrir l'URL d'authentification dans une nouvelle fenêtre
      const width = 600;
      const height = 700;
      const left = (screen.width / 2) - (width / 2);
      const top = (screen.height / 2) - (height / 2);

      const authWindow = window.open(
        authUrl,
        'Gmail Authentication',
        `width=${width},height=${height},top=${top},left=${left}`
      );

      // Écouter la fermeture de la fenêtre
      const checkClosed = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);

          // Vérifier si la connexion a réussi
          await this.checkStatus();
          this.render();

          if (this.isConnected) {
            alert('✅ Gmail connecté avec succès !');
          }
        }
      }, 500);
    } catch (error: any) {
      console.error('Erreur lors de la connexion Gmail:', error);
      alert('❌ Erreur lors de la connexion Gmail: ' + error.message);
    }
  }

  /**
   * Vérifier les nouveaux emails
   */
  private async checkEmails() {
    try {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.textContent = '⏳ Vérification en cours...';
      }

      await api.post('/gmail-user/check-emails');

      alert('✅ Emails vérifiés ! Les nouvelles candidatures ont été ajoutées.');

      // Recharger les candidatures
      window.location.reload();
    } catch (error: any) {
      console.error('Erreur lors de la vérification des emails:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      const checkBtn = document.getElementById('checkEmailsBtn') as HTMLButtonElement;
      if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = '🔍 Vérifier les emails';
      }
    }
  }

  /**
   * Déconnecter Gmail
   */
  private async disconnectGmail() {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter Gmail ?')) {
      return;
    }

    try {
      await api.post('/gmail-user/disconnect');

      this.isConnected = false;
      this.gmailEmail = null;
      this.render();

      alert('✅ Gmail déconnecté');
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion Gmail:', error);
      alert('❌ Erreur: ' + error.message);
    }
  }
}
