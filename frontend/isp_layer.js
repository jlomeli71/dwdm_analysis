/**
 * isp_layer.js — Vista de Capa IP/ISP
 * Muestra ruteadores, nubes ISP, lambdas de transporte y matriz de tráfico editable.
 */
import { API } from "./api.js";

// ── Constantes visuales ───────────────────────────────────────────────────────
const BRAND_COLOR = { cisco: "#2563EB", juniper: "#16A34A", cirion: "#8B5CF6" };
const NODE_R      = 22;   // radio del nodo ruteador
const CLOUD_W     = 80;   // ancho de la nube ISP
const CLOUD_H     = 52;   // alto de la nube ISP

// ── Estado del módulo ─────────────────────────────────────────────────────────
let routers = [], providers = [], flows = [], lambdas = [];
let simulation = null;
let _ispAllNodes = []; // referencia a los nodos activos para guardar posiciones

const ISP_POS_KEY = "isp-graph-positions";

function _saveISPPositions() {
  const pos = {};
  _ispAllNodes.forEach(n => { if (n.x != null) pos[n.id] = { x: Math.round(n.x), y: Math.round(n.y) }; });
  try { localStorage.setItem(ISP_POS_KEY, JSON.stringify(pos)); } catch {}
}

export async function renderISPLayer(container) {
  container.innerHTML = `<div class="isp-page">
    <div class="isp-toolbar">
      <div class="isp-toolbar-title">
        <span style="color:var(--accent-cyan);font-size:18px">🌐</span>
        <span>Capa IP / ISP</span>
      </div>
      <div class="isp-toolbar-actions">
        <button class="btn-tool active" id="isp-btn-graph">Grafo lógico</button>
        <button class="btn-tool" id="isp-btn-save-pos" title="Guardar posiciones de nodos">💾 Guardar posiciones</button>
        <button class="btn-tool" id="isp-btn-reset-pos" title="Restablecer layout automático">↺ Restablecer layout</button>
        <button class="btn-tool" id="isp-btn-reload" title="Recargar datos">↺ Actualizar</button>
      </div>
    </div>

    <div class="isp-layout">
      <!-- Visualización D3 -->
      <div class="isp-graph-wrap" id="isp-graph-wrap">
        <svg id="isp-svg" style="width:100%;height:100%"></svg>
      </div>

      <!-- Panel derecho: matrices + métricas ISIS -->
      <div class="isp-matrix-panel" id="isp-matrix-panel">

        <!-- 2.2 Capacidad ISP -->
        <div class="isp-matrix-header">
          <span>📦 Capacidad ISP</span>
          <span class="isp-matrix-sub">Interfaces físicas por proveedor y sitio</span>
          <button class="btn-tool btn-sm isp-lag-btn" id="isp-lag-toggle" title="Agrupar interfaces como LAG">⚡ LAG</button>
        </div>
        <div id="isp-capacity-content"><div class="isp-loading">Cargando…</div></div>

        <!-- 2.3 Tráfico / Uso -->
        <div class="isp-matrix-header">
          <span>📊 Tráfico / Uso</span>
          <span class="isp-matrix-sub">Gbps por flujo — editable · 🟢&lt;60% 🟡60-79% 🔴≥80%</span>
        </div>
        <div id="isp-matrix-content"><div class="isp-loading">Cargando…</div></div>

        <!-- Métricas ISIS -->
        <div class="isp-metrics-header">
          <span>📡 Métricas ISIS</span>
          <span class="isp-matrix-sub">Cisco &amp; Juniper · default 10 · rango 1–16 777 214</span>
        </div>
        <div id="isp-metrics-content"><div class="isp-loading">Cargando…</div></div>

        <!-- Utilización mensual (Excel) -->
        <div class="isp-matrix-header">
          <span>📈 Utilización Histórica</span>
          <span class="isp-matrix-sub">Importar desde Excel mensual</span>
        </div>
        <div id="isp-util-content">
          <div class="isp-util-upload">
            <label class="isp-util-label" for="isp-util-file">
              📂 Seleccionar .xlsx
              <input type="file" id="isp-util-file" accept=".xlsx,.xls" style="display:none">
            </label>
            <button class="btn-tool btn-sm" id="isp-util-upload-btn" disabled>⬆ Cargar</button>
          </div>
          <div id="isp-util-status"></div>
          <div id="isp-util-history"><div class="isp-loading">Sin datos cargados.</div></div>
        </div>
      </div>
    </div>
  </div>`;

  await loadData();
  renderGraph();
  renderCapacityMatrix();
  renderMatrix();
  renderISPMetrics();

  // LAG toggle
  let lagGrouped = false;
  document.getElementById("isp-lag-toggle")?.addEventListener("click", (e) => {
    lagGrouped = !lagGrouped;
    e.currentTarget.classList.toggle("active", lagGrouped);
    renderCapacityMatrix(lagGrouped);
  });

  // Guardar posiciones manualmente + toast
  document.getElementById("isp-btn-save-pos")?.addEventListener("click", () => {
    _saveISPPositions();
    const btn = document.getElementById("isp-btn-save-pos");
    if (btn) { btn.textContent = "✓ Guardado"; setTimeout(() => { btn.textContent = "💾 Guardar posiciones"; }, 2000); }
  });

  // Restablecer layout: borrar posiciones guardadas y re-renderizar grafo
  document.getElementById("isp-btn-reset-pos")?.addEventListener("click", () => {
    try { localStorage.removeItem(ISP_POS_KEY); } catch {}
    renderGraph();
  });

  document.getElementById("isp-btn-reload")?.addEventListener("click", async () => {
    await loadData();
    renderGraph();
    renderCapacityMatrix(lagGrouped);
    renderMatrix();
    renderISPMetrics();
  });

  // Utilización histórica: inicializar upload UI
  _initUtilUpload();
  renderUtilHistory();
}

