/**
 * Módulo CRUD — Gestión de Sitios, Lambdas, Ruteadores y Proveedores ISP
 */
import { API } from './api.js';

let allSites = [], allLambdas = [], allRouters = [], allISPProviders = [];
// allLambdasForSelect: lista plana de lambdas para selects en modal de ruteador
let allLambdasForSelect = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `alert-banner ${type}`;
  el.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;min-width:300px;animation:slideUp 0.3s ease";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function closeModal() {
  document.getElementById("modal-overlay")?.remove();
}

function openModal(html, onSubmit) {
  const overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll(".modal-cancel").forEach(btn => btn.addEventListener("click", closeModal));
  overlay.querySelector(".modal-submit")?.addEventListener("click", onSubmit);
}

// ── SITIOS ────────────────────────────────────────────────────────────────────

export async function renderCrud(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Gestión de Red</div>
        <div class="page-subtitle">Sitios · Lambdas · Ruteadores · Proveedores ISP</div>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);">
      <button class="crud-tab active" data-tab="sites" style="padding:10px 20px;font-weight:600;font-size:13px;color:var(--accent-blue);border-bottom:2px solid var(--accent-blue);background:none;border-top:none;border-left:none;border-right:none;cursor:pointer;">
        🏢 Sitios
      </button>
      <button class="crud-tab" data-tab="lambdas" style="padding:10px 20px;font-weight:600;font-size:13px;color:var(--text-muted);border:none;background:none;cursor:pointer;">
        🔆 Lambdas
      </button>
      <button class="crud-tab" data-tab="routers" style="padding:10px 20px;font-weight:600;font-size:13px;color:var(--text-muted);border:none;background:none;cursor:pointer;">
        🖧 Ruteadores
      </button>
      <button class="crud-tab" data-tab="ispproviders" style="padding:10px 20px;font-weight:600;font-size:13px;color:var(--text-muted);border:none;background:none;cursor:pointer;">
        🌐 Proveedores ISP
      </button>
    </div>

    <div id="sites-tab">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="sites-search" placeholder="Buscar por nombre, ID o ciudad...">
        </div>
        <select id="sites-type-filter" style="width:140px;">
          <option value="">Todos los tipos</option>
          <option value="own">Propios</option>
          <option value="third_party">Terceros</option>
        </select>
        <button class="btn btn-primary" id="btn-new-site">+ Nuevo Sitio</button>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Site ID</th><th>Nombre</th><th>Tipo</th><th>Región</th>
              <th>Ciudad</th><th>Lat / Lon</th><th>Acciones</th>
            </tr></thead>
            <tbody id="sites-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="lambdas-tab" style="display:none;">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="lambdas-search" placeholder="Buscar por nombre...">
        </div>
        <button class="btn btn-primary" id="btn-new-lambda">+ Nueva Lambda</button>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Color</th><th>Nombre</th><th style="text-align:center">#λ</th>
              <th>Cap. (Gbps)</th><th>Segmentos</th><th>Protección</th><th>Acciones</th>
            </tr></thead>
            <tbody id="lambdas-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="routers-tab" style="display:none;">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="routers-search" placeholder="Buscar por nombre, sitio...">
        </div>
        <button class="btn btn-primary" id="btn-new-router">+ Nuevo Ruteador</button>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Nombre</th><th>Sitio</th><th>Marca</th>
              <th style="text-align:center">Interfaces</th><th>Acciones</th>
            </tr></thead>
            <tbody id="routers-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="ispproviders-tab" style="display:none;">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="ispprov-search" placeholder="Buscar por nombre...">
        </div>
        <button class="btn btn-primary" id="btn-new-ispprov">+ Nuevo Proveedor ISP</button>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Color</th><th>Nombre</th><th>Acciones</th>
            </tr></thead>
            <tbody id="ispprov-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Tab switching — 4 tabs
  const TAB_IDS = ["sites", "lambdas", "routers", "ispproviders"];
  document.querySelectorAll(".crud-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".crud-tab").forEach(t => {
        t.style.color = "var(--text-muted)";
        t.style.borderBottom = "none";
        t.classList.remove("active");
      });
      tab.style.color = "var(--accent-blue)";
      tab.style.borderBottom = "2px solid var(--accent-blue)";
      tab.classList.add("active");
      TAB_IDS.forEach(id => {
        document.getElementById(`${id}-tab`).style.display = tab.dataset.tab === id ? "block" : "none";
      });
    });
  });

  await loadSites();
  await loadLambdas();
  await loadRouters();
  await loadISPProviders();

  document.getElementById("sites-search").addEventListener("input", renderSitesTable);
  document.getElementById("sites-type-filter").addEventListener("change", renderSitesTable);
  document.getElementById("lambdas-search").addEventListener("input", renderLambdasTable);
  document.getElementById("routers-search").addEventListener("input", renderRoutersTable);
  document.getElementById("ispprov-search").addEventListener("input", renderISPProvidersTable);
  document.getElementById("btn-new-site").addEventListener("click", () => openSiteModal());
  document.getElementById("btn-new-lambda").addEventListener("click", () => openLambdaModal());
  document.getElementById("btn-new-router").addEventListener("click", () => openRouterModal());
  document.getElementById("btn-new-ispprov").addEventListener("click", () => openISPProviderModal());
}

