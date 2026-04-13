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
            <button data-mode="isp">Falla ISP</button>
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

        <!-- Panel: falla ISP -->
        <div id="sim-isp-panel" style="display:none;">
          <div class="form-group">
            <label>Proveedor ISP a fallar</label>
            <select id="sim-isp-provider-select">
              <option value="">— Seleccionar proveedor —</option>
            </select>
          </div>
          <div class="form-group">
            <label>Sitio de ingreso</label>
            <select id="sim-isp-site-select" disabled>
              <option value="">— Seleccionar sitio —</option>
            </select>
          </div>
          <div id="isp-sim-info" style="font-size:12px;color:var(--text-muted);margin-top:8px;"></div>
        </div>

        <button class="btn btn-primary" id="btn-simulate" style="width:100%;margin-top:8px;" disabled>
          ⚡ Simular Falla
        </button>

        <button class="btn" id="btn-analyze-all" style="width:100%;margin-top:8px;display:none;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);">
          🔍 Analizar todas las fallas ISP
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
  const [providers, ispProviders, ispFlows] = await Promise.all([
    API.getProviders(),
    API.getISPProviders(),
    API.getTrafficFlows(),
  ]);

  // Poblar select de proveedores de fibra
  const provSel = document.getElementById('sim-provider-select');
  providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.provider;
    opt.textContent = `${p.provider} (${p.count} segmentos)`;
    provSel.appendChild(opt);
  });

  // Poblar select de proveedores ISP
  const ispProvSel = document.getElementById('sim-isp-provider-select');
  ispProviders.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    ispProvSel.appendChild(opt);
  });

  // Al cambiar proveedor ISP → filtrar sitios que tienen ese proveedor en flows
  ispProvSel.addEventListener('change', () => {
    const prov = ispProvSel.value;
    const siteSel = document.getElementById('sim-isp-site-select');
    siteSel.innerHTML = '<option value="">— Seleccionar sitio —</option>';
    siteSel.disabled = !prov;
    if (prov) {
      const sites = [...new Set(
        ispFlows
          .filter(f => f.isp_provider === prov && f.interfaces_count > 0)
          .map(f => f.ingress_site_id)
      )];
      sites.forEach(sid => {
        const opt = document.createElement('option');
        opt.value = sid;
        opt.textContent = sid;
        siteSel.appendChild(opt);
      });
      if (sites.length === 0) {
        document.getElementById('isp-sim-info').textContent =
          'Sin flujos configurados para este proveedor.';
      } else {
        document.getElementById('isp-sim-info').textContent = '';
      }
    }
    updateSimBtn();
  });

  document.getElementById('sim-isp-site-select').addEventListener('change', () => {
    const prov = ispProvSel.value;
    const site = document.getElementById('sim-isp-site-select').value;
    if (prov && site) {
      const affected = ispFlows
        .filter(f => f.isp_provider === prov && f.ingress_site_id === site && f.interfaces_count > 0);
      const gbps = affected.reduce((s, f) => s + f.interfaces_count * 100, 0);
      document.getElementById('isp-sim-info').textContent =
        `${affected.length} flujo(s) afectado(s) · ${gbps} Gbps`;
    }
    updateSimBtn();
  });

  // Botón Analizar todas las fallas ISP
  document.getElementById('btn-analyze-all').addEventListener('click', runAnalyzeAll);

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
    document.getElementById('sim-isp-panel').style.display    = mode === 'isp'      ? 'block' : 'none';
    document.getElementById('btn-analyze-all').style.display  = mode === 'isp'      ? 'block' : 'none';
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
  } else if (mode === 'provider') {
    btn.disabled = !document.getElementById('sim-provider-select')?.value;
  } else if (mode === 'isp') {
    const prov = document.getElementById('sim-isp-provider-select')?.value;
    const site = document.getElementById('sim-isp-site-select')?.value;
    btn.disabled = !(prov && site);
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
      renderResults(lastResult, mode);
    } else if (mode === 'provider') {
      const prov = document.getElementById('sim-provider-select').value;
      lastResult = await API.simulateProvider(prov);
      renderResults(lastResult, mode);
    } else if (mode === 'isp') {
      const prov = document.getElementById('sim-isp-provider-select').value;
      const site = document.getElementById('sim-isp-site-select').value;
      lastResult = await API.simulateISPProvider({ provider: prov, site_id: site });
      renderISPResults(lastResult);
    }
  } catch (err) {
    errEl.textContent = err.error || 'Error al ejecutar la simulación.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Simular Falla';
    updateSimBtn();
  }
}