// ── Carga de datos ────────────────────────────────────────────────────────────
async function loadData() {
  [routers, providers, flows, lambdas] = await Promise.all([
    API.getRouters(),
    API.getISPProviders(),
    API.getTrafficFlows(),
    API.getLambdas(),
  ]);
}

// ── Grafo D3 ──────────────────────────────────────────────────────────────────
function renderGraph() {
  const wrap = document.getElementById("isp-graph-wrap");
  if (!wrap) return;
  const W = wrap.clientWidth  || 900;
  const H = wrap.clientHeight || 600;

  const svgEl = document.getElementById("isp-svg");
  svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Limpiar render anterior
  if (simulation) simulation.stop();
  const svg = d3.select("#isp-svg");
  svg.selectAll("*").remove();

  const g = svg.append("g").attr("class", "isp-root");

  // Zoom
  const zoom = d3.zoom().scaleExtent([0.3, 4])
    .on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoom);

  // ── Construir nodos ──────────────────────────────────────────────────────
  // Nodos ruteador
  const routerNodes = routers.map(r => ({
    id: `rtr_${r.site_id}`,
    kind: "router",
    brand: r.brand,
    label: r.site_name,
    routerId: r.id,
    siteId: r.site_id,
    x: W / 2 + (Math.random() - 0.5) * W * 0.6,
    y: H / 2 + (Math.random() - 0.5) * H * 0.5,
  }));

  // Nodos ISP provider (uno por proveedor que tenga conexiones en ese sitio)
  const ispNodeMap = {};  // key: `${provider.id}_${site_id}`
  const ispNodes = [];
  routers.forEach(r => {
    const ispIfaces = r.interfaces.filter(i => i.iface_type === "isp");
    const seen = new Set();
    ispIfaces.forEach(iface => {
      const key = `${iface.isp_provider_id}_${r.site_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        const prov = providers.find(p => p.id === iface.isp_provider_id);
        if (prov) {
          const node = {
            id: key,
            kind: "isp",
            providerId: prov.id,
            providerName: prov.name,
            color: prov.color,
            siteId: r.site_id,
            x: W / 2 + (Math.random() - 0.5) * W * 0.8,
            y: 60,
          };
          ispNodes.push(node);
          ispNodeMap[key] = node;
        }
      }
    });
  });

  const allNodes = [...routerNodes, ...ispNodes];
  _ispAllNodes = allNodes; // exponer para el botón de guardar
  const nodeById = {};
  allNodes.forEach(n => { nodeById[n.id] = n; });

  // ── Cargar posiciones guardadas ───────────────────────────────────────────
  let savedISPPos = {};
  try { savedISPPos = JSON.parse(localStorage.getItem(ISP_POS_KEY) || "{}"); } catch {}
  allNodes.forEach(n => {
    const s = savedISPPos[n.id];
    if (s) { n.x = s.x; n.y = s.y; n.fx = s.x; n.fy = s.y; }
  });

  // ── Construir enlaces ────────────────────────────────────────────────────
  const links = [];

  // Lambdas entre routers: usar las interfaces lambda de cada router
  const lambdaEdgeSet = new Set();
  routers.forEach(r => {
    r.interfaces.filter(i => i.iface_type === "lambda" && i.lambda_id).forEach(iface => {
      const lam = lambdas.find(l => l.id === iface.lambda_id);
      if (!lam) return;
      // Buscar el otro router de esta lambda
      const otherRouter = routers.find(or =>
        or.site_id !== r.site_id &&
        or.interfaces.some(oi => oi.iface_type === "lambda" && oi.lambda_id === iface.lambda_id)
      );
      if (!otherRouter) return;
      const key = [r.site_id, otherRouter.site_id, lam.id].sort().join("|");
      if (!lambdaEdgeSet.has(key)) {
        lambdaEdgeSet.add(key);
        links.push({
          source: `rtr_${r.site_id}`,
          target: `rtr_${otherRouter.site_id}`,
          kind: "lambda",
          color: lam.color,
          label: lam.name,
        });
      }
    });
  });

  // ISP → Router
  routers.forEach(r => {
    const ispIfaces = r.interfaces.filter(i => i.iface_type === "isp");
    const seen = new Set();
    ispIfaces.forEach(iface => {
      const key = `${iface.isp_provider_id}_${r.site_id}`;
      if (!seen.has(key) && ispNodeMap[key]) {
        seen.add(key);
        const count = ispIfaces.filter(i => i.isp_provider_id === iface.isp_provider_id).length;
        links.push({
          source: key,
          target: `rtr_${r.site_id}`,
          kind: "isp",
          color: ispNodeMap[key].color,
          count,
        });
      }
    });
  });

  // ── Simulación de fuerzas ────────────────────────────────────────────────
  simulation = d3.forceSimulation(allNodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.kind === "isp" ? 110 : 180).strength(0.6))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide(50))
    .alphaDecay(0.03);

  // ── Dibujar enlaces ──────────────────────────────────────────────────────
  const linkG = g.append("g").attr("class", "isp-links");

  // Agrupar lambdas por par source-target para offset paralelo
  const lambdaGroups = {};
  links.filter(l => l.kind === "lambda").forEach(l => {
    const key = [l.source, l.target].sort().join("|");
    lambdaGroups[key] = (lambdaGroups[key] || []);
    lambdaGroups[key].push(l);
  });

  const linkSel = linkG.selectAll("line").data(links).join("line")
    .attr("stroke", d => d.color)
    .attr("stroke-width", d => d.kind === "isp" ? Math.max(1.5, d.count * 1.2) : 2)
    .attr("stroke-opacity", d => d.kind === "isp" ? 0.85 : 0.7)
    .attr("stroke-dasharray", d => d.kind === "isp" ? "6,3" : null);

  // Tooltip en enlaces
  const tooltip = _ensureTooltip();
  linkSel
    .on("mouseover", (e, d) => {
      tooltip.style("display", "block")
        .html(d.kind === "isp"
          ? `<b>${d.color ? "" : ""}${nodeById[typeof d.source === "object" ? d.source.id : d.source]?.providerName || "ISP"}</b><br>${d.count} × 100 Gbps`
          : `<b>${d.label}</b>`);
      _positionTooltip(tooltip, e);
    })
    .on("mousemove", (e) => _positionTooltip(tooltip, e))
    .on("mouseout",  () => tooltip.style("display", "none"));

  // ── Dibujar nodos ────────────────────────────────────────────────────────
  const nodeG = g.append("g").attr("class", "isp-nodes");

  // Fijar todos los nodos cuando la simulación termina de acomodarlos
  simulation.on("end", () => {
    allNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
  });

  const drag = d3.drag()
    .on("start", function(_e, _d) {
      // Detener la simulación y anclar todos los nodos
      simulation.alphaTarget(0).stop();
      allNodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
    })
    .on("drag", function(e, d) {
      // Actualizar posición del nodo arrastrado directamente en el DOM
      d.x = e.x; d.y = e.y; d.fx = e.x; d.fy = e.y;
      d3.select(this).attr("transform", `translate(${e.x},${e.y})`);
      // Actualizar solo las líneas conectadas a este nodo
      linkSel.each(function(l) {
        if (l.source === d || l.target === d) {
          d3.select(this)
            .attr("x1", l.source.x).attr("y1", l.source.y)
            .attr("x2", l.target.x).attr("y2", l.target.y);
        }
      });
    })
    .on("end", function() {
      // Los nodos quedan fijos; auto-guardar posiciones en localStorage
      _saveISPPositions();
    });

  const nodeSel = nodeG.selectAll("g.isp-node").data(allNodes).join("g")
    .attr("class", "isp-node")
    .call(drag)
    .on("mouseover", (e, d) => {
      const html = d.kind === "router"
        ? `<b>${d.label}</b><br><span style="opacity:.7">${d.brand}</span>`
        : `<b>${d.providerName}</b><br><span style="opacity:.7">ISP en ${d.siteId}</span>`;
      tooltip.style("display", "block").html(html);
      _positionTooltip(tooltip, e);
    })
    .on("mousemove", (e) => _positionTooltip(tooltip, e))
    .on("mouseout",  () => tooltip.style("display", "none"));

  // Ruteadores: círculo relleno + símbolo X blanco (diagonales ×)
  nodeSel.filter(d => d.kind === "router").each(function(d) {
    const sel = d3.select(this);
    const color = BRAND_COLOR[d.brand] || "#888";
    sel.append("circle").attr("r", NODE_R).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.5);
    // Símbolo X — líneas diagonales en lugar de cruz +
    const arm = NODE_R * 0.52;
    sel.append("line").attr("x1", -arm).attr("y1", -arm).attr("x2", arm).attr("y2", arm)
      .attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
    sel.append("line").attr("x1", arm).attr("y1", -arm).attr("x2", -arm).attr("y2", arm)
      .attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
    // Etiqueta
    sel.append("text").attr("dy", NODE_R + 13).attr("text-anchor", "middle")
      .attr("font-size", "10").attr("fill", "var(--text-secondary)").text(d.label);
  });

  // Proveedores ISP: elipse coloreada + etiqueta
  nodeSel.filter(d => d.kind === "isp").each(function(d) {
    const sel = d3.select(this);
    // Elipse del proveedor ISP (reemplaza la nube SVG)
    sel.append("ellipse")
      .attr("rx", CLOUD_W / 2)
      .attr("ry", CLOUD_H / 2)
      .attr("fill", d.color)
      .attr("stroke", d.color)
      .attr("stroke-width", 1.5);
    sel.append("text").attr("dy", 4).attr("text-anchor", "middle")
      .attr("font-size", "9.5").attr("font-weight", "700").attr("fill", "#ffffff")
      .text(d.providerName);
    sel.append("text").attr("dy", CLOUD_H / 2 + 13).attr("text-anchor", "middle")
      .attr("font-size", "9").attr("fill", "var(--text-muted)").text(d.siteId);
  });

  // ── Tick ─────────────────────────────────────────────────────────────────
  simulation.on("tick", () => {
    linkSel
      .attr("x1", d => (typeof d.source === "object" ? d.source : nodeById[d.source])?.x ?? 0)
      .attr("y1", d => (typeof d.source === "object" ? d.source : nodeById[d.source])?.y ?? 0)
      .attr("x2", d => (typeof d.target === "object" ? d.target : nodeById[d.target])?.x ?? 0)
      .attr("y2", d => (typeof d.target === "object" ? d.target : nodeById[d.target])?.y ?? 0);
    nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  });
}

// ── Matriz de Capacidad ISP (Tarea 2.2) ──────────────────────────────────────
function renderCapacityMatrix(lagGrouped = false) {
  const content = document.getElementById("isp-capacity-content");
  if (!content) return;

  // Construir filas: por ruteador → agrupar ISP interfaces por proveedor
  const routerRows = [];
  routers.forEach(r => {
    const ispIfaces = (r.interfaces || []).filter(i => i.iface_type === "isp");
    if (ispIfaces.length === 0) return;

    // Agrupar por proveedor
    const byProv = {};
    ispIfaces.forEach(iface => {
      const key = iface.isp_provider_id;
      if (!byProv[key]) byProv[key] = { name: iface.isp_provider_name, color: iface.isp_provider_color, ifaces: [] };
      byProv[key].ifaces.push(iface.name);
    });

    Object.values(byProv).forEach(prov => {
      routerRows.push({
        rtrName: r.name,
        brand: r.brand,
        siteId: r.site_id,
        providerName: prov.name,
        providerColor: prov.color,
        ifaces: prov.ifaces,
        count: prov.ifaces.length,
        capGbps: prov.ifaces.length * 100,
      });
    });
  });

  // Lambda / inter-router capacity: agrupar por par de sitios con ruteador
  const rtrSites = new Set(routers.map(r => r.site_id));
  const lambdaCap = {};
  lambdas.forEach(lm => {
    if (!lm.segments || lm.segments.length === 0) return;
    const ends = _lambdaEndpoints(lm);
    if (!ends) return;
    const [a, b] = [ends.ingress, ends.egress].sort();
    if (!rtrSites.has(a) || !rtrSites.has(b)) return;
    const key = `${a}|${b}`;
    lambdaCap[key] = (lambdaCap[key] || 0) + (lm.capacity_per_lambda || 100);
  });

  if (routerRows.length === 0) {
    content.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px">Sin interfaces ISP configuradas.</div>`;
    return;
  }

  let html = `<div class="isp-matrix-scroll"><table class="isp-matrix-table">
    <thead>
      <tr>
        <th class="isp-matrix-th">Ruteador</th>
        <th class="isp-matrix-th">Proveedor</th>
        <th class="isp-matrix-th">Interfaces</th>
        <th class="isp-matrix-th">Capacidad</th>
      </tr>
    </thead>
    <tbody>`;

  routerRows.forEach(row => {
    const ifaceDisplay = lagGrouped
      ? `<span class="isp-lag-badge">${row.count}×100G LAG</span>`
      : row.ifaces.map(n => `<code class="isp-iface-name">${n}</code>`).join(" ");
    html += `<tr>
      <td class="isp-matrix-td"><span class="isp-brand-dot" style="background:${BRAND_COLOR[row.brand]}"></span>${row.rtrName}</td>
      <td class="isp-matrix-td">
        <span class="isp-provider-dot" style="background:${row.providerColor}"></span>${row.providerName}
      </td>
      <td class="isp-matrix-td">${ifaceDisplay}</td>
      <td class="isp-matrix-td isp-matrix-td--total">${lagGrouped ? row.capGbps + " Gbps" : row.count + "×100G"}</td>
    </tr>`;
  });

  // Separador y lambdas inter-router
  if (Object.keys(lambdaCap).length > 0) {
    html += `<tr><td colspan="4" class="isp-matrix-th" style="font-size:11px;padding-top:8px">⚡ Capacidad Lambda inter-ruteador</td></tr>`;
    const siteNameMap = {};
    routers.forEach(r => { siteNameMap[r.site_id] = r.name || r.site_id; });
    Object.entries(lambdaCap).forEach(([key, gbps]) => {
      const [a, b] = key.split("|");
      html += `<tr>
        <td class="isp-matrix-td" colspan="2">${siteNameMap[a] || a} ↔ ${siteNameMap[b] || b}</td>
        <td class="isp-matrix-td isp-matrix-td--cell"></td>
        <td class="isp-matrix-td isp-matrix-td--total">${gbps} Gbps</td>
      </tr>`;
    });
  }

  html += `</tbody></table></div>
    <div class="isp-matrix-note">Capacidad física disponible. ⚡ LAG agrupa interfaces por proveedor.</div>`;
  content.innerHTML = html;
}

function _lambdaEndpoints(lm) {
  // Retorna { ingress, egress } a partir de los segmentos de la lambda
  if (!lm.segments || lm.segments.length === 0) return null;
  const freq = {};
  lm.segments.forEach(s => {
    [s.site_a_id, s.site_b_id].forEach(sid => { freq[sid] = (freq[sid] || 0) + 1; });
  });
  const endpoints = Object.entries(freq).filter(([, c]) => c === 1).map(([s]) => s);
  if (endpoints.length !== 2) return null;
  return { ingress: endpoints[0], egress: endpoints[1] };
}

// ── Matriz de tráfico ─────────────────────────────────────────────────────────
function renderMatrix() {
  const content = document.getElementById("isp-matrix-content");
  if (!content) return;

  // Agrupar flujos por ingress_site y provider
  const rows = [];  // { label, providerColor, providerName, siteId, egressFlows: [{flowId, egressSite, count}] }
  const egresSet = new Set();
  flows.forEach(f => {
    egresSet.add(f.egress_site_id);
  });
  const egressSites = [...egresSet].sort();

  const rowMap = {};
  flows.forEach(f => {
    const key = `${f.isp_provider_id}_${f.ingress_site_id}`;
    if (!rowMap[key]) {
      rowMap[key] = {
        key,
        providerName: f.isp_provider_name,
        providerColor: f.isp_provider_color,
        ingressSiteId: f.ingress_site_id,
        ingressSiteName: f.ingress_site_name,
        egressMap: {},  // egress_site_id → flow
      };
      rows.push(rowMap[key]);
    }
    rowMap[key].egressMap[f.egress_site_id] = f;
  });

  // Capacidad ISP total por row (para mostrar % de uso)
  const ispCapacity = {};  // `${provider_id}_${site_id}` → count of ISP ifaces
  routers.forEach(r => {
    const ispIfaces = r.interfaces.filter(i => i.iface_type === "isp");
    const provGroups = {};
    ispIfaces.forEach(iface => {
      provGroups[iface.isp_provider_id] = (provGroups[iface.isp_provider_id] || 0) + 1;
    });
    Object.entries(provGroups).forEach(([pid, cnt]) => {
      ispCapacity[`${pid}_${r.site_id}`] = cnt;
    });
  });

  // Site names for egress columns
  const egressNames = {};
  flows.forEach(f => { egressNames[f.egress_site_id] = f.egress_site_name; });

  // Semáforo: clase CSS según % de utilización
  function semClass(pct) {
    return pct >= 80 ? "sem-red" : pct >= 60 ? "sem-yellow" : "sem-green";
  }

  // Construir tabla con valores en Gbps + semáforo
  let html = `<div class="isp-matrix-scroll"><table class="isp-matrix-table">
  <thead>
    <tr>
      <th class="isp-matrix-th">Proveedor / Sitio</th>
      ${egressSites.map(s => `<th class="isp-matrix-th isp-matrix-th--egress">${egressNames[s] || s}</th>`).join("")}
      <th class="isp-matrix-th">Total Gbps</th>
      <th class="isp-matrix-th">% Cap.</th>
    </tr>
  </thead>
  <tbody>`;

  rows.forEach(row => {
    const capKey    = `${providers.find(p => p.name === row.providerName)?.id ?? ""}_${row.ingressSiteId}`;
    const capIfaces = ispCapacity[capKey] || 0;
    const capGbps   = capIfaces * 100;
    // rowTotal in interfaces_count; convert to Gbps for display
    const rowIfaceTotal = egressSites.reduce((s, e) => s + (row.egressMap[e]?.interfaces_count || 0), 0);
    const rowGbps       = rowIfaceTotal * 100;
    const pct           = capGbps > 0 ? Math.round((rowGbps / capGbps) * 100) : 0;
    const sem           = semClass(pct);

    html += `<tr>
      <td class="isp-matrix-td isp-matrix-td--label">
        <span class="isp-provider-dot" style="background:${row.providerColor}"></span>
        <span class="isp-matrix-provider">${row.providerName}</span>
        <span class="isp-matrix-site">${row.ingressSiteName}</span>
      </td>
      ${egressSites.map(e => {
        const f = row.egressMap[e];
        const gbpsVal = f ? f.interfaces_count * 100 : null;
        const cellPct = (f && capGbps > 0) ? Math.round((f.interfaces_count * 100 / capGbps) * 100) : 0;
        const cellSem = semClass(cellPct);
        return `<td class="isp-matrix-td isp-matrix-td--cell ${f ? cellSem : ""}">
          ${f
            ? `<input class="isp-matrix-input" type="number" min="0" step="100" max="${capGbps || 9600}"
                 value="${gbpsVal}" data-flow-id="${f.id}" data-cap="${capGbps}"
                 title="${f.lambda_names ? "Lambdas: " + f.lambda_names : ""}">`
            : `<span class="isp-matrix-na">—</span>`}
        </td>`;
      }).join("")}
      <td class="isp-matrix-td isp-matrix-td--total ${sem}">${rowGbps} Gbps</td>
      <td class="isp-matrix-td isp-matrix-td--cap ${sem}">
        ${capGbps > 0 ? `<span class="isp-matrix-pct">${pct}%</span><span style="font-size:10px;display:block">${rowGbps}/${capGbps}G</span>` : "—"}
      </td>
    </tr>`;
  });

  // Fila de totales por egress (en Gbps)
  const colTotals = {};
  egressSites.forEach(e => {
    colTotals[e] = flows.filter(f => f.egress_site_id === e).reduce((s, f) => s + f.interfaces_count * 100, 0);
  });
  const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);
  html += `<tr class="isp-matrix-totals">
    <td class="isp-matrix-td isp-matrix-td--label"><b>Total ↓</b></td>
    ${egressSites.map(e => `<td class="isp-matrix-td isp-matrix-td--total"><b>${colTotals[e]}G</b></td>`).join("")}
    <td class="isp-matrix-td isp-matrix-td--total"><b>${grandTotal} Gbps</b></td>
    <td class="isp-matrix-td isp-matrix-td--cap"></td>
  </tr>`;

  html += "</tbody></table></div>";
  html += `<div class="isp-matrix-note">Valores en Gbps · Ingresa en múltiplos de 100 · Hover → lambdas de transporte.</div>`;
  content.innerHTML = html;

  // Eventos de edición inline (input en Gbps → guardar como interfaces_count = gbps/100)
  content.querySelectorAll(".isp-matrix-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const flowId  = +e.target.dataset.flowId;
      const capGbps = +e.target.dataset.cap || 9600;
      // Redondear a múltiplos de 100 y clampear al máximo de capacidad
      const gbps    = Math.min(Math.max(0, Math.round(+e.target.value / 100) * 100), capGbps);
      const ifaces  = gbps / 100;
      e.target.value = gbps;
      try {
        await API.updateTrafficFlow(flowId, { interfaces_count: ifaces });
        const updated = await API.getTrafficFlows();
        flows = updated;
        renderMatrix();
      } catch (err) {
        e.target.style.borderColor = "var(--accent-red)";
        setTimeout(() => e.target.style.borderColor = "", 2000);
      }
    });
  });
}

