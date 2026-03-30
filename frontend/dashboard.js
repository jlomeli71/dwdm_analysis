/**
 * Módulo de Dashboard — KPIs, gráficas de barras, distribución de proveedores,
 * segmentos críticos y alertas de capacidad.
 */
import { API } from './api.js';

// Instancias de Chart.js para poder destruirlas al re-renderizar
let chartBar = null, chartBar2 = null, chartPie = null;

function destroyCharts() {
  [chartBar, chartBar2, chartPie].forEach(c => c && c.destroy());
  chartBar = chartBar2 = chartPie = null;
}

export async function renderDashboard(container) {
  destroyCharts();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard de Red</div>
        <div class="page-subtitle">Métricas en tiempo real — Proyecto Philadelphia</div>
      </div>
      <button class="btn btn-secondary" id="btn-refresh-dash">↻ Actualizar</button>
    </div>
    <div id="dash-inner">
      <div class="loading-spinner"><div class="spinner"></div><span>Cargando métricas…</span></div>
    </div>
  `;

  document.getElementById('btn-refresh-dash').addEventListener('click', () => loadDash());
  await loadDash();
}

async function loadDash() {
  const inner = document.getElementById('dash-inner');
  if (!inner) return;

  try {
    const [kpis, segUsage, providers] = await Promise.all([
      API.getKPIs(),
      API.getSegmentUsage(),
      API.getProviders(),
    ]);

    inner.innerHTML = buildDashHTML(kpis, segUsage, providers);
    renderCharts(segUsage, providers);

    // Alertas de capacidad
    const alertSegs = segUsage.filter(s => s.is_overloaded);
    if (alertSegs.length > 0) {
      const alertBanner = document.getElementById('alert-banner');
      if (alertBanner) {
        alertBanner.style.display = 'flex';
        alertBanner.querySelector('.alert-count').textContent = alertSegs.length;
      }
    }
  } catch (err) {
    inner.innerHTML = `<div class="error-state">Error al cargar datos: ${err.message || err.error || ''}</div>`;
  }
}

function buildDashHTML(kpis, segUsage, providers) {
  const alertSegs = segUsage.filter(s => s.is_overloaded);
  const top10 = segUsage.slice(0, 10);

  return `
    <!-- Alerta global -->
    <div id="alert-banner" class="alert-banner error" style="display:${alertSegs.length > 0 ? 'flex' : 'none'};gap:8px;align-items:center;margin-bottom:20px;">
      ⚠️ <b><span class="alert-count">${alertSegs.length}</span> segmento(s)</b> superan el 80% de capacidad (≥77 lambdas de 96)
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(45,139,255,0.15)">🏢</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.own_sites}</div>
          <div class="kpi-label">Sitios Propios</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(168,85,247,0.15)">🔗</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.third_party_sites}</div>
          <div class="kpi-label">Sitios Terceros</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(0,229,160,0.15)">⚡</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.total_lambdas}</div>
          <div class="kpi-label">Lambdas Activas</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(255,212,0,0.15)">🔆</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.total_capacity_tbps} Tbps</div>
          <div class="kpi-label">Capacidad Total</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(0,212,255,0.15)">🗂</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.total_segments}</div>
          <div class="kpi-label">Segmentos Únicos</div>
        </div>
      </div>
      <div class="kpi-card ${alertSegs.length > 0 ? 'kpi-alert' : ''}">
        <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">🔴</div>
        <div class="kpi-body">
          <div class="kpi-value">${kpis.alert_segments_count}</div>
          <div class="kpi-label">Segmentos en Alerta</div>
        </div>
      </div>
    </div>

    <!-- Gráficas -->
    <div class="charts-grid">
      <div class="card">
        <div class="card-title">Lambdas por segmento (Top 10)</div>
        <canvas id="chart-lambdas-por-seg" height="220"></canvas>
      </div>
      <div class="card">
        <div class="card-title">Capacidad por segmento — Gbps (Top 10)</div>
        <canvas id="chart-cap-por-seg" height="220"></canvas>
      </div>
      <div class="card">
        <div class="card-title">Distribución por proveedor de fibra</div>
        <canvas id="chart-providers" height="220"></canvas>
      </div>
    </div>

    <!-- Tabla segmentos más usados -->
    <div class="card" style="margin-top:0">
      <div class="card-title">Segmentos más utilizados</div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Segmento</th><th>Fibra</th><th>Proveedor</th>
            <th style="text-align:right">Lambdas</th>
            <th>Uso vs 96 ch.</th>
            <th>Estado</th>
          </tr></thead>
          <tbody>
            ${top10.map(s => `
              <tr>
                <td><code style="font-size:11px;color:var(--accent-cyan)">${s.site_a_id} ↔ ${s.site_b_id}</code></td>
                <td><span class="badge" style="background:rgba(45,139,255,0.15);color:var(--accent-blue)">${s.fiber}</span></td>
                <td>${s.fiber_provider || '—'}</td>
                <td style="text-align:right;font-weight:600">${s.usage_count}</td>
                <td style="min-width:140px">
                  <div class="progress-bar-wrap">
                    <div class="progress-bar-fill ${s.is_overloaded ? 'progress-alert' : s.usage_percent > 50 ? 'progress-warn' : 'progress-ok'}"
                         style="width:${Math.min(s.usage_percent, 100)}%"></div>
                  </div>
                  <span style="font-size:11px;color:var(--text-muted)">${s.usage_percent}%</span>
                </td>
                <td>${s.is_overloaded
                  ? '<span class="badge badge-alert">⚠️ ALERTA</span>'
                  : '<span class="badge badge-ok">✓ Normal</span>'
                }</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCharts(segUsage, providers) {
  const top10 = segUsage.slice(0, 10);
  const labels = top10.map(s => `${s.site_a_id}↔${s.site_b_id}\n(${s.fiber})`);
  const lambdaCounts = top10.map(s => s.usage_count);
  const capGbps = top10.map(s => s.capacity_gbps);
  const bgColors = top10.map(s => s.is_overloaded ? 'rgba(255,107,107,0.7)' : 'rgba(45,139,255,0.65)');
  const borderColors = top10.map(s => s.is_overloaded ? '#ff6b6b' : '#2d8bff');

  const chartDefaults = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#8892a4', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#8892a4', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
    },
  };

  // Bar 1 — lambdas por segmento
  const ctx1 = document.getElementById('chart-lambdas-por-seg');
  if (ctx1) {
    chartBar = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Lambdas',
          data: lambdaCounts,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} lambdas (${((ctx.parsed.y/96)*100).toFixed(1)}%)` } },
        },
        scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, max: 96, title: { display: true, text: 'Lambdas', color: '#8892a4' } } },
      },
    });
  }

  // Bar 2 — capacidad Gbps
  const ctx2 = document.getElementById('chart-cap-por-seg');
  if (ctx2) {
    chartBar2 = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gbps',
          data: capGbps,
          backgroundColor: 'rgba(0,229,160,0.55)',
          borderColor: '#00e5a0',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} Gbps` } },
        },
        scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, title: { display: true, text: 'Gbps', color: '#8892a4' } } },
      },
    });
  }

  // Donut — proveedores
  const ctx3 = document.getElementById('chart-providers');
  if (ctx3) {
    const provColors = [
      '#2d8bff','#00e5a0','#a855f7','#ff8c42','#ff69b4','#ffd400','#00d4ff','#ff6b6b','#3cb371','#b87333',
    ];
    chartPie = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: providers.map(p => p.provider),
        datasets: [{
          data: providers.map(p => p.count),
          backgroundColor: provColors.slice(0, providers.length),
          borderColor: '#151c28',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: '#c9d4e0', font: { size: 11 }, boxWidth: 14, padding: 12 },
          },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} segmentos` } },
        },
      },
    });
  }
}