async function loadSites() {
  allSites = await API.getSites();
  renderSitesTable();
}

async function loadLambdas() {
  allLambdas = await API.getLambdas();
  renderLambdasTable();
}

function renderSitesTable() {
  const search = document.getElementById("sites-search")?.value.toLowerCase() || "";
  const typeFilter = document.getElementById("sites-type-filter")?.value || "";
  let filtered = allSites
    .filter(s => !typeFilter || s.type === typeFilter)
    .filter(s => !search || [s.id, s.name, s.city].some(v => v?.toLowerCase().includes(search)));

  const tbody = document.getElementById("sites-tbody");
  if (!tbody) return;
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td><code style="font-size:12px;color:var(--accent-cyan)">${s.id}</code></td>
      <td><b>${s.name}</b></td>
      <td>${s.type === "own" 
        ? '<span class="badge badge-own">🏢 Propio</span>' 
        : '<span class="badge badge-third">🔗 Tercero</span>'}</td>
      <td>${s.region || '-'}</td>
      <td>${s.city || '-'}</td>
      <td style="font-family:var(--font-mono);font-size:11px">
        ${s.lat != null ? `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}` : '<span style="color:var(--text-muted)">Sin ubicar</span>'}
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="window._editSite('${s.id}')" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="window._deleteSite('${s.id}')" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Sin resultados</td></tr>`;
}

function renderLambdasTable() {
  const search = document.getElementById("lambdas-search")?.value.toLowerCase() || "";
  let filtered = allLambdas.filter(l => !search || l.name.toLowerCase().includes(search));
  const tbody = document.getElementById("lambdas-tbody");
  if (!tbody) return;
  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td><span class="color-swatch"><span class="color-dot" style="background:${l.color}"></span><code style="font-size:11px">${l.color}</code></span></td>
      <td><b>${l.name}</b></td>
      <td style="text-align:center">${l.num_lambdas}</td>
      <td>${l.total_capacity_gbps} Gbps</td>
      <td><span class="badge badge-ok">${l.segments?.length || 0} segmentos</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${l.protection_route_name || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="window._editLambda(${l.id})" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="window._deleteLambda(${l.id})" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Sin resultados</td></tr>`;
}

// ── Site Modal ────────────────────────────────────────────────────────────────