// ── Métricas ISIS ─────────────────────────────────────────────────────────────

function renderISPMetrics() {
  const content = document.getElementById("isp-metrics-content");
  if (!content) return;

  // Solo ruteadores propios: Cisco y Juniper
  const ownRouters = routers.filter(r => r.brand === "cisco" || r.brand === "juniper");

  if (ownRouters.length === 0) {
    content.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px">Sin ruteadores Cisco/Juniper disponibles.</div>`;
    return;
  }

  let html = `<div class="isp-metrics-list">`;

  for (const router of ownRouters) {
    const lambdaIfaces = (router.interfaces || []).filter(
      i => i.iface_type === "lambda" && i.isis_metric != null
    );
    if (lambdaIfaces.length === 0) continue;

    html += `
    <div class="isp-metrics-router">
      <div class="isp-metrics-router-header">
        <span class="isp-metrics-dot" style="background:${BRAND_COLOR[router.brand]}"></span>
        <span class="isp-metrics-rtr-name">${router.name}</span>
        <span class="isp-metrics-brand">${router.brand}</span>
      </div>
      <table class="isp-metrics-table">
        <thead><tr>
          <th>Interfaz</th><th>Lambda</th><th>Métrica</th>
        </tr></thead>
        <tbody>
          ${lambdaIfaces.map(iface => `
          <tr>
            <td class="isp-metrics-ifname">${iface.name}</td>
            <td class="isp-metrics-lname">${iface.lambda_name || "—"}</td>
            <td>
              <input class="isp-metric-input" type="number"
                min="1" max="16777214"
                value="${iface.isis_metric}"
                data-iface-id="${iface.id}"
                data-original="${iface.isis_metric}">
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  html += `</div>`;
  content.innerHTML = html;

  // Edición inline con feedback visual
  content.querySelectorAll(".isp-metric-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const ifaceId  = +e.target.dataset.ifaceId;
      const original = +e.target.dataset.original;
      const val = Math.max(1, Math.min(16777214, Math.round(+e.target.value)));
      e.target.value = val;
      if (val === original) return;

      e.target.classList.add("saving");
      try {
        await API.updateRouterInterface(ifaceId, { isis_metric: val });
        e.target.dataset.original = String(val);
        e.target.classList.remove("saving");
        e.target.classList.add("saved");
        setTimeout(() => e.target.classList.remove("saved"), 1500);
        // Actualizar en memoria para que el reload no revierta el valor
        for (const r of routers) {
          const iface = r.interfaces?.find(i => i.id === ifaceId);
          if (iface) { iface.isis_metric = val; break; }
        }
      } catch {
        e.target.value = original;
        e.target.classList.remove("saving");
        e.target.classList.add("error");
        setTimeout(() => e.target.classList.remove("error"), 2000);
      }
    });
  });
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function _ensureTooltip() {
  let tt = document.getElementById("isp-tooltip");
  if (!tt) {
    tt = document.createElement("div");
    tt.id = "isp-tooltip";
    tt.className = "d3-tooltip";
    tt.style.cssText = "display:none;position:fixed;pointer-events:none;z-index:9000";
    document.body.appendChild(tt);
  }
  return d3.select("#isp-tooltip");
}

