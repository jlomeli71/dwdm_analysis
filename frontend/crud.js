/**
 * Módulo CRUD — Gestión de Sitios y Lambdas
 */
import { API } from './api.js';

let allSites = [], allLambdas = [];

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
  overlay.querySelector(".modal-cancel")?.addEventListener("click", closeModal);
  overlay.querySelector(".modal-submit")?.addEventListener("click", onSubmit);
}

// ── SITIOS ────────────────────────────────────────────────────────────────────

export async function renderCrud(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Gestión de Sitios y Lambdas</div>
        <div class="page-subtitle">CRUD completo — Red ISP Tx</div>
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
  `;

  // Tab switching
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
      document.getElementById("sites-tab").style.display   = tab.dataset.tab === "sites"   ? "block" : "none";
      document.getElementById("lambdas-tab").style.display = tab.dataset.tab === "lambdas" ? "block" : "none";
    });
  });

  await loadSites();
  await loadLambdas();

  document.getElementById("sites-search").addEventListener("input", renderSitesTable);
  document.getElementById("sites-type-filter").addEventListener("change", renderSitesTable);
  document.getElementById("lambdas-search").addEventListener("input", renderLambdasTable);
  document.getElementById("btn-new-site").addEventListener("click", () => openSiteModal());
  document.getElementById("btn-new-lambda").addEventListener("click", () => openLambdaModal());
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
  const segs = lambda?.segments || [];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "✏️ Editar Lambda" : "➕ Nueva Lambda"}</div>
      <button class="btn btn-icon modal-cancel" style="font-size:18px;">✕</button>
    </div>
    <div class="modal-body">
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
          <label>Lambda de protección 1+1 (nombre exacto)</label>
          <input id="f-lam-prot" value="${lambda?.protection_route_name || ''}" placeholder="Nombre de la lambda de respaldo">
        </div>
      </div>
      <div id="f-lam-error" class="form-error" style="margin-top:12px;display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-submit">${isEdit ? "Guardar cambios" : "Crear lambda"}</button>
    </div>
  `, async () => {
    const color = document.getElementById("f-lam-color").value.trim();
    const body = {
      name:                 document.getElementById("f-lam-name").value.trim(),
      color,
      num_lambdas:          parseInt(document.getElementById("f-lam-num").value) || 1,
      capacity_per_lambda:  parseInt(document.getElementById("f-lam-cap").value) || 100,
      protection_route_name: document.getElementById("f-lam-prot").value.trim() || null,
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

  // Sync color pickers
  setTimeout(() => {
    const picker = document.getElementById("f-lam-color-picker");
    const text   = document.getElementById("f-lam-color");
    picker?.addEventListener("input", () => { text.value = picker.value; });
    text?.addEventListener("input", () => { if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value; });
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
