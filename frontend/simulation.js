/**
 * Módulo de Simulación de Fallas — Selección de segmentos (1 o 2),
 * simulación por proveedor, análisis de protección 1+1 y mapa de calor.
 */
import { API } from './api.js';

let allSegments = [];
let lastResult  = null;
let _simLabel   = 'id'; // 'id' | 'name'

/** Etiqueta de un segmento según el modo activo. */
function segLabel(s) {
  return _simLabel === 'name'
    ? `${s.site_a_name} ↔ ${s.site_b_name}`
    : `${s.site_a_id} ↔ ${s.site_b_id}`;
}

export async function renderSimulation(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Simulador de Fallas</div>
        <div class="page-subtitle">Análisis de impacto — Solo lectura, no modifica la base de datos</div>
      </div>
      <div class="topo-toggle" id="sim-label-toggle">
        <button data-label="id"   class="${_simLabel==='id'   ? 'active' : ''}">Site ID</button>
        <button data-label="name" class="${_simLabel==='name' ? 'active' : ''}">Nombre</button>
      </div>
    </div>

    <div class="sim-layout">
      <!-- Panel de configuración -->
      <div class="card sim-config" style="flex:0 0 380px;">
        <div class="card-title">⚙️ Configurar Simulación</div>

        <!-- Modo de simulación -->
        <div class="form-group" style="margin-bottom:16px;">
          <label>Modo de falla</label>
          <div class="topo-toggle" id="sim-mode-toggle">
            <button class="active" data-mode="segments">Por segmento(s)</button>
            <button data-mode="provider">Por proveedor</button>
          </div>
        </div>

        <!-- Panel: por segmentos -->
        <div id="sim-segments-panel">
          <div class="form-group">
            <label>Filtrar segmentos</label>
            <input type="text" id="sim-seg-search" placeholder="Buscar sitio o proveedor…" style="margin-bottom:8px;">
          </div>
          <div class="form-group">
            <label>Segmentos seleccionados <span id="sel-count" style="color:var(--accent-blue)">(0/3)</span></label>
            <div id="selected-segs" class="selected-segs-box"></div>
          </div>
          <div class="form-group">
            <label>Segmentos disponibles</label>
            <div id="seg-list" class="seg-list-box"></div>
          </div>
        </div>

        <!-- Panel: por proveedor -->
        <div id="sim-provider-panel" style="display:none;">
          <div class="form-group">
            <label>Proveedor a fallar</label>
            <select id="sim-provider-select">
              <option value="">— Seleccionar —</option>
            </select>
          </div>
          <div id="provider-info" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></div>
        </div>

        <button class="btn btn-primary" id="btn-simulate" style="width:100%;margin-top:8px;" disabled>
          ⚡ Simular Falla
        </button>

        <div id="sim-error" class="form-error" style="margin-top:12px;display:none;"></div>
      </div>

      <!-- Panel de resultados -->
      <div style="flex:1;min-width:0;">
        <div id="sim-results">
          <div class="empty-state">
            <div style="font-size:48px;margin-bottom:12px">⚡</div>
            <div>Configure una falla y presione <b>Simular</b></div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Puede seleccionar hasta 3 segmentos simultáneos o un proveedor completo</div>
          </div>
        </div>
      </div>
    </div>
  `;

  allSegments = await API.getSegments();
  const providers = await API.getProviders();

  // Poblar select de proveedores
  const provSel = document.getElementById('sim-provider-select');
  providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.provider;
    opt.textContent = `${p.provider} (${p.count} segmentos)`;
    provSel.appendChild(opt);
  });

  renderSegList('');

  // Toggle Site ID / Nombre
  document.getElementById('sim-label-toggle').addEventListener('click', e => {
    const btn = e.target.closest('button[data-label]');
    if (!btn || btn.dataset.label === _simLabel) return;
    _simLabel = btn.dataset.label;
    document.querySelectorAll('#sim-label-toggle button').forEach(b =>
      b.classList.toggle('active', b.dataset.label === _simLabel)
    );
    const filter = document.getElementById('sim-seg-search')?.value.toLowerCase() || '';
    renderSegList(filter);
    renderSelectedSegs();
    if (lastResult) renderResults(lastResult,
      document.querySelector('#sim-mode-toggle button.active')?.dataset.mode);
  });

  // Toggle de modo
  document.getElementById('sim-mode-toggle').addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    document.querySelectorAll('#sim-mode-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    document.getElementById('sim-segments-panel').style.display = mode === 'segments' ? 'block' : 'none';
    document.getElementById('sim-provider-panel').style.display = mode === 'provider' ? 'block' : 'none';
    updateSimBtn();
  });

  // Búsqueda de segmentos
  document.getElementById('sim-seg-search').addEventListener('input', e => {
    renderSegList(e.target.value.toLowerCase());
  });

  // Info proveedor
  provSel.addEventListener('change', () => {
    const prov = provSel.value;
    const segs = allSegments.filter(s => s.fiber_provider === prov);
    document.getElementById('provider-info').textContent =
      prov ? `${segs.length} segmentos de ${prov} serán afectados` : '';
    updateSimBtn();
  });

  // Botón simular
  document.getElementById('btn-simulate').addEventListener('click', runSimulation);
}

let selectedSegIds = [];

function renderSegList(filter) {
  const list = document.getElementById('seg-list');
  if (!list) return;
  const filtered = allSegments.filter(s => {
    if (!filter) return true;
    return (
      s.site_a_id?.toLowerCase().includes(filter) ||
      s.site_b_id?.toLowerCase().includes(filter) ||
      s.site_a_name?.toLowerCase().includes(filter) ||
      s.site_b_name?.toLowerCase().includes(filter) ||
      s.fiber_provider?.toLowerCase().includes(filter) ||
      s.fiber?.toLowerCase().includes(filter)
    );
  });

  list.innerHTML = filtered.slice(0, 50).map(s => {
    const sel = selectedSegIds.includes(s.id);
    return `
    <div class="seg-item ${sel ? 'selected' : ''}"
         data-id="${s.id}"
         style="cursor:pointer;padding:8px 10px;border-radius:6px;margin-bottom:4px;
                border:1px solid ${sel ? 'var(--accent-blue)' : 'transparent'};
                background:${sel ? 'rgba(45,139,255,0.08)' : 'var(--bg-card)'};
                transition:all 0.15s;">
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent-cyan)">
        ${segLabel(s)}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
        ${s.fiber} · ${s.fiber_provider || '—'} · <span style="color:${s.usage_count >= 77 ? 'var(--accent-red)' : 'var(--text-muted)'}">${s.usage_count}/96 λ</span>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:12px;padding:8px">Sin resultados</div>';

  list.querySelectorAll('.seg-item').forEach(el => {
    el.addEventListener('click', () => toggleSeg(+el.dataset.id));
  });
}