function _positionTooltip(tooltip, e) {
  const x = e.clientX + 14;
  const y = e.clientY - 10;
  tooltip.style("left", `${x}px`).style("top", `${y}px`);
}


// ── Utilización Histórica (Excel import) ──────────────────────────────────────

function _initUtilUpload() {
  const fileInput  = document.getElementById("isp-util-file");
  const uploadBtn  = document.getElementById("isp-util-upload-btn");
  const labelEl    = document.querySelector("label[for='isp-util-file']");
  const statusEl   = document.getElementById("isp-util-status");

  if (!fileInput || !uploadBtn) return;

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    uploadBtn.disabled = !f;
    if (labelEl && f) labelEl.textContent = `📂 ${f.name}`;
  });

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadBtn.disabled = true;
    statusEl.innerHTML = `<div class="isp-util-msg isp-util-loading">Cargando…</div>`;
    try {
      const result = await API.uploadLambdaUtilization(file);
      const flagLines = result.flagged_rows?.length > 0
        ? `<details class="isp-util-flags"><summary>⚠ ${result.flagged_rows.length} filas con alertas</summary><ul>${
            result.flagged_rows.map(r => `<li><b>${r.link_name}</b> (${r.month}) — ${r.flags.join(", ")}${r.flags.includes("UNKNOWN_SITE") ? ` · sitio desconocido` : ""}</li>`).join("")
          }</ul></details>` : "";
      statusEl.innerHTML = `
        <div class="isp-util-msg isp-util-ok">
          ✅ ${result.records_imported} registros importados · meses: ${result.months_loaded?.join(", ")}
        </div>${flagLines}`;
      renderUtilHistory();
    } catch (err) {
      statusEl.innerHTML = `<div class="isp-util-msg isp-util-error">❌ ${err.error || "Error al cargar"}</div>`;
    } finally {
      uploadBtn.disabled = false;
    }
  });
}

