/**
 * Analytics Dashboard - Métriques avec Chart.js
 */

import type { Application } from '../main';
import { createIcons, BarChart2, Bell } from 'lucide';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  DoughnutController
} from 'chart.js';

// Enregistrer les composants Chart.js nécessaires
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  DoughnutController
);

interface StatusGroup {
  label: string;
  count: number;
  color: string;
}

interface WeekData {
  label: string;
  count: number;
}

export class AnalyticsDashboard {
  private container: HTMLElement | null;
  private charts: { [key: string]: Chart } = {};

  constructor(containerId: string = 'analyticsList') {
    this.container = document.getElementById(containerId);
  }

  public render(applications: Application[]) {
    if (!this.container) return;

    // Détruire les graphiques existants
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};

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

    // Créer les graphiques après le rendu HTML
    this.createCharts(applications);
    createIcons({ icons: { BarChart2, Bell } });
  }

  private createCharts(apps: Application[]) {
    // Graphique de l'activité hebdomadaire
    const weekCanvas = document.getElementById('weeklyChart') as HTMLCanvasElement;
    if (weekCanvas) {
      const weeks = this.getWeeklyData(apps, 8);
      this.charts['weekly'] = new Chart(weekCanvas, {
        type: 'bar',
        data: {
          labels: weeks.map(w => w.label),
          datasets: [{
            label: 'Candidatures',
            data: weeks.map(w => w.count),
            backgroundColor: '#3b82f6',
            borderRadius: 8,
            barThickness: 32,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => { const y = context.parsed.y ?? 0; return `${y} candidature${y > 1 ? 's' : ''}`; }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: '#6b7280' },
              grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            x: {
              ticks: { color: '#6b7280' },
              grid: { display: false }
            }
          }
        }
      });
    }

    // Graphique de répartition des statuts (Doughnut)
    const statusCanvas = document.getElementById('statusChart') as HTMLCanvasElement;
    if (statusCanvas) {
      const groups: StatusGroup[] = [
        { label: 'Envoyées', count: apps.filter(a => this.isSent(a)).length, color: '#3b82f6' },
        { label: 'En attente', count: apps.filter(a => this.isPending(a)).length, color: '#f59e0b' },
        { label: 'Entretiens', count: apps.filter(a => this.isInterview(a)).length, color: '#8b5cf6' },
        { label: 'Acceptées', count: apps.filter(a => this.isAccepted(a)).length, color: '#10b981' },
        { label: 'Refusées', count: apps.filter(a => this.isRejected(a)).length, color: '#ef4444' },
      ].filter(g => g.count > 0);

      this.charts['status'] = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: groups.map(g => g.label),
          datasets: [{
            data: groups.map(g => g.count),
            backgroundColor: groups.map(g => g.color),
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                padding: 15,
                font: { size: 13 },
                color: '#374151',
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => {
                  const total = groups.reduce((sum, g) => sum + g.count, 0);
                  const pct = Math.round((context.parsed / total) * 100);
                  return `${context.label}: ${context.parsed} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Graphique d'entonnoir de conversion (Bar horizontal)
    const funnelCanvas = document.getElementById('funnelChart') as HTMLCanvasElement;
    if (funnelCanvas) {
      const total = apps.length;
      const pending = apps.filter(a => this.isPending(a)).length;
      const interviews = apps.filter(a => this.isInterview(a)).length;
      const accepted = apps.filter(a => this.isAccepted(a)).length;

      this.charts['funnel'] = new Chart(funnelCanvas, {
        type: 'bar',
        data: {
          labels: ['Candidatures', 'En attente', 'Entretiens', 'Acceptées'],
          datasets: [{
            data: [total, pending, interviews, accepted],
            backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'],
            borderRadius: 6,
            barThickness: 40,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => {
                  const value = context.parsed.x ?? 0;
                  const prevValue = (context.dataIndex > 0 ? context.dataset.data[context.dataIndex - 1] as number : value) ?? 0;
                  const rate = prevValue > 0 ? Math.round((value / prevValue) * 100) : 100;
                  return `${value} candidatures (${context.dataIndex > 0 ? rate + '% du précédent' : '100%'})`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: '#6b7280' },
              grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            y: {
              ticks: { color: '#374151', font: { size: 13, weight: 500 } },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // ============================================
  // ENTONNOIR DE CONVERSION
  // ============================================
  private renderConversionFunnel(apps: Application[]): string {
    const total = apps.length;
    const interviews = apps.filter(a => this.isInterview(a)).length;
    const conversionRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

    return `
      <div class="analytics-card analytics-funnel-card">
        <div class="analytics-card-header">
          <h3><i data-lucide="bar-chart-2" class="analytics-header-icon"></i> Entonnoir de conversion</h3>
          <span class="analytics-card-subtitle">${conversionRate}% arrivent en entretien</span>
        </div>
        <div class="analytics-chart-container" style="height: 280px;">
          <canvas id="funnelChart"></canvas>
        </div>
      </div>
    `;
  }

  // ============================================
  // EFFICACITÉ DES RELANCES
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
      <div class="analytics-card analytics-relance-card">
        <div class="analytics-card-header">
          <h3><i data-lucide="bell" class="analytics-header-icon"></i> Efficacité des relances</h3>
          <span class="analytics-card-subtitle">${totalRelances} relances envoyées</span>
        </div>
        <div class="analytics-metrics-grid">
          <div class="analytics-metric">
            <div class="analytics-metric-value">${avgRelances}</div>
            <div class="analytics-metric-label">Relances / candidature</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value">${avgBeforeResponse}</div>
            <div class="analytics-metric-label">Relances avant réponse</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value analytics-metric-positive">${relanceRate}%</div>
            <div class="analytics-metric-label">Avec relance</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric-value">${noRelanceRate}%</div>
            <div class="analytics-metric-label">Sans relance</div>
          </div>
        </div>
        ${relanceRate > noRelanceRate ? `
          <div class="analytics-insight analytics-insight-positive">
            ✨ Les candidatures relancées ont +${relanceRate - noRelanceRate} points de réussite
          </div>
        ` : relanced.length > 0 ? `
          <div class="analytics-insight">
            📈 Continuez à relancer pour améliorer vos résultats
          </div>
        ` : `
          <div class="analytics-insight">
            💡 Commencez à relancer pour booster vos chances
          </div>
        `}
      </div>
    `;
  }

  // ============================================
  // ACTIVITÉ HEBDOMADAIRE
  // ============================================
  private renderWeeklyActivity(apps: Application[]): string {
    const weeks = this.getWeeklyData(apps, 8);
    const totalRecent = weeks.reduce((s, w) => s + w.count, 0);
    const avgPerWeek = weeks.length > 0 ? (totalRecent / weeks.length).toFixed(1) : '0';

    return `
      <div class="analytics-card analytics-activity-card">
        <div class="analytics-card-header">
          <h3>📅 Activité hebdomadaire</h3>
          <span class="analytics-card-subtitle">Moyenne ${avgPerWeek} / semaine</span>
        </div>
        <div class="analytics-chart-container" style="height: 260px;">
          <canvas id="weeklyChart"></canvas>
        </div>
      </div>
    `;
  }

  // ============================================
  // RÉPARTITION DES STATUTS
  // ============================================
  private renderStatusDistribution(apps: Application[]): string {
    return `
      <div class="analytics-card analytics-status-card">
        <div class="analytics-card-header">
          <h3>🎯 Répartition des statuts</h3>
          <span class="analytics-card-subtitle">${apps.length} candidatures</span>
        </div>
        <div class="analytics-chart-container" style="height: 300px;">
          <canvas id="statusChart"></canvas>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <path d="M3 3v18h18"/>
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
        </svg>
        <h3>Pas encore de données</h3>
        <p>Ajoutez des candidatures pour voir vos statistiques et l'efficacité de vos relances.</p>
      </div>
    `;
  }
}