function openSiteModal(site = null) {
  const isEdit = !!site;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "✏️ Editar Sitio" : "➕ Nuevo Sitio"}</div>
      <button class="btn btn-icon modal-cancel" style="font-size:18px;">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group">
          <label>Site ID *</label>
          <input id="f-site-id" value="${site?.id || ''}" ${isEdit ? "readonly style='opacity:0.6'" : ""} placeholder="ej: MSOTOL01">
        </div>
        <div class="form-group">
          <label>Nombre *</label>
          <input id="f-site-name" value="${site?.name || ''}" placeholder="ej: MSO Toluca">
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="f-site-type">
            <option value="own" ${site?.type==='own'?'selected':''}>🏢 Propio</option>
            <option value="third_party" ${site?.type==='third_party'?'selected':''}>🔗 Tercero</option>
          </select>
        </div>
        <div class="form-group">
          <label>Región</label>
          <input id="f-site-region" value="${site?.region || ''}" placeholder="ej: Centro">
        </div>
        <div class="form-group full">
          <label>Ciudad</label>
          <input id="f-site-city" value="${site?.city || ''}" placeholder="ej: Ciudad de México">
        </div>
        <div class="form-group">
          <label>Latitud (14.5 – 32.7)</label>
          <input type="number" id="f-site-lat" step="0.0001" value="${site?.lat ?? ''}" placeholder="ej: 19.4326">
          <span class="form-hint">Territorio mexicano · Opcional</span>
        </div>
        <div class="form-group">
          <label>Longitud (-118.4 – -86.7)</label>
          <input type="number" id="f-site-lon" step="0.0001" value="${site?.lon ?? ''}" placeholder="ej: -99.1332">
          <span class="form-hint">Territorio mexicano · Opcional</span>
        </div>
      </div>
      <div id="f-site-error" class="form-error" style="margin-top:12px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-submit">${isEdit ? "Guardar cambios" : "Crear sitio"}</button>
    </div>
  `, async () => {
    const body = {
      id:     document.getElementById("f-site-id").value.trim(),
      name:   document.getElementById("f-site-name").value.trim(),
      type:   document.getElementById("f-site-type").value,
      region: document.getElementById("f-site-region").value.trim(),
      city:   document.getElementById("f-site-city").value.trim(),
      lat:    parseFloat(document.getElementById("f-site-lat").value) || null,
      lon:    parseFloat(document.getElementById("f-site-lon").value) || null,
    };
    const errEl = document.getElementById("f-site-error");
    try {
      if (isEdit) await API.updateSite(site.id, body);
      else        await API.createSite(body);
      closeModal();
      showToast(isEdit ? "Sitio actualizado ✓" : "Sitio creado ✓");
      await loadSites();
    } catch(e) {
      errEl.textContent = e.error || "Error al guardar.";
      errEl.style.display = "block";
    }
  });
}

window._editSite = async id => {
  const site = await API.getSite(id);
  openSiteModal(site);
};

window._deleteSite = async id => {
  if (!confirm(`¿Eliminar sitio ${id}?`)) return;
  try {
    await API.deleteSite(id);
    showToast(`Sitio ${id} eliminado ✓`);
    await loadSites();
  } catch(e) {
    if (e.status === 409) {
      const lambdaList = (e.affected_lambdas || []).map(l => l.name).join(", ");
      alert(`No se puede eliminar:\n\nTiene ${e.affected_segments} segmento(s) activo(s).\nLambdas afectadas: ${lambdaList}`);
    } else {
      alert(e.error || "Error al eliminar.");
    }
  }
};

// ── Lambda Modal ──────────────────────────────────────────────────────────────

function openLambdaModal(lambda = null) {
  const isEdit = !!lambda;
  const segs   = lambda?.segments || [];
  const PROVIDERS = ['AT&T', 'Bestel', 'Marcatel', 'Totalplay', 'Axtel', 'Maxcom', 'Quattrocom', 'Cirion', 'Unknown'];

  // Genera las <option> de sitios, marcando el seleccionado
  function siteOpts(selId) {
    let html = '<option value="">— Sitio —</option>';
    for (const s of allSites)
      html += `<option value="${s.id}"${s.id === selId ? ' selected' : ''}>${s.id} — ${s.name}</option>`;
    return html;
  }

  // HTML de una fila de segmento (seg puede ser null para fila nueva)
  function segRowHTML(seg) {
    const f = seg?.fiber || 'ruta_1';
    return `<div class="seg-row" style="display:grid;grid-template-columns:1fr 1fr 90px 1fr 34px;gap:6px;align-items:center;margin-bottom:6px;">
      <select class="seg-a" style="font-size:12px;">${siteOpts(seg?.site_a_id || '')}</select>
      <select class="seg-b" style="font-size:12px;">${siteOpts(seg?.site_b_id || '')}</select>
      <select class="seg-fiber" style="font-size:12px;">
        <option value="ruta_1"${f === 'ruta_1' ? ' selected' : ''}>ruta_1</option>
        <option value="ruta_2"${f === 'ruta_2' ? ' selected' : ''}>ruta_2</option>
      </select>
      <input class="seg-provider" list="providers-dl" placeholder="Proveedor" style="font-size:12px;" value="${seg?.fiber_provider || ''}">
      <button type="button" class="btn btn-danger btn-sm seg-rm" title="Eliminar tramo" style="padding:0 8px;font-size:15px;line-height:1;">✕</button>
    </div>`;
  }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "✏️ Editar Lambda" : "➕ Nueva Lambda"}</div>
      <button class="btn btn-icon modal-cancel" style="font-size:18px;">✕</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;max-height:calc(90vh - 130px);">
      <div class="form-grid">
        <div class="form-group full">
          <label>Nombre *</label>
          <input id="f-lam-name" value="${lambda?.name || ''}" placeholder="ej: Laredo to Toluca">
        </div>
        <div class="form-group">
          <label>Color (hex) *</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="color" id="f-lam-color-picker" value="${lambda?.color || '#3B82F6'}" style="width:48px;height:36px;padding:2px;border-radius:6px;cursor:pointer;">
            <input id="f-lam-color" value="${lambda?.color || '#3B82F6'}" style="flex:1;">
          </div>
        </div>
        <div class="form-group">
          <label>Núm. lambdas paralelas</label>
          <input type="number" id="f-lam-num" value="${lambda?.num_lambdas || 1}" min="1" max="96">
        </div>
        <div class="form-group">
          <label>Capacidad por lambda (Gbps)</label>
          <input type="number" id="f-lam-cap" value="${lambda?.capacity_per_lambda || 100}">
        </div>
        <div class="form-group full">
          <label>Lambda de protección 1+1</label>
          <input id="f-lam-prot" value="${lambda?.protection_route_name || ''}" placeholder="Nombre exacto de la lambda de respaldo">
        </div>
      </div>

      <!-- ── Trayectoria ── -->
      <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <label style="font-size:13px;font-weight:700;color:var(--text-primary);">🔗 Trayectoria — Segmentos</label>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-seg">＋ Agregar tramo</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 90px 1fr 34px;gap:6px;padding-bottom:4px;
                    font-size:10px;font-weight:600;letter-spacing:0.5px;color:var(--text-muted);text-transform:uppercase;">
          <span>Sitio A</span><span>Sitio B</span><span>Fibra</span><span>Proveedor</span><span></span>
        </div>
        <div id="f-lam-segments">
          ${segs.map(s => segRowHTML(s)).join('')}
        </div>
        ${segs.length === 0
          ? `<p id="segs-empty" style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:12px;">
               Sin tramos. Usa "＋ Agregar tramo" para definir la trayectoria.
             </p>`
          : ''}
      </div>

      <datalist id="providers-dl">
        ${PROVIDERS.map(p => `<option value="${p}">`).join('')}
      </datalist>

      <div id="f-lam-error" class="form-error" style="margin-top:12px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-submit">${isEdit ? "Guardar cambios" : "Crear lambda"}</button>
    </div>
  `, async () => {
    const color = document.getElementById("f-lam-color").value.trim();

    // Recoger filas de segmentos (solo las que tienen ambos sitios)
    const segments = Array.from(
      document.querySelectorAll('#f-lam-segments .seg-row')
    ).map(row => ({
      site_a_id:     row.querySelector('.seg-a').value,
      site_b_id:     row.querySelector('.seg-b').value,
      fiber:         row.querySelector('.seg-fiber').value,
      fiber_provider: row.querySelector('.seg-provider').value.trim(),
    })).filter(s => s.site_a_id && s.site_b_id);

    const body = {
      name:                  document.getElementById("f-lam-name").value.trim(),
      color,
      num_lambdas:           parseInt(document.getElementById("f-lam-num").value) || 1,
      capacity_per_lambda:   parseInt(document.getElementById("f-lam-cap").value) || 100,
      protection_route_name: document.getElementById("f-lam-prot").value.trim() || null,
      segments,
    };
    const errEl = document.getElementById("f-lam-error");
    try {
      if (isEdit) await API.updateLambda(lambda.id, body);
      else        await API.createLambda(body);
      closeModal();
      showToast(isEdit ? "Lambda actualizada ✓" : "Lambda creada ✓");
      await loadLambdas();
    } catch(e) {
      errEl.textContent = e.error || "Error al guardar.";
      errEl.style.display = "block";
    }
  });

  setTimeout(() => {
    // Ampliar el modal para que quepan las columnas de segmentos
    const modal = document.querySelector('#modal-overlay .modal');
    if (modal) { modal.style.maxWidth = '880px'; modal.style.width = '95vw'; }

    // Sync color pickers
    const picker = document.getElementById("f-lam-color-picker");
    const text   = document.getElementById("f-lam-color");
    picker?.addEventListener("input", () => { text.value = picker.value; });
    text?.addEventListener("input", () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
    });

    // Eliminar fila (event delegation en el contenedor)
    document.getElementById('f-lam-segments')?.addEventListener('click', e => {
      if (e.target.closest('.seg-rm')) {
        e.target.closest('.seg-row').remove();
      }
    });

    // Agregar fila nueva
    document.getElementById('btn-add-seg')?.addEventListener('click', () => {
      document.getElementById('segs-empty')?.remove();
      const container = document.getElementById('f-lam-segments');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = segRowHTML(null);
      container.appendChild(wrapper.firstElementChild);
    });
  }, 50);
}

