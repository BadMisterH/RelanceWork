/**
 * Analytics Dashboard - Metriques de conversion et efficacite des relances
 * Calculs 100% frontend a partir des donnees existantes
 */

import type { Application } from '../main';

interface StatusGroup {
  label: string;
  count: number;
  color: string;
  emoji: string;
}

interface WeekData {
  label: string;
  count: number;
}

export class AnalyticsDashboard {
  private container: HTMLElement | null;

  constructor(containerId: string = 'analyticsList') {
    this.container = document.getElementById(containerId);
  }

  public render(applications: Application[]) {
    if (!this.container) return;

    if (applications.length === 0) {
      this.container.innerHTML = this.renderEmptyState();
      return;
    }

    this.container.innerHTML = `
      <div class="analytics-grid">
        ${this.renderConversionFunnel(applications)}
        ${this.renderRelanceMetrics(applications)}
        ${this.renderWeeklyActivity(applications)}
        ${this.renderStatusDistribution(applications)}
      </div>
    `;
  }

  // ============================================
  // ENTONNOIR DE CONVERSION
  // ============================================
  private renderConversionFunnel(apps: Application[]): string {
    const total = apps.length;
    const pending = apps.filter(a => this.isPending(a)).length;
    const interviews = apps.filter(a => this.isInterview(a)).length;
    const accepted = apps.filter(a => this.isAccepted(a)).length;

    const stages = [
      { label: 'Candidatures envoyees', count: total, color: '#3b82f6' },
      { label: 'En attente de reponse', count: pending, color: '#f59e0b' },
      { label: 'Entretiens obtenus', count: interviews, color: '#8b5cf6' },
      { label: 'Acceptees', count: accepted, color: '#10b981' },
    ];

    const maxCount = Math.max(total, 1);

    return `
      <div class="analytics-card analytics-funnel">
        <div class="analytics-card-header">
          <h3>Entonnoir de conversion</h3>
          <span class="analytics-card-subtitle">${total > 0 ? Math.round((interviews / total) * 100) : 0}% arrivent en entretien</span>
        </div>
        <div class="analytics-funnel-stages">
          ${stages.map((stage, i) => {
            const width = Math.max((stage.count / maxCount) * 100, 4);
            const rate = i > 0 && stages[i - 1]!.count > 0
              ? Math.round((stage.count / stages[i - 1]!.count) * 100)
              : 100;
            return `
              <div class="analytics-funnel-row">
                <div class="analytics-funnel-label">
                  <span>${stage.label}</span>
                  <strong>${stage.count}</strong>
                </div>
                <div class="analytics-funnel-bar-wrapper">
                  <div class="analytics-funnel-bar" style="width:${width}%; background:${stage.color};"></div>
                </div>
                ${i > 0 ? `<span class="analytics-funnel-rate">${rate}%</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============================================
  // EFFICACITE DES RELANCES
  // ============================================
  private renderRelanceMetrics(apps: Application[]): string {
    const relanced = apps.filter(a => a.relance_count > 0);
    const notRelanced = apps.filter(a => a.relance_count === 0);

    const relancedWithInterview = relanced.filter(a => this.isInterview(a) || this.isAccepted(a)).length;
    const notRelancedWithInterview = notRelanced.filter(a => this.isInterview(a) || this.isAccepted(a)).length;

    const relanceRate = relanced.length > 0
      ? Math.round((relancedWithInterview / relanced.length) * 100) : 0;
    const noRelanceRate = notRelanced.length > 0
      ? Math.round((notRelancedWithInterview / notRelanced.length) * 100) : 0;

    const totalRelances = apps.reduce((sum, a) => sum + a.relance_count, 0);
    const avgRelances = relanced.length > 0
      ? (totalRelances / relanced.length).toFixed(1) : '0';

    const avgRelancesBeforeInterview = relanced.filter(a => this.isInterview(a) || this.isAccepted(a));
    const avgBeforeResponse = avgRelancesBeforeInterview.length > 0
      ? (avgRelancesBeforeInterview.reduce((s, a) => s + a.relance_count, 0) / avgRelancesBeforeInterview.length).toFixed(1)
      : '-';

    return `
      <div class="analytics-card analytics-relance">
        <div class="analytics-card-header">
          <h3>Efficacite des relances</h3>
          <span class="analytics-card-subtitle">${totalRelances} relances envoyees au total</span>
        </div>
        <div class="analytics-metrics-grid">
          <div class="analytics-metric">
            <div class="analytics-metric-value">${avgRelances}</div>
            <div class="analytics-metric-label">Relances / candidature</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value">${avgBeforeResponse}</div>
            <div class="analytics-metric-label">Relances avant reponse</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value analytics-metric-positive">${relanceRate}%</div>
            <div class="analytics-metric-label">Taux reponse avec relance</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value">${noRelanceRate}%</div>
            <div class="analytics-metric-label">Taux reponse sans relance</div>
          </div>
        </div>
        ${relanceRate > noRelanceRate ? `
          <div class="analytics-insight analytics-insight-positive">
            Les candidatures relancees ont ${relanceRate - noRelanceRate} points de plus de chances d'obtenir un entretien.
          </div>
        ` : relanced.length > 0 ? `
          <div class="analytics-insight">
            Continuez a relancer - les resultats s'ameliorent avec le volume de donnees.
          </div>
        ` : `
          <div class="analytics-insight">
            Commencez a relancer vos candidatures pour voir l'impact sur vos reponses.
          </div>
        `}
      </div>
    `;
  }

  // ============================================
  // RYTHME DE CANDIDATURE (8 dernieres semaines)
  // ============================================
  private renderWeeklyActivity(apps: Application[]): string {
    const weeks = this.getWeeklyData(apps, 8);
    const maxCount = Math.max(...weeks.map(w => w.count), 1);

    const totalRecent = weeks.reduce((s, w) => s + w.count, 0);
    const avgPerWeek = weeks.length > 0 ? (totalRecent / weeks.length).toFixed(1) : '0';

    return `
      <div class="analytics-card analytics-activity">
        <div class="analytics-card-header">
          <h3>Rythme de candidature</h3>
          <span class="analytics-card-subtitle">Moyenne ${avgPerWeek} / semaine</span>
        </div>
        <div class="analytics-weeks">
          ${weeks.map(week => {
            const width = Math.max((week.count / maxCount) * 100, 2);
            return `
              <div class="analytics-week-row">
                <span class="analytics-week-label">${week.label}</span>
                <div class="analytics-week-bar-wrapper">
                  <div class="analytics-week-bar" style="width:${width}%;"></div>
                </div>
                <span class="analytics-week-count">${week.count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============================================
  // REPARTITION DES STATUTS
  // ============================================
  private renderStatusDistribution(apps: Application[]): string {
    const groups: StatusGroup[] = [
      { label: 'Envoyees', count: apps.filter(a => this.isSent(a)).length, color: '#3b82f6', emoji: '📤' },
      { label: 'En attente', count: apps.filter(a => this.isPending(a)).length, color: '#f59e0b', emoji: '⏳' },
      { label: 'Entretiens', count: apps.filter(a => this.isInterview(a)).length, color: '#8b5cf6', emoji: '💼' },
      { label: 'Acceptees', count: apps.filter(a => this.isAccepted(a)).length, color: '#10b981', emoji: '✅' },
      { label: 'Refusees', count: apps.filter(a => this.isRejected(a)).length, color: '#ef4444', emoji: '❌' },
    ];

    const total = apps.length;

    return `
      <div class="analytics-card analytics-status">
        <div class="analytics-card-header">
          <h3>Repartition des statuts</h3>
          <span class="analytics-card-subtitle">${total} candidatures au total</span>
        </div>

        <div class="analytics-status-bar">
          ${groups.filter(g => g.count > 0).map(g => {
            const pct = Math.round((g.count / total) * 100);
            return `<div class="analytics-status-segment" style="width:${pct}%; background:${g.color};" title="${g.label}: ${g.count} (${pct}%)"></div>`;
          }).join('')}
        </div>

        <div class="analytics-status-legend">
          ${groups.map(g => {
            const pct = total > 0 ? Math.round((g.count / total) * 100) : 0;
            return `
              <div class="analytics-status-item">
                <span class="analytics-status-dot" style="background:${g.color};"></span>
                <span class="analytics-status-label">${g.emoji} ${g.label}</span>
                <span class="analytics-status-count">${g.count}</span>
                <span class="analytics-status-pct">${pct}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ============================================
  // HELPERS
  // ============================================

  private isSent(a: Application): boolean {
    const s = a.status.toLowerCase();
    return s.includes('envoyée') || s.includes('candidature') || s.includes('postul');
  }

  private isPending(a: Application): boolean {
    const s = a.status.toLowerCase();
    return s.includes('attente') || s.includes('envoyée') || s.includes('postul');
  }

  private isInterview(a: Application): boolean {
    return a.status.toLowerCase().includes('entretien');
  }

  private isAccepted(a: Application): boolean {
    const s = a.status.toLowerCase();
    return s.includes('accepté') || s.includes('proposé');
  }

  private isRejected(a: Application): boolean {
    return a.status.toLowerCase().includes('refusé');
  }

  private parseDate(dateStr: string): Date | null {
    // Format JJ/MM/AAAA
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]!, 10);
      const month = parseInt(parts[1]!, 10) - 1;
      const year = parseInt(parts[2]!, 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    // Fallback ISO
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  private getWeeklyData(apps: Application[], numWeeks: number): WeekData[] {
    const now = new Date();
    const weeks: WeekData[] = [];

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);

      const count = apps.filter(a => {
        const d = this.parseDate(a.date);
        return d && d >= weekStart && d <= weekEnd;
      }).length;

      const startDay = weekStart.getDate();
      const startMonth = weekStart.toLocaleDateString('fr-FR', { month: 'short' });

      weeks.push({
        label: `${startDay} ${startMonth}`,
        count,
      });
    }

    return weeks;
  }

  private renderEmptyState(): string {
    return `
      <div class="analytics-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 3v18h18"/>
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
        </svg>
        <h3>Pas encore de donnees</h3>
        <p>Ajoutez des candidatures pour voir vos statistiques de conversion et l'efficacite de vos relances.</p>
      </div>
    `;
  }
}