function toggleSeg(id) {
  if (selectedSegIds.includes(id)) {
    selectedSegIds = selectedSegIds.filter(x => x !== id);
  } else {
    if (selectedSegIds.length >= 3) return; // máximo 3
    selectedSegIds.push(id);
  }
  renderSelectedSegs();
  const filter = document.getElementById('sim-seg-search')?.value.toLowerCase() || '';
  renderSegList(filter);
  updateSimBtn();
}

function renderSelectedSegs() {
  const box = document.getElementById('selected-segs');
  if (!box) return;
  const count = document.getElementById('sel-count');
  count && (count.textContent = `(${selectedSegIds.length}/3)`);

  if (selectedSegIds.length === 0) {
    box.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Ninguno seleccionado</span>';
    return;
  }
  box.innerHTML = selectedSegIds.map(id => {
    const s = allSegments.find(x => x.id === id);
    return s ? `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;
                  background:rgba(45,139,255,0.1);border-radius:6px;margin-bottom:4px;border:1px solid var(--accent-blue)">
        <span style="font-family:var(--font-mono);font-size:11px">${segLabel(s)} <span style="color:var(--text-muted)">(${s.fiber})</span></span>
        <button onclick="window._removeSeg(${id})" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:14px">✕</button>
      </div>
    ` : '';
  }).join('');

  window._removeSeg = (id) => {
    selectedSegIds = selectedSegIds.filter(x => x !== id);
    renderSelectedSegs();
    const filter = document.getElementById('sim-seg-search')?.value.toLowerCase() || '';
    renderSegList(filter);
    updateSimBtn();
  };
}