window._editLambda = async id => {
  const lam = await API.getLambda(id);
  openLambdaModal(lam);
};

window._deleteLambda = async id => {
  const lam = allLambdas.find(l => l.id === id);
  if (!confirm(`¿Eliminar lambda "${lam?.name}"?`)) return;
  try {
    await API.deleteLambda(id);
    showToast(`Lambda eliminada ✓`);
    await loadLambdas();
  } catch(e) {
    alert(e.error || "Error al eliminar.");
  }
};

// ── RUTEADORES ────────────────────────────────────────────────────────────────

async function loadRouters() {
  try {
    allRouters = await API.getRouters();
    // Guardar lambdas planas para los selects de interfaces
    if (!allLambdasForSelect.length) allLambdasForSelect = await API.getLambdas();
  } catch { allRouters = []; }
  renderRoutersTable();
}

function renderRoutersTable() {
  const search = document.getElementById("routers-search")?.value.toLowerCase() || "";
  const filtered = allRouters.filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search) ||
    r.site_id?.toLowerCase().includes(search) ||
    r.site_name?.toLowerCase().includes(search)
  );
  const tbody = document.getElementById("routers-tbody");
  if (!tbody) return;

  const brandLabel = { cisco: "🔵 Cisco", juniper: "🟢 Juniper", cirion: "🟠 Cirion" };

  tbody.innerHTML = filtered.map(r => {
    const lambdaIfaces = (r.interfaces || []).filter(i => i.iface_type === "lambda").length;
    const ispIfaces    = (r.interfaces || []).filter(i => i.iface_type === "isp").length;
    return `
      <tr>
        <td><b>${r.name}</b></td>
        <td>
          <code style="font-size:12px;color:var(--accent-cyan)">${r.site_id}</code>
          <span style="color:var(--text-muted);font-size:12px;"> — ${r.site_name || ''}</span>
        </td>
        <td>${brandLabel[r.brand] || r.brand}</td>
        <td style="text-align:center">
          <span class="badge badge-ok" title="Interfaces lambda">λ ${lambdaIfaces}</span>
          <span class="badge badge-own" title="Interfaces ISP" style="margin-left:4px;">ISP ${ispIfaces}</span>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="window._editRouter(${r.id})" title="Editar">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="window._deleteRouter(${r.id})" title="Eliminar">🗑</button>
          </div>
        </td>
      </tr>`;
  }).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">Sin resultados</td></tr>`;
}

