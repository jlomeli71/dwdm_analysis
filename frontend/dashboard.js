/**
 * Módulo de Dashboard — KPIs, gráficas de barras, distribución de proveedores,
 * segmentos críticos y alertas de capacidad.
 */
import { API } from './api.js';

// Instancias de Chart.js para poder destruirlas al re-renderizar
let chartBar = null, chartBar2 = null, chartPie = null, chartISP = null;

// Caché de datos y modo de etiqueta actual
let _cachedKpis = null, _cachedSeg = null, _cachedProv = null;
let _dashLabel = 'id'; // 'id' | 'name'

function destroyCharts() {
  [chartBar, chartBar2, chartPie, chartISP].forEach(c => c && c.destroy());
  chartBar = chartBar2 = chartPie = null;
}

/** Devuelve la etiqueta de un segmento según el modo activo. */
function segLabel(s) {
  return _dashLabel === 'name'
    ? `${s.site_a_name} ↔ ${s.site_b_name}`
    : `${s.site_a_id} ↔ ${s.site_b_id}`;
}

export async function renderDashboard(container) {
  destroyCharts();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard de Red</div>
        <div class="page-subtitle">Métricas en tiempo real — Red ISP Tx</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <div class="topo-toggle" id="dash-label-toggle">
          <button data-label="id"  class="${_dashLabel==='id'  ? 'active' : ''}">Site ID</button>
          <button data-label="name" class="${_dashLabel==='name' ? 'active' : ''}">Nombre</button>
        </div>
        <button class="btn btn-secondary" id="btn-refresh-dash">↻ Actualizar</button>
      </div>
    </div>
    <div id="dash-inner">
      <div class="loading-spinner"><div class="spinner"></div><span>Cargando métricas…</span></div>
    </div>
  `;

  document.getElementById('btn-refresh-dash').addEventListener('click', () => loadDash(true));

  document.getElementById('dash-label-toggle').addEventListener('click', e => {
    const btn = e.target.closest('button[data-label]');
    if (!btn || btn.dataset.label === _dashLabel) return;
    _dashLabel = btn.dataset.label;
    document.querySelectorAll('#dash-label-toggle button').forEach(b =>
      b.classList.toggle('active', b.dataset.label === _dashLabel)
    );
    // Re-renderizar desde caché sin refetch
    if (_cachedKpis) renderFromCache();
  });

  await loadDash(true);
}

async function loadDash(forceRefetch = false) {
  const inner = document.getElementById('dash-inner');
  if (!inner) return;

  try {
    if (forceRefetch || !_cachedKpis) {
      [_cachedKpis, _cachedSeg, _cachedProv] = await Promise.all([
        API.getKPIs(),
        API.getSegmentUsage(),
        API.getProviders(),
      ]);
    }
    renderFromCache();
    await renderISPSection(forceRefetch);
  } catch (err) {
    inner.innerHTML = `<div class="error-state">Error al cargar datos: ${err.message || err.error || ''}</div>`;
  }
}

function renderFromCache() {
  const inner = document.getElementById('dash-inner');
  if (!inner || !_cachedKpis) return;
  destroyCharts();
  inner.innerHTML = buildDashHTML(_cachedKpis, _cachedSeg, _cachedProv);
  renderCharts(_cachedSeg, _cachedProv);

  const alertSegs = _cachedSeg.filter(s => s.is_overloaded);
  const alertBanner = document.getElementById('alert-banner');
  if (alertBanner) {
    alertBanner.style.display = alertSegs.length > 0 ? 'flex' : 'none';
    const cnt = alertBanner.querySelector('.alert-count');
    if (cnt) cnt.textContent = alertSegs.length;
  }
}

function buildDashHTML(kpis, segUsage, providers) {
  const alertSegs = segUsage.filter(s => s.is_overloaded);
  const top10     = segUsage.slice(0, 10);

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
                <td><code style="font-size:11px;color:var(--accent-cyan)">${segLabel(s)}</code></td>
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
  const top10  = segUsage.slice(0, 10);
  const labels = top10.map(s => `${segLabel(s)}\n(${s.fiber})`);
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
        scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, max: 20, title: { display: true, text: 'Lambdas', color: '#8892a4' } } },
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

// ── Sección Capa IP / ISP ─────────────────────────────────────────────────────
let _cachedRouters = null, _cachedFlows = null, _cachedISPProv = null;

async function renderISPSection(forceRefetch = false) {
  const inner = document.getElementById('dash-inner');
  if (!inner) return;

  try {
    if (forceRefetch || !_cachedRouters) {
      [_cachedRouters, _cachedFlows, _cachedISPProv] = await Promise.all([
        API.getRouters(),
        API.getTrafficFlows(),
        API.getISPProviders(),
      ]);
    }
  } catch { return; }  // No bloquear el dashboard si la API ISP falla

  const routers = _cachedRouters;
  const flows   = _cachedFlows;
  const isps    = _cachedISPProv;

  // Calcular utilización por proveedor
  const provUtil = {};  // provider_name → { total_ifaces, used_ifaces, color }
  isps.forEach(p => { provUtil[p.name] = { total: 0, used: 0, color: p.color }; });
  routers.forEach(r => {
    r.interfaces.filter(i => i.iface_type === "isp").forEach(iface => {
      const prov = isps.find(p => p.id === iface.isp_provider_id);
      if (prov) provUtil[prov.name].total++;
    });
  });
  flows.forEach(f => {
    if (f.isp_provider_name && provUtil[f.isp_provider_name]) {
      provUtil[f.isp_provider_name].used += f.interfaces_count;
    }
  });

  // Utilización por sitio ingress
  const siteUtil = {};  // site_id → { name, total, used, providers: [] }
  routers.forEach(r => {
    const ispIfaces = r.interfaces.filter(i => i.iface_type === "isp");
    if (!ispIfaces.length) return;
    if (!siteUtil[r.site_id]) siteUtil[r.site_id] = { name: r.site_name, total: 0, used: 0 };
    siteUtil[r.site_id].total += ispIfaces.length;
  });
  flows.forEach(f => {
    if (siteUtil[f.ingress_site_id]) {
      siteUtil[f.ingress_site_id].used += f.interfaces_count;
    }
  });

  const totalTrafficGbps = flows.reduce((s, f) => s + f.interfaces_count * 100, 0);
  const totalCapGbps     = Object.values(provUtil).reduce((s, p) => s + p.total * 100, 0);

  // Construir HTML
  const section = document.createElement("div");
  section.className = "dash-isp-section";
  section.innerHTML = `
    <div class="dash-section-title">🌐 Capa IP / ISP</div>
    <div class="dash-isp-kpis">
      <div class="kpi-card">
        <div class="kpi-value">${isps.length}</div>
        <div class="kpi-label">Proveedores ISP</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${routers.length}</div>
        <div class="kpi-label">Ruteadores</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(totalTrafficGbps / 1000).toFixed(1)} Tbps</div>
        <div class="kpi-label">Tráfico configurado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${totalCapGbps > 0 ? Math.round((totalTrafficGbps / totalCapGbps) * 100) : 0}%</div>
        <div class="kpi-label">Uso capacidad ISP</div>
      </div>
    </div>

    <div class="dash-isp-body">
      <!-- Utilización por proveedor -->
      <div class="dash-card">
        <div class="dash-card-title">Utilización por Proveedor ISP</div>
        <div class="isp-prov-list">
          ${Object.entries(provUtil).map(([name, p]) => {
            const pct = p.total > 0 ? Math.round((p.used / p.total) * 100) : 0;
            const barColor = pct >= 80 ? "var(--accent-red)" : pct >= 60 ? "var(--accent-orange)" : p.color;
            return `<div class="isp-prov-row">
              <span class="isp-prov-dot" style="background:${p.color}"></span>
              <span class="isp-prov-name">${name}</span>
              <div class="isp-prov-bar-wrap">
                <div class="isp-prov-bar" style="width:${pct}%;background:${barColor}"></div>
              </div>
              <span class="isp-prov-stat">${p.used}/${p.total} ifaces</span>
              <span class="isp-prov-pct" style="color:${barColor}">${pct}%</span>
            </div>`;
          }).join("")}
        </div>
      </div>

      <!-- Utilización por sitio -->
      <div class="dash-card">
        <div class="dash-card-title">Utilización por Sitio (Ingress)</div>
        <table class="dash-table" style="width:100%">
          <thead><tr>
            <th>Sitio</th><th>Ifaces ISP</th><th>En uso</th><th>% Uso</th>
          </tr></thead>
          <tbody>
            ${Object.entries(siteUtil).map(([sid, s]) => {
              const pct = s.total > 0 ? Math.round((s.used / s.total) * 100) : 0;
              const c = pct >= 80 ? "var(--accent-red)" : pct >= 60 ? "var(--accent-orange)" : "var(--accent-green)";
              return `<tr>
                <td>${s.name}</td>
                <td style="text-align:center">${s.total}</td>
                <td style="text-align:center">${s.used}</td>
                <td style="color:${c};font-weight:600;text-align:center">${pct}%
                  ${pct >= 80 ? '<span style="color:var(--accent-red)"> ⚠</span>' : ""}
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detalle Proveedores ISP por Sitio -->
    <div class="dash-card" style="margin-top:16px;">
      <div class="dash-card-title">Detalle Proveedores ISP por Sitio</div>
      <table class="dash-table" style="width:100%">
        <thead><tr>
          <th>Proveedor ISP</th><th>Sitio</th><th style="text-align:right">Interfaces</th><th style="text-align:right">Capacidad (Gbps)</th>
        </tr></thead>
        <tbody>
          ${(() => {
            // Construir filas: por cada router, por cada interfaz ISP → proveedor + sitio + capacidad
            const rows = [];
            routers.forEach(r => {
              const ispIfaces = (r.interfaces || []).filter(i => i.iface_type === 'isp');
              // Agrupar por proveedor dentro del mismo router
              const byProv = {};
              ispIfaces.forEach(iface => {
                const prov = isps.find(p => p.id === iface.isp_provider_id);
                if (!prov) return;
                const key = `${prov.id}__${r.site_id}`;
                if (!byProv[key]) byProv[key] = { provName: prov.name, provColor: prov.color, siteName: r.site_name || r.site_id, count: 0 };
                byProv[key].count++;
              });
              Object.values(byProv).forEach(v => rows.push(v));
            });
            // Ordenar por proveedor, luego por sitio
            rows.sort((a, b) => a.provName.localeCompare(b.provName) || a.siteName.localeCompare(b.siteName));
            if (!rows.length) return '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Sin datos</td></tr>';
            return rows.map(row => `<tr>
              <td><span style="display:inline-flex;align-items:center;gap:8px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${row.provColor};flex-shrink:0;display:inline-block;"></span>
                <b>${row.provName}</b>
              </span></td>
              <td>${row.siteName}</td>
              <td style="text-align:right">${row.count}</td>
              <td style="text-align:right;font-weight:600;color:var(--accent-cyan)">${row.count * 100} Gbps</td>
            </tr>`).join('');
          })()}
        </tbody>
      </table>
    </div>
  </div>`;

  inner.appendChild(section);

  // Gráfica de barras: tráfico por proveedor
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "dash-card";
  canvasWrap.style.marginTop = "16px";
  canvasWrap.innerHTML = `<div class="dash-card-title">Capacidad ISP vs Tráfico Configurado (Gbps)</div>
    <canvas id="chart-isp" height="80"></canvas>`;
  inner.appendChild(canvasWrap);

  const labels = Object.keys(provUtil);
  const capData = labels.map(n => provUtil[n].total * 100);
  const useData = labels.map(n => provUtil[n].used * 100);
  const colors  = labels.map(n => provUtil[n].color);

  chartISP = new Chart(document.getElementById("chart-isp"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Capacidad total (Gbps)", data: capData, backgroundColor: colors.map(c => c + "33"), borderColor: colors, borderWidth: 2 },
        { label: "Tráfico configurado (Gbps)", data: useData, backgroundColor: colors.map(c => c + "99"), borderColor: colors, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#c9d4e0", font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} Gbps` } },
      },
      scales: {
        x: { ticks: { color: "#8899bb" }, grid: { color: "rgba(45,139,255,0.08)" } },
        y: { ticks: { color: "#8899bb" }, grid: { color: "rgba(45,139,255,0.08)" }, beginAtZero: true },
      },
    },
  });
}
