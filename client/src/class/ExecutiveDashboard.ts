/**
 * Executive Dashboard - Notion-Inspired Clean Interface
 * Aesthetic: Modern, minimal, professional
 */

import type { Application } from '../main';

export class ExecutiveDashboard {
  private container: HTMLElement | null;
  private applications: Application[] = [];
  private filteredApplications: Application[] = [];
  private searchTerm: string = '';

  constructor(containerId: string = 'applicationsList') {
    this.container = document.getElementById(containerId);
  }

  /**
   * Affiche le dashboard
   */
  public render(applications: Application[]) {
    if (!this.container) return;

    this.applications = applications;
    this.filteredApplications = applications;

    const html = `
      ${this.renderStats()}
      ${this.renderTrackingTable()}
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
    this.updateStatsNumbers();
  }

  /**
   * Cartes de statistiques
   */
  private renderStats(): string {
    const stats = this.calculateStats();

    return `
      <div class="dash-stats-grid">
        <div class="dash-stat-card dash-stat-total" data-stat="total">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">📊</span>
            <span class="dash-stat-label">Total</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.total}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">Candidatures</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-pending" data-stat="pending">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">⏳</span>
            <span class="dash-stat-label">En attente</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.pending}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.pendingPercent}% du total</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-interview" data-stat="interview">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">💼</span>
            <span class="dash-stat-label">Entretiens</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.interviews}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.interviewRate}% de conversion</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-accepted" data-stat="accepted">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">✅</span>
            <span class="dash-stat-label">Acceptées</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.accepted}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.successRate}% de réussite</span>
          </div>
        </div>

        <div class="dash-stat-card dash-stat-relance" data-stat="relance">
          <div class="dash-stat-header">
            <span class="dash-stat-icon">🔔</span>
            <span class="dash-stat-label">À relancer</span>
          </div>
          <div class="dash-stat-value" data-count="${stats.toRelance}">0</div>
          <div class="dash-stat-footer">
            <span class="dash-stat-subtitle">${stats.relancePercent}% nécessitent action</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tableau de suivi
   */
  private renderTrackingTable(): string {
    const apps = this.filteredApplications;

    return `
      <div class="dash-table-section">
        <div class="dash-table-header">
          <div class="dash-table-title-wrapper">
            <h2 class="dash-table-title">Mes Candidatures</h2>
            <span class="dash-table-count">${apps.length}</span>
          </div>
          <div class="dash-table-controls">
            <div class="dash-search-wrapper">
              <svg class="dash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Rechercher une entreprise ou un poste..."
                id="dashTableSearch"
                class="dash-search-input"
              />
            </div>
          </div>
        </div>

        <div class="dash-table-wrapper">
          ${apps.length === 0 ? this.renderEmptyState() : this.renderTable(apps)}
        </div>
      </div>
    `;
  }

  /**
   * Tableau HTML
   */
  private renderTable(apps: Application[]): string {
    return `
      <table class="dash-table">
        <thead>
          <tr>
            <th class="dash-th dash-th-company">Entreprise</th>
            <th class="dash-th dash-th-poste">Poste</th>
            <th class="dash-th dash-th-status">Statut</th>
            <th class="dash-th dash-th-date">Date</th>
            <th class="dash-th dash-th-relance">Relances</th>
            <th class="dash-th dash-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map((app, index) => this.renderTableRow(app, index)).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Ligne de tableau
   */
  private renderTableRow(app: Application, index: number): string {
    const statusClass = this.getStatusClass(app.status);
    const statusEmoji = this.getStatusEmoji(app.status);
    const relanceText = app.relanced ? `${app.relance_count || 1}×` : '—';
    const relanceClass = app.relanced ? 'dash-has-relance' : '';

    return `
      <tr class="dash-table-row" data-app-id="${app.id}" style="animation-delay: ${index * 0.03}s">
        <td class="dash-td dash-td-company">
          <div class="dash-company-wrapper">
            <div class="dash-company-avatar">${app.company.charAt(0).toUpperCase()}</div>
            <span class="dash-company-name">${this.escapeHtml(app.company)}</span>
          </div>
        </td>
        <td class="dash-td dash-td-poste">
          <span class="dash-poste-text">${this.escapeHtml(app.poste)}</span>
        </td>
        <td class="dash-td dash-td-status">
          <span class="dash-status-badge dash-status-${statusClass}">
            <span class="dash-status-icon">${statusEmoji}</span>
            <span class="dash-status-text">${this.escapeHtml(app.status)}</span>
          </span>
        </td>
        <td class="dash-td dash-td-date">
          <span class="dash-date-text">${this.formatDate(app.date)}</span>
        </td>
        <td class="dash-td dash-td-relance">
          <span class="dash-relance-badge ${relanceClass}">
            ${app.relanced ? '🔔' : '—'} ${relanceText}
          </span>
        </td>
        <td class="dash-td dash-td-actions">
          <div class="dash-actions-group">
            <button
              class="dash-action-btn dash-btn-relance"
              data-action="relance"
              data-id="${app.id}"
              title="Relancer cette candidature"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Relancer
            </button>
            <button
              class="dash-action-btn dash-btn-delete"
              data-action="delete"
              data-id="${app.id}"
              title="Supprimer cette candidature"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * État vide
   */
  private renderEmptyState(): string {
    return `
      <div class="dash-empty-state">
        <div class="dash-empty-icon">📭</div>
        <div class="dash-empty-title">Aucune candidature trouvée</div>
        <div class="dash-empty-text">
          ${this.searchTerm
            ? `Aucun résultat pour "${this.escapeHtml(this.searchTerm)}"`
            : 'Commencez par ajouter votre première candidature'
          }
        </div>
      </div>
    `;
  }

  /**
   * Calcul des statistiques
   */
  private calculateStats() {
    const total = this.applications.length;
    const pending = this.applications.filter(a =>
      a.status.toLowerCase().includes('attente') ||
      a.status.toLowerCase().includes('envoyée') ||
      a.status.toLowerCase().includes('postul')
    ).length;
    const interviews = this.applications.filter(a =>
      a.status.toLowerCase().includes('entretien')
    ).length;
    const accepted = this.applications.filter(a =>
      a.status.toLowerCase().includes('accepté') ||
      a.status.toLowerCase().includes('proposé')
    ).length;
    const toRelance = this.applications.filter(a => !a.relanced &&
      !a.status.toLowerCase().includes('accepté') &&
      !a.status.toLowerCase().includes('refusé') &&
      !a.status.toLowerCase().includes('retiré')
    ).length;

    return {
      total,
      pending,
      interviews,
      accepted,
      toRelance,
      pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
      interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 0,
      successRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      relancePercent: total > 0 ? Math.round((toRelance / total) * 100) : 0
    };
  }

  /**
   * Classe CSS selon le statut
   */
  private getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return 'sent';
    if (s.includes('entretien')) return 'interview';
    if (s.includes('accepté') || s.includes('proposé')) return 'accepted';
    if (s.includes('refusé')) return 'rejected';
    if (s.includes('attente')) return 'waiting';
    if (s.includes('retiré')) return 'retired';
    return 'sent';
  }

  /**
   * Emoji selon le statut
   */
  private getStatusEmoji(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul')) return '📤';
    if (s.includes('entretien')) return '💼';
    if (s.includes('accepté') || s.includes('proposé')) return '✅';
    if (s.includes('refusé')) return '❌';
    if (s.includes('attente')) return '⏳';
    if (s.includes('retiré')) return '🔙';
    return '📧';
  }

  /**
   * Formatage de date relatif
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '—';

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Animation des chiffres
   */
  private animateNumber(element: HTMLElement, target: number) {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * easeOut);

      element.textContent = current.toString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = target.toString();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Mettre à jour les chiffres des stats avec animation
   */
  private updateStatsNumbers() {
    const statValues = document.querySelectorAll('.dash-stat-value');
    statValues.forEach(element => {
      const target = parseInt((element as HTMLElement).dataset.count || '0');
      this.animateNumber(element as HTMLElement, target);
    });
  }

  /**
   * Échapper le HTML pour éviter les injections XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Gestion des événements
   */
  private attachEventListeners() {
    // Recherche
    const searchInput = document.getElementById('dashTableSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.filterApplications();
      });
    }

    // Actions (Relancer / Supprimer)
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'relance') {
          this.handleRelance(Number(id));
        } else if (action === 'delete') {
          this.handleDelete(Number(id));
        }
      });
    });
  }

  /**
   * Filtrer les candidatures
   */
  private filterApplications() {
    this.filteredApplications = this.applications.filter(app => {
      const matchSearch = !this.searchTerm ||
        app.company.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        app.poste.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        app.status.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchSearch;
    });

    this.render(this.applications);
  }

  /**
   * Gérer la relance
   */
  private handleRelance(id: number) {
    const event = new CustomEvent('relance-application', { detail: { id } });
    window.dispatchEvent(event);
  }

  /**
   * Gérer la suppression
   */
  private handleDelete(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette candidature ?')) {
      const event = new CustomEvent('delete-application', { detail: { id } });
      window.dispatchEvent(event);
    }
  }
}
