import type { Application } from "../main.ts";
import api from "../lib/api";

export class ModernTableView {
  private container: HTMLElement | null;
  private applications: Application[] = [];

  constructor(containerId: string = "applicationsList") {
    this.container = document.getElementById(containerId);
    this.initProfileMenu();
  }

  /**
   * Initialiser le menu profil avec déconnexion
   */
  private initProfileMenu() {
    const profileHeader = document.querySelector('.profile-header');
    const profileMenu = document.querySelector('.profile-menu');

    if (!profileHeader || !profileMenu) return;

    // Toggle menu on click
    profileHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      profileHeader.classList.toggle('open');
      profileMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!profileHeader.contains(e.target as Node) && !profileMenu.contains(e.target as Node)) {
        profileHeader.classList.remove('open');
        profileMenu.classList.remove('active');
      }
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    }
  }

  /**
   * Gérer la déconnexion
   */
  private async handleLogout() {
    try {
      const { supabase } = await import('../lib/supabase');

      // Déconnexion de Supabase
      await supabase.auth.signOut();

      // Rediriger vers la page de connexion
      window.location.href = '/auth.html';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      alert('Erreur lors de la déconnexion');
    }
  }

  /**
   * Rendre la vue tableau avec toutes les applications
   */
  public render(applications: Application[]) {
    if (!this.container) return;

    this.applications = applications;

    // Grouper les applications par statut
    const grouped = this.groupByStatus(applications);

    // Générer le HTML
    const html = this.generateTableHTML(grouped);

    this.container.innerHTML = html;

    // Attacher les événements
    this.attachEventListeners();
  }

  /**
   * Grouper les applications par statut
   */
  private groupByStatus(applications: Application[]): Map<string, Application[]> {
    const groups = new Map<string, Application[]>();

    // Définir l'ordre des statuts
    const statusOrder = [
      'Candidature envoyée',
      'Entretien',
      'En attente',
      'Accepté',
      'Refusé'
    ];

    // Initialiser les groupes
    statusOrder.forEach(status => groups.set(status, []));

    // Grouper les applications
    applications.forEach(app => {
      const status = app.status || 'En attente';
      if (!groups.has(status)) {
        groups.set(status, []);
      }
      groups.get(status)!.push(app);
    });

    // Retourner uniquement les groupes non vides
    return new Map(
      [...groups.entries()].filter(([_, apps]) => apps.length > 0)
    );
  }

  /**
   * Générer le HTML du tableau
   */
  private generateTableHTML(grouped: Map<string, Application[]>): string {
    if (this.applications.length === 0) {
      return this.generateEmptyState();
    }

    let html = '<div class="applications-table-view">';

    grouped.forEach((apps, status) => {
      html += this.generateStatusSection(status, apps);
    });

    html += '</div>';
    return html;
  }

  /**
   * Générer une section pour un statut
   */
  private generateStatusSection(status: string, apps: Application[]): string {
    const statusClass = this.getStatusClass(status);

    return `
      <div class="table-section" data-status="${status}">
        <div class="table-section-header">
          <h3 class="table-section-title">
            ${status}
            <span class="table-section-count">${apps.length}</span>
          </h3>
        </div>
        <div class="applications-table">
          <div class="table-header">
            <div class="table-row">
              <div class="table-cell">Entreprise</div>
              <div class="table-cell">Poste</div>
              <div class="table-cell">Statut</div>
              <div class="table-cell">Date</div>
              <div class="table-cell">Actions</div>
            </div>
          </div>
          <div class="table-body">
            ${apps.map(app => this.generateTableRow(app, statusClass)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Générer une ligne du tableau
   */
  private generateTableRow(app: Application, statusClass: string): string {
    const hasEmail = app.email && app.email.trim() !== '';

    return `
      <div class="table-row" data-id="${app.id}">
        <div class="table-cell cell-company" data-label="Entreprise">
          ${this.escapeHtml(app.company)}
        </div>
        <div class="table-cell cell-poste" data-label="Poste">
          ${this.escapeHtml(app.poste)}
        </div>
        <div class="table-cell cell-status" data-label="Statut">
          <span class="status-tag ${statusClass}">
            ${this.escapeHtml(app.status)}
          </span>
        </div>
        <div class="table-cell cell-date" data-label="Date">
          ${app.date}
        </div>
        <div class="table-cell cell-actions" data-label="Actions">
          ${hasEmail ? `
            <button class="action-btn action-relance" data-id="${app.id}" data-email="${app.email}" title="Envoyer une relance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Relancer
            </button>
          ` : ''}
          <button class="action-btn action-btn-icon danger action-delete" data-id="${app.id}" data-company="${app.company}" title="Supprimer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Générer l'état vide
   */
  private generateEmptyState(): string {
    return `
      <div class="table-empty">
        <svg class="table-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <div class="table-empty-title">Aucune candidature</div>
        <div class="table-empty-text">Commencez par ajouter votre première candidature</div>
      </div>
    `;
  }

  /**
   * Attacher les événements
   */
  private attachEventListeners() {
    // Boutons de suppression
    const deleteButtons = this.container?.querySelectorAll('.action-delete');
    deleteButtons?.forEach(btn => {
      btn.addEventListener('click', this.handleDelete.bind(this));
    });

    // Boutons de relance
    const relanceButtons = this.container?.querySelectorAll('.action-relance');
    relanceButtons?.forEach(btn => {
      btn.addEventListener('click', this.handleRelance.bind(this));
    });
  }

  /**
   * Gérer la suppression
   */
  private async handleDelete(e: Event) {
    const button = e.currentTarget as HTMLButtonElement;
    const id = button.getAttribute('data-id');
    const company = button.getAttribute('data-company');

    if (!id) return;

    const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer la candidature chez ${company} ?`);
    if (!confirmed) return;

    try {
      await api.delete(`/applications/${id}`);

      // Supprimer la ligne du tableau avec animation
      const row = button.closest('.table-row');
      if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        setTimeout(() => {
          // Recharger les données
          window.location.reload();
        }, 300);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la candidature');
    }
  }

  /**
   * Gérer la relance
   */
  private async handleRelance(e: Event) {
    const button = e.currentTarget as HTMLButtonElement;
    const id = button.getAttribute('data-id');
    const email = button.getAttribute('data-email');

    if (!id || !email) return;

    try {
      // Enregistrer la relance
      await api.put(`/applications/${id}/send-relance`);

      // Ouvrir le client email
      const app = this.applications.find(a => a.id === parseInt(id));
      if (app) {
        const subject = encodeURIComponent(`Suite à ma candidature - ${app.poste}`);
        const body = encodeURIComponent(
          `Bonjour,\n\nJe me permets de revenir vers vous concernant ma candidature pour le poste de ${app.poste} au sein de ${app.company}, envoyée le ${app.date}.\n\nToujours très intéressé par cette opportunité, je souhaitais savoir si vous aviez eu l'occasion d'examiner mon dossier.\n\nJe reste à votre entière disposition pour un entretien à votre convenance.\n\nCordialement`
        );
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      }
    } catch (error) {
      console.error('Erreur lors de la relance:', error);
    }
  }

  /**
   * Obtenir la classe CSS pour un statut
   */
  private getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'Candidature envoyée': 'status-sent',
      'Entretien': 'status-interview',
      'Accepté': 'status-accepted',
      'Refusé': 'status-rejected',
      'En attente': 'status-waiting',
      'Relance': 'status-relance'
    };

    return statusMap[status] || 'status-waiting';
  }

  /**
   * Échapper le HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