async function renderUtilHistory() {
  const el = document.getElementById("isp-util-history");
  if (!el) return;
  try {
    const data = await API.getLambdaUtilization();
    if (!data.months || data.months.length === 0) {
      el.innerHTML = `<div class="isp-loading">Sin datos históricos. Carga un archivo Excel.</div>`;
      return;
    }

    // Construir tabla agrupada por mes, con semáforo
    let html = `<div class="isp-util-month-tabs">`;
    data.months.forEach((m, i) => {
      html += `<button class="btn-tool btn-sm isp-util-tab${i === 0 ? " active" : ""}" data-month="${m}">${m}</button>`;
    });
    html += `</div><div id="isp-util-table-wrap"></div>`;
    el.innerHTML = html;

    function showMonth(month) {
      const rows = data.data[month] || [];
      let t = `<div class="isp-matrix-scroll"><table class="isp-matrix-table isp-util-table">
        <thead><tr>
          <th class="isp-matrix-th">Enlace</th>
          <th class="isp-matrix-th">BW</th>
          <th class="isp-matrix-th">Max Gbps</th>
          <th class="isp-matrix-th">% Max</th>
          <th class="isp-matrix-th">AVG Gbps</th>
          <th class="isp-matrix-th">% AVG</th>
          <th class="isp-matrix-th">Lambda</th>
          <th class="isp-matrix-th">Alertas</th>
        </tr></thead><tbody>`;
      rows.forEach(r => {
        const semMax = r.pct_max >= 80 ? "sem-red" : r.pct_max >= 60 ? "sem-yellow" : "sem-green";
        const semAvg = r.pct_avg >= 80 ? "sem-red" : r.pct_avg >= 60 ? "sem-yellow" : "sem-green";
        const flagBadges = r.flags ? r.flags.split(",").map(f =>
          `<span class="isp-flag-badge isp-flag-${f.toLowerCase().replace("_","-")}">${f}</span>`
        ).join("") : "";
        t += `<tr class="${r.flags ? "isp-util-row-flagged" : ""}">
          <td class="isp-matrix-td" style="text-align:left;font-size:10px">${r.link_name}</td>
          <td class="isp-matrix-td">${r.bw_gbps}G</td>
          <td class="isp-matrix-td ${semMax}">${r.max_gbps ?? "—"}</td>
          <td class="isp-matrix-td ${semMax}">${r.pct_max != null ? r.pct_max + "%" : "—"}</td>
          <td class="isp-matrix-td ${semAvg}">${r.avg_gbps ?? "—"}</td>
          <td class="isp-matrix-td ${semAvg}">${r.pct_avg != null ? r.pct_avg + "%" : "—"}</td>
          <td class="isp-matrix-td" style="font-size:9px;color:var(--text-muted)">${r.lambda_name || "—"}</td>
          <td class="isp-matrix-td">${flagBadges}</td>
        </tr>`;
      });
      t += `</tbody></table></div>`;
      document.getElementById("isp-util-table-wrap").innerHTML = t;
    }

    // Mostrar primer mes por defecto
    showMonth(data.months[0]);

    // Tabs de meses
    el.querySelectorAll(".isp-util-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        el.querySelectorAll(".isp-util-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        showMonth(btn.dataset.month);
      });
    });
  } catch {
    el.innerHTML = `<div class="isp-loading">Error al cargar historial.</div>`;
  }
}