function renderISPResults(result) {
  const el = document.getElementById('sim-results');
  if (!el) return;

  const deficitClass = result.deficit_gbps > 0 ? 'kpi-alert' : '';
  const saturation = result.available_gbps > 0
    ? Math.min(100, Math.round((result.affected_gbps / result.available_gbps) * 100))
    : (result.affected_gbps > 0 ? 100 : 0);

  el.innerHTML = `
    <!-- KPIs ISP -->
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">📉</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.affected_gbps} Gbps</div>
          <div class="kpi-label">Tráfico afectado</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(0,212,255,0.15)">🔄</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.available_gbps} Gbps</div>
          <div class="kpi-label">Capacidad disponible</div>
        </div>
      </div>
      <div class="kpi-card ${deficitClass}">
        <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">⚠️</div>
        <div class="kpi-body">
          <div class="kpi-value">${result.deficit_gbps} Gbps</div>
          <div class="kpi-label">Déficit (sin ruta)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(139,92,246,0.15)">📊</div>
        <div class="kpi-body">
          <div class="kpi-value">${saturation}%</div>
          <div class="kpi-label">Saturación restante</div>
        </div>
      </div>
    </div>

    <!-- Flujos afectados -->
    ${result.affected_flows.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-color:rgba(255,107,107,0.3)">
      <div class="card-title" style="color:var(--accent-red)">🔴 Flujos afectados (${result.affected_flows.length})</div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proveedor</th><th>Sitio ingreso</th><th>Sitio egreso</th><th>Interfaces</th><th>Tráfico</th>
          </tr></thead>
          <tbody>
            ${result.affected_flows.map(f => `
              <tr>
                <td>${f.isp_provider_name || f.isp_provider}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${f.ingress_site_id}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${f.egress_site_id}</td>
                <td>${f.interfaces_count}</td>
                <td style="color:var(--accent-red)">${f.interfaces_count * 100} Gbps</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- Redistribución proporcional ISIS -->
    ${(result.redistribution_detail || []).length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-color:rgba(0,212,255,0.2)">
      <div class="card-title" style="color:var(--accent-cyan)">
        🔄 Redistribución proporcional
        <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">— IGP ISIS · métrica uniforme entre proveedores ISP</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Proveedor activo</th><th>Interfaces disp.</th><th>Tráfico absorbido</th><th>% saturación</th>
          </tr></thead>
          <tbody>
            ${result.redistribution_detail.map(r => {
              const pct = r.capacity_gbps > 0 ? Math.round((r.absorbed_gbps / r.capacity_gbps) * 100) : 0;
              const color = pct >= 80 ? 'var(--accent-red)' : pct >= 60 ? 'var(--accent-yellow)' : 'var(--accent-green)';
              return `
              <tr>
                <td>${r.provider}</td>
                <td>${r.interfaces}</td>
                <td>${r.absorbed_gbps} Gbps</td>
                <td style="color:${color};font-weight:600">${pct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}

    ${result.deficit_gbps > 0 ? `
    <div class="card" style="margin-bottom:16px;border-color:rgba(255,107,107,0.5);background:rgba(255,107,107,0.05)">
      <div class="card-title" style="color:var(--accent-red)">⚠️ Saturación — Sin capacidad local suficiente</div>
      <p style="font-size:13px;margin:0;color:var(--text-secondary)">
        <b>${result.deficit_gbps} Gbps</b> no pueden redistribuirse localmente. Los proveedores restantes en
        <b>${result.site_id}</b> no tienen interfaces suficientes para absorber todo el tráfico de
        <b>${result.provider}</b>.
      </p>
    </div>

    <!-- Rerouteo ISIS por lambdas -->
    ${(result.isis_rerouting || []).length > 0 ? `
    <div class="card" style="border-color:rgba(139,92,246,0.35)">
      <div class="card-title" style="color:#a78bfa">
        📡 Rerouteo ISIS — rutas alternativas por lambda
        <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">— menor métrica = camino preferido</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Interfaz</th><th>Lambda</th><th style="text-align:center">Métrica</th>
            <th>Sitio remoto</th><th>ISP disp.</th>
          </tr></thead>
          <tbody>
            ${result.isis_rerouting.map((r, idx) => {
              const hasCap = r.remote_isp_available_gbps > 0;
              const rowStyle = idx === 0 ? 'background:rgba(139,92,246,0.07)' : '';
              return `
              <tr style="${rowStyle}">
                <td style="font-family:var(--font-mono);font-size:10px">${r.interface_name}</td>
                <td style="font-size:11px">${r.lambda_name}${idx === 0 ? ' <span style="color:#a78bfa;font-size:10px">← preferida</span>' : ''}</td>
                <td style="text-align:center;font-family:var(--font-mono);color:var(--accent-cyan)">${r.isis_metric}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${r.remote_site_name}</td>
                <td style="color:${hasCap ? 'var(--accent-green)' : 'var(--accent-red)'};font-weight:600">
                  ${r.remote_isp_available_gbps} Gbps${!hasCap ? ' ✗' : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:10px;padding:0 2px">
        ISIS converge automáticamente y encamina el tráfico hacia el vecino de menor métrica que disponga de capacidad ISP.
        Si ningún vecino tiene capacidad, el tráfico queda sin ruta hasta que algún proveedor se restaure.
      </div>
    </div>
    ` : `
    <div class="card" style="border-color:rgba(255,107,107,0.3);background:rgba(255,107,107,0.04)">
      <div class="card-title" style="color:var(--accent-red)">📡 Sin rutas ISIS disponibles</div>
      <p style="font-size:13px;margin:0;color:var(--text-secondary)">
        No se encontraron interfaces lambda con métrica ISIS en este ruteador para encaminar el tráfico deficitario.
      </p>
    </div>
    `}
    ` : `
    <div class="card" style="border-color:rgba(0,255,128,0.3);background:rgba(0,255,128,0.04)">
      <div class="card-title" style="color:var(--accent-green)">✅ Redistribución completa (sin rerouteo ISIS)</div>
      <p style="font-size:13px;margin:0;color:var(--text-secondary)">
        Todo el tráfico de <b>${result.provider}</b> en el sitio <b>${result.site_id}</b>
        puede redistribuirse localmente entre los proveedores ISP restantes. ISIS no necesita reconverger.
      </p>
    </div>
    `}
  `;
}

async function runAnalyzeAll() {
  const el = document.getElementById('sim-results');
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><div style="font-size:32px">⏳</div><div>Analizando todas las combinaciones…</div></div>`;

  try {
    const [ispProviders, ispFlows] = await Promise.all([
      API.getISPProviders(),
      API.getTrafficFlows(),
    ]);

    // Construir lista de combinaciones proveedor+sitio con flujos activos
    const combinations = [];
    for (const prov of ispProviders) {
      const sites = [...new Set(
        ispFlows
          .filter(f => f.isp_provider === prov.name && f.interfaces_count > 0)
          .map(f => f.ingress_site_id)
      )];
      for (const site of sites) combinations.push({ provider: prov.name, site_id: site });
    }

    if (combinations.length === 0) {
      el.innerHTML = `<div class="empty-state"><div>Sin flujos configurados</div><div style="font-size:12px;color:var(--text-muted)">Configure interfaces en la Capa IP/ISP primero.</div></div>`;
      return;
    }

    // Simular cada combinación
    const results = await Promise.all(
      combinations.map(c => API.simulateISPProvider(c).then(r => ({ ...r, ...c })).catch(() => null))
    );

    const valid = results.filter(Boolean).sort((a, b) => b.deficit_gbps - a.deficit_gbps);
    const critical = valid.filter(r => r.deficit_gbps > 0);
    const safe     = valid.filter(r => r.deficit_gbps === 0);

    el.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi-card ${critical.length > 0 ? 'kpi-alert' : ''}">
          <div class="kpi-icon" style="background:rgba(255,107,107,0.15)">🔴</div>
          <div class="kpi-body">
            <div class="kpi-value">${critical.length}</div>
            <div class="kpi-label">Fallas críticas (déficit)</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background:rgba(0,255,128,0.15)">✅</div>
          <div class="kpi-body">
            <div class="kpi-value">${safe.length}</div>
            <div class="kpi-label">Fallas tolerables</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background:rgba(0,212,255,0.15)">🔢</div>
          <div class="kpi-body">
            <div class="kpi-value">${combinations.length}</div>
            <div class="kpi-label">Combinaciones analizadas</div>
          </div>
        </div>
      </div>

      ${critical.length > 0 ? `
      <div class="card" style="margin-bottom:16px;border-color:rgba(255,107,107,0.3)">
        <div class="card-title" style="color:var(--accent-red)">⚠️ Fallas críticas — ordenadas por impacto</div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Proveedor ISP</th><th>Sitio</th><th>Afectado</th><th>Disponible</th><th>Déficit</th>
            </tr></thead>
            <tbody>
              ${critical.map(r => `
                <tr>
                  <td><b>${r.provider}</b></td>
                  <td style="font-family:var(--font-mono);font-size:11px">${r.site_id}</td>
                  <td>${r.affected_gbps} Gbps</td>
                  <td>${r.available_gbps} Gbps</td>
                  <td style="color:var(--accent-red);font-weight:600">${r.deficit_gbps} Gbps</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      ${safe.length > 0 ? `
      <div class="card" style="border-color:rgba(0,255,128,0.2)">
        <div class="card-title" style="color:var(--accent-green)">✅ Fallas tolerables (redistribución completa)</div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Proveedor ISP</th><th>Sitio</th><th>Afectado</th><th>Absorbido por otros</th>
            </tr></thead>
            <tbody>
              ${safe.map(r => `
                <tr>
                  <td>${r.provider}</td>
                  <td style="font-family:var(--font-mono);font-size:11px">${r.site_id}</td>
                  <td>${r.affected_gbps} Gbps</td>
                  <td style="color:var(--accent-green)">${r.affected_gbps} Gbps ✅</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div style="color:var(--accent-red)">Error al analizar: ${err.error || err.message || 'desconocido'}</div></div>`;
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