// ── Router Modal ──────────────────────────────────────────────────────────────

function openRouterModal(router = null) {
  const isEdit   = !!router;
  const ifaces   = router?.interfaces || [];
  const ispProvs = allISPProviders;

  function ifaceRowHTML(iface) {
    const isLambda = (iface?.iface_type || "lambda") === "lambda";
    const lambdaOpts = allLambdasForSelect.map(l =>
      `<option value="${l.id}"${l.id === iface?.lambda_id ? " selected" : ""}>${l.name}</option>`
    ).join("");
    const ispOpts = ispProvs.map(p =>
      `<option value="${p.id}"${p.id === iface?.isp_provider_id ? " selected" : ""}>${p.name}</option>`
    ).join("");

    return `<div class="iface-row" style="display:grid;grid-template-columns:1fr 80px 1fr 80px 34px;gap:6px;align-items:center;margin-bottom:6px;"
        data-iface-id="${iface?.id || ''}">
      <input class="iface-name" placeholder="Nombre (ej: Gi0/0/0)" value="${iface?.name || ''}" style="font-size:12px;">
      <select class="iface-type" style="font-size:12px;">
        <option value="lambda"${isLambda ? " selected" : ""}>Lambda</option>
        <option value="isp"${!isLambda ? " selected" : ""}>ISP</option>
      </select>
      <select class="iface-ref" style="font-size:12px;">
        <option value="">— ${isLambda ? "Lambda" : "Proveedor"} —</option>
        ${isLambda ? lambdaOpts : ispOpts}
      </select>
      <input class="iface-metric" type="number" placeholder="Métrica ISIS" min="1" max="16777214"
        value="${iface?.isis_metric ?? ''}" style="font-size:12px;" ${!isLambda ? "disabled style='opacity:0.4;font-size:12px;'" : ""}>
      ${iface?.id
        ? `<button type="button" class="btn btn-danger btn-sm iface-rm" data-id="${iface.id}" title="Eliminar" style="padding:0 8px;font-size:15px;line-height:1;">✕</button>`
        : `<button type="button" class="btn btn-danger btn-sm iface-rm-new" title="Quitar" style="padding:0 8px;font-size:15px;line-height:1;">✕</button>`
      }
    </div>`;
  }

  // Precarga la lista de ISP providers si está vacía
  const ispOptsGlobal = ispProvs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  const lambdaOptsGlobal = allLambdasForSelect.map(l => `<option value="${l.id}">${l.name}</option>`).join("");

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "✏️ Editar Ruteador" : "➕ Nuevo Ruteador"}</div>
      <button class="btn btn-icon modal-cancel" style="font-size:18px;">✕</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;max-height:calc(90vh - 130px);">
      <div class="form-grid">
        <div class="form-group">
          <label>Sitio *</label>
          <select id="f-rtr-site">
            <option value="">— Seleccionar sitio —</option>
            ${allSites.map(s => `<option value="${s.id}"${s.id === router?.site_id ? " selected" : ""}>${s.id} — ${s.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Marca *</label>
          <select id="f-rtr-brand">
            <option value="cisco"${router?.brand === "cisco" ? " selected" : ""}>🔵 Cisco</option>
            <option value="juniper"${router?.brand === "juniper" ? " selected" : ""}>🟢 Juniper</option>
            <option value="cirion"${router?.brand === "cirion" ? " selected" : ""}>🟠 Cirion</option>
          </select>
        </div>
        <div class="form-group full">
          <label>Nombre *</label>
          <input id="f-rtr-name" value="${router?.name || ''}" placeholder="ej: MSOTOL01-RTR-01">
        </div>
      </div>

      <!-- Interfaces -->
      <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <label style="font-size:13px;font-weight:700;color:var(--text-primary);">🔌 Interfaces</label>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-iface">＋ Agregar interfaz</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 80px 1fr 80px 34px;gap:6px;padding-bottom:4px;
            font-size:10px;font-weight:600;letter-spacing:0.5px;color:var(--text-muted);text-transform:uppercase;">
          <span>Nombre</span><span>Tipo</span><span>Lambda / Proveedor</span><span>Métrica</span><span></span>
        </div>
        <div id="f-rtr-ifaces">
          ${ifaces.map(i => ifaceRowHTML(i)).join("")}
        </div>
        ${ifaces.length === 0 ? `<p id="ifaces-empty" style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:12px;">Sin interfaces.</p>` : ""}
      </div>

      <div id="f-rtr-error" class="form-error" style="margin-top:12px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-submit">${isEdit ? "Guardar cambios" : "Crear ruteador"}</button>
    </div>
  `, async () => {
    const errEl   = document.getElementById("f-rtr-error");
    const siteId  = document.getElementById("f-rtr-site").value;
    const brand   = document.getElementById("f-rtr-brand").value;
    const name    = document.getElementById("f-rtr-name").value.trim();

    if (!siteId || !name) {
      errEl.textContent = "Sitio y nombre son obligatorios.";
      errEl.style.display = "block";
      return;
    }

    try {
      let rtrId = router?.id;
      if (isEdit) {
        await API.updateRouter(rtrId, { name, brand });
      } else {
        const created = await API.createRouter({ site_id: siteId, name, brand });
        rtrId = created.id;
      }

      // Guardar interfaces nuevas (sin id asignado aún)
      const newIfaceRows = Array.from(
        document.querySelectorAll('#f-rtr-ifaces .iface-row[data-iface-id=""]')
      );
      for (const row of newIfaceRows) {
        const ifName  = row.querySelector(".iface-name").value.trim();
        const ifType  = row.querySelector(".iface-type").value;
        const refVal  = row.querySelector(".iface-ref").value;
        const metric  = parseInt(row.querySelector(".iface-metric").value) || null;
        if (!ifName) continue;
        const body = {
          router_id:  rtrId,
          name:       ifName,
          iface_type: ifType,
          ...(ifType === "lambda" ? { lambda_id: refVal || null, isis_metric: metric } : { isp_provider_id: refVal || null }),
        };
        await API.createRouterInterface(body);
      }

      closeModal();
      showToast(isEdit ? "Ruteador actualizado ✓" : "Ruteador creado ✓");
      await loadRouters();
    } catch(e) {
      errEl.textContent = e.error || "Error al guardar.";
      errEl.style.display = "block";
    }
  });

  setTimeout(() => {
    const modal = document.querySelector('#modal-overlay .modal');
    if (modal) { modal.style.maxWidth = '820px'; modal.style.width = '95vw'; }

    // Eliminar interfaz existente (via API)
    document.getElementById('f-rtr-ifaces')?.addEventListener('click', async e => {
      const btn = e.target.closest('.iface-rm');
      if (btn) {
        const ifaceId = parseInt(btn.dataset.id);
        if (!confirm("¿Eliminar esta interfaz?")) return;
        try {
          await API.deleteRouterInterface(ifaceId);
          btn.closest('.iface-row').remove();
        } catch(err) {
          alert(err.error || "Error al eliminar interfaz.");
        }
      }
      // Quitar fila nueva (no guardada)
      const btnNew = e.target.closest('.iface-rm-new');
      if (btnNew) {
        btnNew.closest('.iface-row').remove();
      }
    });

    // Cambio de tipo en una fila nueva — actualizar opciones de la referencia
    document.getElementById('f-rtr-ifaces')?.addEventListener('change', e => {
      const sel = e.target.closest('.iface-type');
      if (!sel) return;
      const row      = sel.closest('.iface-row');
      const refSel   = row.querySelector('.iface-ref');
      const metricIn = row.querySelector('.iface-metric');
      const isLambda = sel.value === "lambda";
      const opts = isLambda ? lambdaOptsGlobal : ispOptsGlobal;
      refSel.innerHTML = `<option value="">— ${isLambda ? "Lambda" : "Proveedor"} —</option>${opts}`;
      metricIn.disabled = !isLambda;
      metricIn.style.opacity = isLambda ? "1" : "0.4";
    });

    // Agregar fila nueva
    document.getElementById('btn-add-iface')?.addEventListener('click', () => {
      document.getElementById('ifaces-empty')?.remove();
      const cont = document.getElementById('f-rtr-ifaces');
      const wrap = document.createElement('div');
      wrap.innerHTML = ifaceRowHTML(null);
      cont.appendChild(wrap.firstElementChild);
    });
  }, 50);
}

window._editRouter = id => {
  const r = allRouters.find(r => r.id === id);
  if (r) openRouterModal(r);
};

window._deleteRouter = async id => {
  const r = allRouters.find(r => r.id === id);
  if (!confirm(`¿Eliminar ruteador "${r?.name}"? Se eliminarán también sus interfaces.`)) return;
  try {
    await API.deleteRouter(id);
    showToast(`Ruteador eliminado ✓`);
    await loadRouters();
  } catch(e) {
    alert(e.error || "Error al eliminar.");
  }
};

// ── PROVEEDORES ISP ───────────────────────────────────────────────────────────

async function loadISPProviders() {
  try { allISPProviders = await API.getISPProviders(); } catch { allISPProviders = []; }
  renderISPProvidersTable();
}

function renderISPProvidersTable() {
  const search = document.getElementById("ispprov-search")?.value.toLowerCase() || "";
  const filtered = allISPProviders.filter(p => !search || p.name.toLowerCase().includes(search));
  const tbody = document.getElementById("ispprov-tbody");
  if (!tbody) return;
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><span class="color-swatch">
        <span class="color-dot" style="background:${p.color};border:2px solid ${p.color};"></span>
        <code style="font-size:11px">${p.color}</code>
      </span></td>
      <td><b>${p.name}</b></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="window._editISPProvider(${p.id})" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="window._deleteISPProvider(${p.id})" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px">Sin resultados</td></tr>`;
}

// ── ISP Provider Modal ────────────────────────────────────────────────────────

function openISPProviderModal(prov = null) {
  const isEdit = !!prov;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "✏️ Editar Proveedor ISP" : "➕ Nuevo Proveedor ISP"}</div>
      <button class="btn btn-icon modal-cancel" style="font-size:18px;">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group full">
          <label>Nombre *</label>
          <input id="f-isp-name" value="${prov?.name || ''}" placeholder="ej: Telmex">
        </div>
        <div class="form-group">
          <label>Color (hex) *</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="color" id="f-isp-color-picker" value="${prov?.color || '#3B82F6'}"
              style="width:48px;height:36px;padding:2px;border-radius:6px;cursor:pointer;">
            <input id="f-isp-color" value="${prov?.color || '#3B82F6'}" style="flex:1;" placeholder="#RRGGBB">
          </div>
        </div>
      </div>
      <div id="f-isp-error" class="form-error" style="margin-top:12px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-submit">${isEdit ? "Guardar cambios" : "Crear proveedor"}</button>
    </div>
  `, async () => {
    const name  = document.getElementById("f-isp-name").value.trim();
    const color = document.getElementById("f-isp-color").value.trim();
    const errEl = document.getElementById("f-isp-error");
    if (!name || !color) {
      errEl.textContent = "Nombre y color son obligatorios.";
      errEl.style.display = "block";
      return;
    }
    try {
      if (isEdit) await API.updateISPProvider(prov.id, { name, color });
      else        await API.createISPProvider({ name, color });
      closeModal();
      showToast(isEdit ? "Proveedor actualizado ✓" : "Proveedor creado ✓");
      await loadISPProviders();
    } catch(e) {
      errEl.textContent = e.error || "Error al guardar.";
      errEl.style.display = "block";
    }
  });

  setTimeout(() => {
    const picker = document.getElementById("f-isp-color-picker");
    const text   = document.getElementById("f-isp-color");
    picker?.addEventListener("input", () => { text.value = picker.value; });
    text?.addEventListener("input", () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
    });
  }, 50);
}

window._editISPProvider = id => {
  const p = allISPProviders.find(p => p.id === id);
  if (p) openISPProviderModal(p);
};

window._deleteISPProvider = async id => {
  const p = allISPProviders.find(p => p.id === id);
  if (!confirm(`¿Eliminar proveedor ISP "${p?.name}"?`)) return;
  try {
    await API.deleteISPProvider(id);
    showToast(`Proveedor "${p?.name}" eliminado ✓`);
    await loadISPProviders();
  } catch(e) {
    alert(e.error || "Error al eliminar.");
  }
};
