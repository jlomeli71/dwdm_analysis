/**
 * Módulo de Reportes — Descarga de PDF, Excel y CSV.
 */
import { API } from './api.js';

export async function renderReports(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Reportes &amp; Exportación</div>
        <div class="page-subtitle">Descarga de datos en múltiples formatos</div>
      </div>
    </div>

    <div class="reports-grid">

      <!-- PDF General -->
      <div class="card report-card">
        <div class="report-icon" style="color:#ff6b6b">📄</div>
        <div class="card-title">Reporte General PDF</div>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">
          KPIs de la red, tabla de segmentos por uso (Top 30), resumen de lambdas y proveedores. Formato A4 horizontal.
        </p>
        <div style="display:flex;gap:8px">
          <a class="btn btn-primary" href="${API.reportUrl('general.pdf')}" target="_blank" download>
            ⬇️ Descargar PDF
          </a>
        </div>
      </div>

      <!-- Excel General -->
      <div class="card report-card">
        <div class="report-icon" style="color:#00b894">📊</div>
        <div class="card-title">Reporte General Excel</div>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">
          Tres hojas: Sitios, Lambdas y Segmentos. Encabezados formateados, alertas resaltadas en rojo.
        </p>
        <div style="display:flex;gap:8px">
          <a class="btn btn-primary" href="${API.reportUrl('general.xlsx')}" target="_blank" download>
            ⬇️ Descargar Excel
          </a>
        </div>
      </div>

      <!-- CSV Sitios -->
      <div class="card report-card">
        <div class="report-icon" style="color:#74b9ff">🗂</div>
        <div class="card-title">Sitios CSV</div>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">
          Lista de todos los sitios con ID, nombre, tipo, región, ciudad y coordenadas geográficas.
        </p>
        <a class="btn btn-secondary" href="${API.reportUrl('sites.csv')}" target="_blank" download>
          ⬇️ Descargar CSV
        </a>
      </div>

      <!-- CSV Lambdas -->
      <div class="card report-card">
        <div class="report-icon" style="color:#a29bfe">⚡</div>
        <div class="card-title">Lambdas CSV</div>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">
          Lista de todas las lambdas con nombre, color, número de lambdas, capacidad total y ruta de protección.
        </p>
        <a class="btn btn-secondary" href="${API.reportUrl('lambdas.csv')}" target="_blank" download>
          ⬇️ Descargar CSV
        </a>
      </div>

      <!-- CSV Segmentos -->
      <div class="card report-card">
        <div class="report-icon" style="color:#fd79a8">🔗</div>
        <div class="card-title">Segmentos CSV</div>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">
          Lista de segmentos ordenados por uso, incluyendo porcentaje de capacidad y alertas de sobrecarga.
        </p>
        <a class="btn btn-secondary" href="${API.reportUrl('segments.csv')}" target="_blank" download>
          ⬇️ Descargar CSV
        </a>
      </div>

    </div>

    <!-- Vista previa de estadísticas -->
    <div class="card" style="margin-top:0" id="reports-stats">
      <div class="card-title">📋 Vista Previa de Datos</div>
      <div class="loading-spinner"><div class="spinner"></div><span>Cargando…</span></div>
    </div>
  `;

  // Cargar estadísticas de vista previa
  try {
    const kpis = await API.getKPIs();
    const providers = await API.getProviders();
    const statsEl = document.getElementById('reports-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="card-title">📋 Vista Previa de Datos</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">
          ${[
            { label: 'Total sitios', value: kpis.total_sites, icon: '🏢' },
            { label: 'Lambdas activas', value: kpis.total_lambdas, icon: '⚡' },
            { label: 'Segmentos únicos', value: kpis.total_segments, icon: '🔗' },
            { label: 'Capacidad total', value: `${kpis.total_capacity_tbps} Tbps`, icon: '🔆' },
          ].map(item => `
            <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;align-items:center;gap:12px">
              <span style="font-size:24px">${item.icon}</span>
              <div>
                <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${item.value}</div>
                <div style="font-size:12px;color:var(--text-muted)">${item.label}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card-title" style="font-size:13px">Segmentos por proveedor</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${providers.map((p, i) => {
            const colors = ['#2d8bff','#00e5a0','#a855f7','#ff8c42','#ff69b4','#ffd400','#00d4ff'];
            return `<span class="badge" style="background:${colors[i % colors.length]}22;color:${colors[i % colors.length]};border:1px solid ${colors[i % colors.length]}44;font-size:12px">
              ${p.provider}: ${p.count} seg.
            </span>`;
          }).join('')}
        </div>
      `;
    }
  } catch (e) {
    const statsEl = document.getElementById('reports-stats');
    if (statsEl) statsEl.innerHTML = `<div class="card-title">📋 Vista Previa</div><div style="color:var(--text-muted)">No se pudieron cargar las estadísticas.</div>`;
  }
}