function updateSimBtn() {
  const btn = document.getElementById('btn-simulate');
  if (!btn) return;
  const mode = document.querySelector('#sim-mode-toggle button.active')?.dataset.mode;
  if (mode === 'segments') {
    btn.disabled = selectedSegIds.length === 0;
  } else {
    btn.disabled = !document.getElementById('sim-provider-select')?.value;
  }
}

async function runSimulation() {
  const btn = document.getElementById('btn-simulate');
  const errEl = document.getElementById('sim-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '⏳ Simulando…';

  const mode = document.querySelector('#sim-mode-toggle button.active')?.dataset.mode;

  try {
    if (mode === 'segments') {
      lastResult = await API.simulate({ segments: selectedSegIds });
    } else {
      const prov = document.getElementById('sim-provider-select').value;
      lastResult = await API.simulateProvider(prov);
    }
    renderResults(lastResult, mode);
  } catch (err) {
    errEl.textContent = err.error || 'Error al ejecutar la simulación.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Simular Falla';
    updateSimBtn();
  }
}

function renderResults(result, mode) {
  const el = document.getElementById('sim-results');
  if (!el) return;

  const downList = result.affected_lambdas.filter(r => r.service_status === 'down');
  const protList = result.affected_lambdas.filter(r => r.service_status === 'protected');

  el.innerHTML = `
    <!-- Resumen de impacto -->
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card ${result.service_down_count > 0 ? 'kpi-alert' : ''}">
        <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">🔴</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.service_down_count}</div>
          <div class="kpi-label">Servicio CAÍDO</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(255,212,0,0.15)">🟡</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.service_protected_count}</div>
          <div class="kpi-label">Protegido (1+1)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">📉</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.total_capacity_lost_tbps} Tbps</div>
          <div class="kpi-label">Capacidad perdida</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(0,212,255,0.15)">⚡</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.affected_lambdas_total}</div>
          <div class="kpi-label">Lambdas afectadas</div>
        </div>
      </div>
    </div>

    <!-- Segmentos fallidos -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🔴 Segmentos fallidos${mode === 'provider' ? ` — ${result.provider}` : ''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${result.failed_segments.map(s => `
          <span class="badge" style="background:rgba(255,107,107,0.15);color:var(--accent-red);font-family:var(--font-mono);font-size:11px">
            ${segLabel(s)} (${s.fiber}) · ${s.fiber_provider || '—'}
          </span>
        `).join('')}
      </div>
    </div>

    <!-- Lambdas caídas -->
    ${downList.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-color:rgba(255,107,107,0.3)">
      <div class="card-title" style="color:var(--accent-red)">🔴 Servicio Caído (${downList.length})</div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Color</th><th>Lambda</th><th>Capacidad perdida</th><th>Protección</th>
          </tr></thead>
          <tbody>
            ${downList.map(r => `
              <tr>
                <td><span class="color-dot" style="background:${r.color}"></span></td>
                <td><b>${r.lambda_name}</b></td>
                <td style="color:var(--accent-red)">${r.capacity_lost_gbps} Gbps</td>
                <td>${r.protection_route
                  ? `<span style="color:var(--accent-red)">❌ ${r.protection_route} (también caída)</span>`
                  : '<span style="color:var(--text-muted)">Sin protección</span>'
                }</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Lambdas protegidas -->
    ${protList.length > 0 ? `
    <div class="card" style="border-color:rgba(255,212,0,0.3)">
      <div class="card-title" style="color:var(--accent-yellow)">🟡 Protección 1+1 Activa (${protList.length})</div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Color</th><th>Lambda</th><th>Ruta de protección</th>
          </tr></thead>
          <tbody>
            ${protList.map(r => `
              <tr>
                <td><span class="color-dot" style="background:${r.color}"></span></td>
                <td><b>${r.lambda_name}</b></td>
                <td style="color:var(--accent-green)">✅ ${r.protection_route} (activa)</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    ${result.affected_lambdas_total === 0 ? `
      <div class="empty-state" style="margin-top:20px">
        <div style="font-size:48px">✅</div>
        <div>Sin lambdas afectadas</div>
        <div style="font-size:12px;color:var(--text-muted)">Los segmentos seleccionados no pertenecen a ninguna lambda activa</div>
      </div>
    ` : ''}
  `;
}
