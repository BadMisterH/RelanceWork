/**
 * Kanban Board - Vue par colonnes de statut
 */

import type { Application } from '../main';
import {
  createIcons,
  Clock, Briefcase, CheckCircle, XCircle, MinusCircle,
  Bell, RefreshCw, Plus, ExternalLink, Search,
} from 'lucide';

const KANBAN_ICONS = {
  Clock, Briefcase, CheckCircle, XCircle, MinusCircle,
  Bell, RefreshCw, Plus, ExternalLink, Search,
};

export class KanbanBoard {
  private container: HTMLElement | null;
  private applications: Application[] = [];
  private searchTerm: string = '';
  private draggedCard: HTMLElement | null = null;
  private draggedAppId: number | null = null;

  constructor(containerId: string = 'applicationsList') {
    this.container = document.getElementById(containerId);
  }

  /**
   * Afficher le Kanban board
   */
  public render(applications: Application[]) {
    if (!this.container) return;

    this.applications = applications;

    // Filtrer par recherche
    let filtered = this.applications;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(app =>
        app.company.toLowerCase().includes(term) ||
        app.poste.toLowerCase().includes(term) ||
        app.status.toLowerCase().includes(term)
      );
    }

    const html = `
      ${this.renderSearchBar()}
      ${this.renderKanbanColumns(filtered)}
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
    createIcons({ icons: KANBAN_ICONS });
  }

  /**
   * Barre de recherche
   */
  private renderSearchBar(): string {
    return `
      <div class="kanban-header">
        <div class="kanban-header-left">
          <h2 class="kanban-title">Vue Kanban</h2>
          <span class="kanban-count">${this.applications.length} candidatures</span>
        </div>
        <div class="kanban-search-wrapper">
          <i data-lucide="search" class="kanban-search-icon"></i>
          <input
            type="text"
            placeholder="Rechercher..."
            id="kanbanSearch"
            class="kanban-search-input"
            value="${this.escapeHtml(this.searchTerm)}"
          />
        </div>
      </div>
    `;
  }

  /**
   * Colonnes Kanban
   */
  private renderKanbanColumns(applications: Application[]): string {
    const columns = [
      { key: 'waiting', label: 'En attente', icon: 'clock', color: '#f59e0b' },
      { key: 'interview', label: 'Entretien', icon: 'briefcase', color: '#8b5cf6' },
      { key: 'accepted', label: 'Accepté', icon: 'check-circle', color: '#10b981' },
      { key: 'rejected', label: 'Refusé', icon: 'x-circle', color: '#ef4444' },
      { key: 'no-response', label: 'Pas de réponse', icon: 'minus-circle', color: '#6b7280' },
    ];

    return `
      <div class="kanban-board">
        ${columns.map(col => this.renderColumn(col, applications)).join('')}
      </div>
    `;
  }

  /**
   * Une colonne Kanban
   */
  private renderColumn(column: { key: string; label: string; icon: string; color: string }, applications: Application[]): string {
    const filtered = applications.filter(app => this.getStatusClass(app.status) === column.key);
    const count = filtered.length;

    return `
      <div class="kanban-column" data-status="${column.key}" style="--column-color: ${column.color}">
        <div class="kanban-column-header">
          <div class="kanban-column-title">
            <span class="kanban-column-icon"><i data-lucide="${column.icon}"></i></span>
            <span class="kanban-column-label">${column.label}</span>
          </div>
          <span class="kanban-column-count">${count}</span>
        </div>
        <div class="kanban-column-content" data-status="${column.key}">
          ${filtered.length === 0
            ? this.renderEmptyColumn()
            : filtered.map((app, idx) => this.renderCard(app, idx)).join('')
          }
        </div>
      </div>
    `;
  }

  /**
   * Une carte de candidature
   */
  private renderCard(app: Application, animationIndex: number = 0): string {
    const statusClass = this.getStatusClass(app.status);
    const relanceText = app.relanced ? `${app.relance_count || 1}×` : '';

    return `
      <div class="kanban-card" draggable="true" data-app-id="${app.id}" data-status="${statusClass}" style="animation-delay: ${animationIndex * 40}ms">
        <div class="kanban-card-header">
          <div class="kanban-card-company">
            <div class="kanban-card-avatar">${app.company.charAt(0).toUpperCase()}</div>
            <div class="kanban-card-company-info">
              <div class="kanban-card-company-name">${this.escapeHtml(app.company)}</div>
              ${app.company_website ? `
                <a href="${this.escapeHtml(app.company_website)}" target="_blank" rel="noopener" class="kanban-card-link" onclick="event.stopPropagation()">
                  <i data-lucide="external-link"></i>
                </a>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="kanban-card-body">
          <div class="kanban-card-poste">${this.escapeHtml(app.poste)}</div>
          ${app.company_description ? `
            <div class="kanban-card-description">${this.escapeHtml(app.company_description).substring(0, 100)}${app.company_description.length > 100 ? '...' : ''}</div>
          ` : ''}
        </div>

        <div class="kanban-card-footer">
          <span class="kanban-card-date">${this.formatDate(app.date)}</span>
          ${app.relanced ? `<span class="kanban-card-relance" title="${app.relance_count || 1} relance(s)"><i data-lucide="bell"></i> ${relanceText}</span>` : ''}
        </div>

        <div class="kanban-card-actions">
          <button class="kanban-card-action" data-action="relance" data-id="${app.id}" title="Relancer">
            <i data-lucide="refresh-cw"></i>
          </button>
          ${app.company_website && !app.company_description ? `
            <button class="kanban-card-action" data-action="enrich" data-id="${app.id}" data-website="${this.escapeHtml(app.company_website)}" title="Enrichir">
              <i data-lucide="plus"></i>
            </button>
          ` : ''}
          <button class="kanban-card-action kanban-card-action-delete" data-action="delete" data-id="${app.id}" title="Supprimer">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Colonne vide
   */
  private renderEmptyColumn(): string {
    return `
      <div class="kanban-empty-column">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p>Aucune candidature</p>
      </div>
    `;
  }

  /**
   * Classe CSS selon le statut
   */
  private getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('envoyée') || s.includes('candidature') || s.includes('postul') || s.includes('attente')) return 'waiting';
    if (s.includes('entretien')) return 'interview';
    if (s.includes('accepté') || s.includes('proposé')) return 'accepted';
    if (s.includes('refusé')) return 'rejected';
    if (s.includes('pas de réponse') || s.includes('retiré')) return 'no-response';
    return 'waiting';
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
      month: 'short'
    });
  }

  /**
   * Échapper le HTML
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
    const searchInput = document.getElementById('kanbanSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.render(this.applications);
      });
    }

    // Actions
    document.querySelectorAll('.kanban-card-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'relance') {
          this.handleRelance(Number(id));
        } else if (action === 'delete') {
          this.handleDelete(Number(id));
        } else if (action === 'enrich') {
          const website = target.dataset.website;
          this.handleEnrich(Number(id), website || '');
        }
      });
    });

    // Drag & Drop
    this.attachDragDropListeners();
  }

  /**
   * Drag & Drop
   */
  private attachDragDropListeners() {
    // Cartes draggables
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.draggedCard = e.currentTarget as HTMLElement;
        this.draggedAppId = Number(this.draggedCard.dataset.appId);
        this.draggedCard.classList.add('dragging');

        // Autoriser le drop sur toutes les colonnes
        document.querySelectorAll('.kanban-column-content').forEach(col => {
          col.classList.add('drag-active');
        });
      });

      card.addEventListener('dragend', () => {
        if (this.draggedCard) {
          this.draggedCard.classList.remove('dragging');
          this.draggedCard = null;
          this.draggedAppId = null;
        }

        document.querySelectorAll('.kanban-column-content').forEach(col => {
          col.classList.remove('drag-active', 'drag-over');
        });
      });
    });

    // Zones de drop
    document.querySelectorAll('.kanban-column-content').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });

      column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over', 'drag-active');

        const targetStatus = (column as HTMLElement).dataset.status;
        const currentStatus = this.draggedCard?.dataset.status;

        if (this.draggedAppId && targetStatus && targetStatus !== currentStatus) {
          // Ajouter l'animation de drop réussi
          column.classList.add('drop-success');
          setTimeout(() => {
            column.classList.remove('drop-success');
          }, 600);

          await this.handleStatusChange(this.draggedAppId, targetStatus);
        }
      });
    });
  }

  /**
   * Gérer le changement de statut
   */
  private async handleStatusChange(id: number, newStatusKey: string) {
    const statusMap: { [key: string]: string } = {
      'waiting': 'En attente',
      'interview': 'Entretien',
      'accepted': 'Accepté',
      'rejected': 'Refusé',
      'no-response': 'Pas de réponse',
    };

    const newStatus = statusMap[newStatusKey];
    if (!newStatus) return;

    const event = new CustomEvent('status-change', { detail: { id, status: newStatus } });
    window.dispatchEvent(event);
  }

  /**
   * Gérer la relance
   */
  private handleRelance(id: number) {
    const event = new CustomEvent('relance-application', { detail: { id } });
    window.dispatchEvent(event);
  }

  /**
   * Gérer l'enrichissement entreprise
   */
  private handleEnrich(id: number, website: string) {
    const event = new CustomEvent('enrich-company', { detail: { id, website } });
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
