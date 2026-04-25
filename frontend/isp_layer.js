/**
 * isp_layer.js — Vista de Capa IP/ISP
 * Muestra ruteadores, nubes ISP, lambdas de transporte y matriz de tráfico editable.
 */
import { API } from "./api.js";

// ── Constantes visuales ───────────────────────────────────────────────────────
const BRAND_COLOR = { cisco: "#2563EB", juniper: "#16A34A", cirion: "#8B5CF6", axtel: "#C2410C" };
const NODE_R      = 22;   // radio del nodo ruteador
const CLOUD_W     = 80;   // ancho de la nube ISP
const CLOUD_H     = 52;   // alto de la nube ISP

// ── Estado del módulo ─────────────────────────────────────────────────────────
let routers = [], providers = [], flows = [], lambdas = [], priorities = [];
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
        <button class="btn-tool" id="isp-btn-save-pos" title="Guardar posiciones de nodos">💾 Guardar posiciones</button>
        <button class="btn-tool" id="isp-btn-reset-pos" title="Restablecer layout automático">↺ Restablecer layout</button>
        <button class="btn-tool" id="isp-btn-reload" title="Recargar datos">↺ Actualizar</button>
        <button class="btn-tool isp-lag-btn" id="isp-lag-toggle" title="Agrupar interfaces como LAG" style="display:none">⚡ LAG</button>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="isp-tabs" id="isp-tabs">
      <button class="isp-tab active" data-tab="graph">🗾 Grafo lógico</button>
      <button class="isp-tab" data-tab="capacity">📦 Capacidad ISP</button>
      <button class="isp-tab" data-tab="traffic">📊 Tráfico / Uso</button>
      <button class="isp-tab" data-tab="priorities">🎯 Prioridades</button>
      <button class="isp-tab" data-tab="report">📋 Análisis Fallas</button>
      <button class="isp-tab" data-tab="validation">🔍 Validación Lambda</button>
      <button class="isp-tab" data-tab="metrics">📡 Métricas ISIS</button>
    </div>

    <!-- Paneles de pestaña -->
    <div class="isp-tab-panel active" id="isp-panel-graph">
      <div class="isp-graph-wrap" id="isp-graph-wrap">
        <svg id="isp-svg" style="width:100%;height:100%"></svg>
      </div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-capacity">
      <div class="isp-matrix-header">
        <span>📦 Capacidad ISP</span>
        <span class="isp-matrix-sub">Interfaces físicas por proveedor y sitio</span>
      </div>
      <div id="isp-capacity-content"><div class="isp-loading">Cargando…</div></div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-traffic">
      <div class="isp-matrix-header">
        <span>📊 Tráfico / Uso</span>
        <span class="isp-matrix-sub">Gbps por flujo — editable · 🟢&lt;60% 🟡60-79% 🔴≥80%</span>
      </div>
      <div id="isp-matrix-content"><div class="isp-loading">Cargando…</div></div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-priorities">
      <div class="isp-matrix-header">
        <span>🎯 Prioridades ISP</span>
        <span class="isp-matrix-sub">Orden de uso por PGW · 1=Primario 2=Secundario 3=Terciario</span>
      </div>
      <div id="isp-priority-content"><div class="isp-loading">Cargando…</div></div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-report">
      <div class="isp-matrix-header">
        <span>📋 Análisis de Fallas</span>
        <span class="isp-matrix-sub">Adecuación de prioridades · Criticidad de lambdas e ISPs</span>
      </div>
      <div id="isp-report-content">
        <div style="padding:12px">
          <button class="btn-tool" id="isp-report-btn">📊 Generar Reporte Completo</button>
        </div>
        <div id="isp-report-result"></div>
      </div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-validation">
      <div class="isp-matrix-header" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span>🔍 Validación de Conectividad Lambda</span>
          <span class="isp-matrix-sub" id="isp-val-summary">Verificando…</span>
        </div>
        <button class="btn-tool" id="isp-val-revalidate" title="Recargar datos y revalidar conectividad">🔄 Revalidar</button>
      </div>
      <div id="isp-validation-content"><div class="isp-loading">Cargando…</div></div>
    </div>

    <div class="isp-tab-panel" id="isp-panel-metrics">
      <div class="isp-metrics-header">
        <span>📡 Métricas ISIS</span>
        <span class="isp-matrix-sub">Cisco &amp; Juniper · default 10 · rango 1–16 777 214</span>
      </div>
      <div id="isp-metrics-content"><div class="isp-loading">Cargando…</div></div>
    </div>
  </div>`;

  await loadData();
  renderGraph();
  renderCapacityMatrix();
  renderMatrix();
  renderPriorityMatrix();
  renderISPMetrics();
  renderValidation();

  // ── Lógica de pestañas ────────────────────────────────────────────────────
  const PANELS = ['graph','capacity','traffic','priorities','metrics','report','validation'];
  document.getElementById('isp-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.isp-tab');
    if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.isp-tab').forEach(b => b.classList.toggle('active', b === btn));
    PANELS.forEach(id => {
      const panel = document.getElementById(`isp-panel-${id}`);
      if (panel) panel.classList.toggle('active', id === tab);
    });
    // Mostrar/ocultar botón LAG solo en pestaña Capacidad
    const lagBtn = document.getElementById('isp-lag-toggle');
    if (lagBtn) lagBtn.style.display = tab === 'capacity' ? '' : 'none';
    // Re-render grafo si se regresa a esa pestaña (por si el contenedor cambió de tamaño)
    if (tab === 'graph') renderGraph();
  });

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
    renderPriorityMatrix();
    renderISPMetrics();
    renderValidation();
  });

  document.getElementById("isp-report-btn")?.addEventListener("click", renderSimulationReport);

  // Botón Revalidar: recarga datos y re-ejecuta la validación
  document.getElementById("isp-val-revalidate")?.addEventListener("click", async () => {
    const btn = document.getElementById("isp-val-revalidate");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Validando…"; }
    const content = document.getElementById("isp-validation-content");
    if (content) content.innerHTML = `<div class="isp-loading">Recargando datos…</div>`;
    await loadData();
    renderValidation();
    if (btn) { btn.disabled = false; btn.textContent = "🔄 Revalidar"; }
  });
}


// ── Carga de datos ────────────────────────────────────────────────────────────
async function loadData() {
  [routers, providers, flows, lambdas, priorities] = await Promise.all([
    API.getRouters(),
    API.getISPProviders(),
    API.getTrafficFlows(),
    API.getLambdas(),
    API.getISPPriorities(),
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
    lambdaCap[key] = (lambdaCap[key] || 0) + (lm.total_capacity_gbps || lm.num_lambdas * (lm.capacity_per_lambda || 100));
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
      <td class="isp-matrix-td isp-matrix-td--total">${row.capGbps} Gbps${lagGrouped ? ` <span style="font-size:9px;opacity:0.7">(${row.count}×100G LAG)</span>` : ` <span style="font-size:9px;opacity:0.7">(${row.count}×100G)</span>`}</td>
    </tr>`;
  });

  // Separador y lambdas inter-router
  if (Object.keys(lambdaCap).length > 0) {
    const siteNameMap = {};
    routers.forEach(r => { siteNameMap[r.site_id] = r.name || r.site_id; });
    html += `<tr><td colspan="4" class="isp-matrix-th" style="font-size:11px;padding-top:8px">⚡ Capacidad Lambda inter-ruteador</td></tr>`;
    html += `<tr>
      <th class="isp-matrix-th" style="text-align:left">Sitio A</th>
      <th class="isp-matrix-th" style="text-align:left">Sitio B</th>
      <th class="isp-matrix-th">Enlace</th>
      <th class="isp-matrix-th">Capacidad</th>
    </tr>`;
    Object.entries(lambdaCap).forEach(([key, gbps]) => {
      const [a, b] = key.split("|");
      const nameA = siteNameMap[a] || a;
      const nameB = siteNameMap[b] || b;
      html += `<tr>
        <td class="isp-matrix-td" style="text-align:left;white-space:nowrap"><code style="font-size:10px;color:var(--accent-cyan)">${a}</code><span style="font-size:10px;color:var(--text-muted);margin-left:4px">${nameA !== a ? nameA : ''}</span></td>
        <td class="isp-matrix-td" style="text-align:left;white-space:nowrap"><code style="font-size:10px;color:var(--accent-cyan)">${b}</code><span style="font-size:10px;color:var(--text-muted);margin-left:4px">${nameB !== b ? nameB : ''}</span></td>
        <td class="isp-matrix-td" style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${nameA} ↔ ${nameB}</td>
        <td class="isp-matrix-td isp-matrix-td--total">${gbps} Gbps <span style="font-size:9px;opacity:0.7">(${gbps / 100}×100G)</span></td>
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

// ── Matriz de tráfico: filas = (sitio MSO egreso, PGW) · columnas = proveedor/sitio ingreso ──
function renderMatrix() {
  const content = document.getElementById("isp-matrix-content");
  if (!content) return;

  // Orden fijo de egress sites
  const EGRESS_ORDER = ["MSOGDL01", "MSOMER01", "MSOMEX01", "MSOMEX05", "MSOMTY01", "MSOTOL01"];
  const egressNames = {};
  flows.forEach(f => { egressNames[f.egress_site_id] = f.egress_site_name; });

  // Recopilar PGWs por egress site (orden alfabético)
  const pgwsByEgress = {};
  flows.forEach(f => {
    if (!pgwsByEgress[f.egress_site_id]) pgwsByEgress[f.egress_site_id] = new Set();
    pgwsByEgress[f.egress_site_id].add(f.pgw || "—");
  });

  // Lista de sub-filas: (egressId, pgw, isFirst, pgwCount)
  const rows = [];
  EGRESS_ORDER.filter(id => egressNames[id]).forEach(egressId => {
    const pgws = [...(pgwsByEgress[egressId] || new Set(["—"]))].sort();
    pgws.forEach((pgw, idx) => rows.push({ egressId, pgw, isFirst: idx === 0, pgwCount: pgws.length }));
  });

  // Columnas = (provider_id, ingress_site_id) únicos
  const colMap = {};
  const cols = [];
  flows.forEach(f => {
    const key = `${f.isp_provider_id}_${f.ingress_site_id}`;
    if (!colMap[key]) {
      colMap[key] = {
        key,
        providerName:    f.isp_provider_name,
        providerColor:   f.isp_provider_color,
        ingressSiteId:   f.ingress_site_id,
        ingressSiteName: f.ingress_site_name,
        provId:          f.isp_provider_id,
      };
      cols.push(colMap[key]);
    }
  });

  // Orden de columnas definido por el usuario
  const COLUMN_ORDER = [
    "Arelion_MSOJRZ01",
    "Gold Data_NFO-038",
    "Gold Data_TAMREY1273",
    "Cirion_CIRION-ZURICH",
    "Cirion_CIRION-MIRLO",
    "Cirion_CIRION-HUMBOLDT",
    "Axtel_MSOMER01",
    "Cirion_MSOMEX05",
    "Meta_KIO-QRO",
    "Amazon_KIO-QRO",
    "Akamai_KIO-QRO",
  ];
  cols.sort((a, b) => {
    const ia = COLUMN_ORDER.indexOf(`${a.providerName}_${a.ingressSiteId}`);
    const ib = COLUMN_ORDER.indexOf(`${b.providerName}_${b.ingressSiteId}`);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Lookup exacto: (provider_id, ingress_site_id, egress_site_id, pgw) → flow
  const flowLookup = {};
  flows.forEach(f => {
    const key = `${f.isp_provider_id}_${f.ingress_site_id}_${f.egress_site_id}_${f.pgw || "—"}`;
    flowLookup[key] = f;
  });

  // Capacidad ISP por (provider_id, ingress_site_id) en Gbps
  const ispCapacity = {};
  routers.forEach(r => {
    r.interfaces.filter(i => i.iface_type === "isp").forEach(iface => {
      const k = `${iface.isp_provider_id}_${r.site_id}`;
      ispCapacity[k] = (ispCapacity[k] || 0) + 100;
    });
  });

  function semClass(pct) {
    return pct >= 80 ? "sem-red" : pct >= 60 ? "sem-yellow" : "sem-green";
  }


  // Cabecera: sitio egreso | PGW | col por proveedor/sitio_ingreso | total
  let html = `<div class="isp-matrix-scroll"><table class="isp-matrix-table">
  <thead><tr>
    <th class="isp-matrix-th">Sitio MSO (Egreso)</th>
    <th class="isp-matrix-th">PGW</th>
    ${cols.map(col => {
      const capGbps = ispCapacity[`${col.provId}_${col.ingressSiteId}`] || 0;
      return `<th class="isp-matrix-th isp-matrix-th--egress" style="min-width:110px;text-align:center">
        <span class="isp-provider-dot" style="background:${col.providerColor}"></span>
        <span style="font-weight:700">${col.providerName}</span><br>
        <span style="font-weight:400;opacity:.75;font-size:10px">${col.ingressSiteName}</span>
        ${capGbps ? `<br><span style="font-size:9px;opacity:.45">${capGbps}G cap</span>` : ""}
      </th>`;
    }).join("")}
  </tr></thead><tbody>`;

  const colTotals = {};

  rows.forEach(row => {
    let rowTotal = 0;

    const cells = cols.map(col => {
      const f       = flowLookup[`${col.provId}_${col.ingressSiteId}_${row.egressId}_${row.pgw}`];
      if (!f) return `<td class="isp-matrix-td isp-matrix-td--cell"><span class="isp-matrix-na">—</span></td>`;

      const gbps    = f.traffic_gbps || 0;
      rowTotal     += gbps;
      colTotals[col.key] = (colTotals[col.key] || 0) + gbps;

      const capGbps = ispCapacity[`${col.provId}_${col.ingressSiteId}`] || 0;
      const cellPct = capGbps > 0 ? Math.round((gbps / capGbps) * 100) : 0;
      const tip     = f.lambda_names ? `Lambdas: ${f.lambda_names}` : "";
      return `<td class="isp-matrix-td isp-matrix-td--cell ${semClass(cellPct)}">
        <input class="isp-matrix-input" type="number" min="0" step="1" max="${capGbps || 9600}"
          value="${gbps}" data-flow-id="${f.id}" data-cap="${capGbps}" title="${tip}">
      </td>`;
    });

    // Celda del sitio: solo en la primera sub-fila, con rowspan
    const siteCell = row.isFirst
      ? `<td class="isp-matrix-td isp-matrix-td--site" rowspan="${row.pgwCount}">${egressNames[row.egressId] || row.egressId}</td>`
      : "";

    html += `<tr class="${row.isFirst ? "isp-matrix-site-first" : "isp-matrix-pgw-row"}">
      ${siteCell}
      <td class="isp-matrix-td isp-matrix-td--pgw">${row.pgw}</td>
      ${cells.join("")}
    </tr>`;
  });

  // Fila de totales: cada columna muestra Gbps + % de capacidad del enlace

  html += `<tr class="isp-matrix-totals">
    <td class="isp-matrix-td" colspan="2"><b>Total ↓</b></td>
    ${cols.map(col => {
      const colGbps = colTotals[col.key] || 0;
      const colCap  = ispCapacity[`${col.provId}_${col.ingressSiteId}`] || 0;
      const colPct  = colCap > 0 ? Math.round((colGbps / colCap) * 100) : 0;
      return `<td class="isp-matrix-td isp-matrix-td--total ${colCap ? semClass(colPct) : ""}">
        <b>${colGbps}G</b>
        ${colCap ? `<span class="isp-matrix-pct-tag ${semClass(colPct)}">${colPct}%</span>` : ""}
      </td>`;
    }).join("")}
  </tr>`;

  html += `</tbody></table></div>
  <div class="isp-matrix-note">Valores en Gbps · Editable directamente · Hover → lambdas de transporte.</div>`;
  content.innerHTML = html;

  // Edición inline
  content.querySelectorAll(".isp-matrix-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const flowId  = +e.target.dataset.flowId;
      const capGbps = +e.target.dataset.cap || 9600;
      const gbps    = Math.min(Math.max(0, Math.round(+e.target.value)), capGbps);
      e.target.value = gbps;
      try {
        await API.updateTrafficFlow(flowId, { traffic_gbps: gbps });
        flows = await API.getTrafficFlows();
        renderMatrix();
      } catch {
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

// ── Validación de Conectividad Lambda ─────────────────────────────────────────
function renderValidation() {
  const content = document.getElementById('isp-validation-content');
  const summary = document.getElementById('isp-val-summary');
  if (!content) return;

  // Construir mapa: site_id → lista de interfaces lambda por lambda_id
  // routerIfaceMap[site_id][lambda_id] = count de interfaces conectadas
  const routerIfaceMap = {};
  const routerNameMap  = {};
  routers.forEach(r => {
    routerNameMap[r.site_id] = r.name;
    routerIfaceMap[r.site_id] = routerIfaceMap[r.site_id] || {};
    (r.interfaces || []).filter(i => i.iface_type === 'lambda' && i.lambda_id).forEach(i => {
      routerIfaceMap[r.site_id][i.lambda_id] = (routerIfaceMap[r.site_id][i.lambda_id] || 0) + 1;
    });
  });

  // Prioridad de estado para ordenar (menor = más grave)
  const STATUS_PRI  = { missing: 0, 'no-router': 1, partial: 2, 'no-segments': 3, ok: 4 };
  const STATUS_ICON = {
    ok:           { icon: '✅', label: 'OK',              cls: 'val-ok'       },
    partial:      { icon: '⚠️', label: 'Parcial',         cls: 'val-partial'  },
    missing:      { icon: '🔴', label: 'Sin interfaz',    cls: 'val-missing'  },
    'no-router':  { icon: '🔴', label: 'Sin ruteador',    cls: 'val-missing'  },
    'no-segments':{ icon: '⬜', label: 'Sin segmentos',   cls: 'val-noseg'    },
  };

  function sideStatus(lm, siteId) {
    if (!siteId) return 'no-segments';
    if (!routerIfaceMap[siteId]) return 'no-router';
    const count = routerIfaceMap[siteId][lm.id] || 0;
    if (count === 0)               return 'missing';
    if (count < lm.num_lambdas)    return 'partial';
    return 'ok';
  }

  function ifaceDetail(lm, siteId) {
    if (!siteId || !routerIfaceMap[siteId]) return '—';
    const count = routerIfaceMap[siteId][lm.id] || 0;
    return count > 0 ? `${count} iface${count > 1 ? 's' : ''}` : 'ninguna';
  }

  const results = lambdas.map(lm => {
    const ends = _lambdaEndpoints(lm);
    const siteA = ends?.ingress || null;
    const siteB = ends?.egress  || null;
    const stA   = sideStatus(lm, siteA);
    const stB   = sideStatus(lm, siteB);
    const worst = STATUS_PRI[stA] <= STATUS_PRI[stB] ? stA : stB;
    return { lm, siteA, siteB, stA, stB, worst };
  });

  results.sort((a, b) => STATUS_PRI[a.worst] - STATUS_PRI[b.worst]);

  const alarms   = results.filter(r => !['ok','no-segments'].includes(r.worst));
  const ok       = results.filter(r => r.worst === 'ok');
  const noSegs   = results.filter(r => r.worst === 'no-segments');
  const total    = results.length;

  // Actualizar resumen del header
  if (summary) {
    if (alarms.length === 0) {
      summary.innerHTML = `<span style="color:var(--accent-green);font-weight:600">✅ ${ok.length}/${total} lambdas OK</span>`;
    } else {
      summary.innerHTML = `<span style="color:var(--accent-red);font-weight:600">🔴 ${alarms.length} alarma${alarms.length > 1 ? 's' : ''}</span>
        <span style="color:var(--text-muted)"> · ${ok.length} OK · ${noSegs.length} sin segmentos</span>`;
    }
  }

  let html = `<div class="isp-matrix-scroll"><table class="isp-matrix-table" style="min-width:700px">
    <thead><tr>
      <th class="isp-matrix-th" style="text-align:left">Lambda</th>
      <th class="isp-matrix-th">λ</th>
      <th class="isp-matrix-th">Extremo A (Ingress)</th>
      <th class="isp-matrix-th">Ruteador A</th>
      <th class="isp-matrix-th">Interfaces A</th>
      <th class="isp-matrix-th">Extremo B (Egress)</th>
      <th class="isp-matrix-th">Ruteador B</th>
      <th class="isp-matrix-th">Interfaces B</th>
      <th class="isp-matrix-th">Estado</th>
    </tr></thead>
    <tbody>`;

  results.forEach(({ lm, siteA, siteB, stA, stB, worst }) => {
    const iA = STATUS_ICON[stA];
    const iB = STATUS_ICON[stB];
    const rowBg = worst === 'ok' ? '' : worst === 'no-segments' ? 'opacity:0.6;' : 'background:rgba(239,68,68,0.06);';
    const rNameA = siteA ? (routerNameMap[siteA] || '—') : '—';
    const rNameB = siteB ? (routerNameMap[siteB] || '—') : '—';
    html += `<tr style="${rowBg}">
      <td class="isp-matrix-td" style="text-align:left;white-space:nowrap">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${lm.color};margin-right:6px;flex-shrink:0;vertical-align:middle"></span>
        <b style="font-size:11px">${lm.name}</b>
      </td>
      <td class="isp-matrix-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${lm.num_lambdas}×100G</td>
      <td class="isp-matrix-td"><code style="font-size:10px;color:var(--accent-cyan)">${siteA || '—'}</code></td>
      <td class="isp-matrix-td" style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${rNameA}</td>
      <td class="isp-matrix-td">
        <span class="isp-val-badge ${iA.cls}">${iA.icon} ${stA === 'ok' ? ifaceDetail(lm, siteA) : iA.label}</span>
      </td>
      <td class="isp-matrix-td"><code style="font-size:10px;color:var(--accent-cyan)">${siteB || '—'}</code></td>
      <td class="isp-matrix-td" style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${rNameB}</td>
      <td class="isp-matrix-td">
        <span class="isp-val-badge ${iB.cls}">${iB.icon} ${stB === 'ok' ? ifaceDetail(lm, siteB) : iB.label}</span>
      </td>
      <td class="isp-matrix-td">
        <span class="isp-val-badge ${STATUS_ICON[worst].cls}" style="font-weight:700">${STATUS_ICON[worst].icon} ${STATUS_ICON[worst].label}</span>
      </td>
    </tr>`;
  });

  html += `</tbody></table></div>
    <div class="isp-matrix-note">
      ✅ OK = interfaces ≥ num_lambdas en ambos extremos &nbsp;·&nbsp;
      ⚠️ Parcial = interfaces configuradas pero insuficientes &nbsp;·&nbsp;
      🔴 Sin interfaz / Sin ruteador = alarma activa
    </div>`;
  content.innerHTML = html;
}



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


// ── Matriz de Prioridades ISP ─────────────────────────────────────────────────

function renderPriorityMatrix() {
  const content = document.getElementById("isp-priority-content");
  if (!content) return;

  if (!priorities || priorities.length === 0) {
    content.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px">Sin prioridades configuradas.</div>`;
    return;
  }

  const EGRESS_ORDER = ["MSOGDL01", "MSOMER01", "MSOMEX01", "MSOMEX05", "MSOMTY01", "MSOTOL01"];
  const LEVEL_COLOR  = { 1: "#10B981", 2: "#EAB308", 3: "#F97316" };
  const LEVEL_TIP    = {
    1: "Primario: recibe tráfico mientras haya lambda activa, ruteador y proveedor ISP sin falla.",
    2: "Secundario: activo cuando el proveedor 1 tiene falla de lambda, ruteador o ISP.",
    3: "Terciario: activo cuando los proveedores 1 y 2 tienen falla simultánea.",
  };

  // Proveedores seleccionables: universales (no KIO-QRO, no exclusivos de Mérida)
  // Orden fijo: misma secuencia que COLUMN_ORDER en renderMatrix
  const PROV_ORDER = [
    "Arelion_MSOJRZ01", "Gold Data_NFO-038", "Gold Data_TAMREY1273",
    "Cirion_CIRION-ZURICH", "Cirion_CIRION-MIRLO", "Cirion_CIRION-HUMBOLDT",
  ];
  // Proveedores exclusivos por sitio egreso (no disponibles en otros sitios)
  const SITE_SPECIFIC_PROVIDERS = {
    "MSOMER01": ["Axtel_MSOMER01"],
    "MSOMEX05": ["Cirion_MSOMEX05"],
  };
  const provCatalog = {};
  flows.forEach(f => {
    const key = `${f.isp_provider_name}_${f.ingress_site_id}`;
    if (!provCatalog[key]) {
      provCatalog[key] = {
        isp_provider_id:   f.isp_provider_id,
        ingress_site_id:   f.ingress_site_id,
        isp_provider_name: f.isp_provider_name,
        ingress_site_name: f.ingress_site_name,
        color:             f.isp_provider_color,
      };
    }
  });

  function getAvailableProviders(egressSiteId) {
    const result = [];
    PROV_ORDER.forEach(k => { if (provCatalog[k]) result.push(provCatalog[k]); });
    (SITE_SPECIFIC_PROVIDERS[egressSiteId] || []).forEach(k => {
      if (provCatalog[k]) result.push(provCatalog[k]);
    });
    return result;
  }

  // Agrupar prioridades por (egress, pgw), con byLevel para acceso rápido
  const groups = {};
  priorities.forEach(p => {
    const key = `${p.egress_site_id}|${p.pgw}`;
    if (!groups[key]) groups[key] = {
      egress: p.egress_site_id, egressName: p.egress_site_name, pgw: p.pgw,
      byLevel: {}, byProvKey: {},
    };
    groups[key].byLevel[p.priority_level] = p;
    groups[key].byProvKey[`${p.isp_provider_id}_${p.ingress_site_id}`] = p;
  });

  // Ordenar filas según EGRESS_ORDER × PGW
  const sortedGroups = [];
  EGRESS_ORDER.forEach(egId => {
    ["PGW1", "PGW2"].forEach(pgw => {
      const g = groups[`${egId}|${pgw}`];
      if (g) sortedGroups.push(g);
    });
  });

  // Encabezado de tabla
  let html = `
  <div style="padding:10px 12px 6px;font-size:11px;color:var(--text-muted);line-height:1.5;border-bottom:1px solid var(--border);margin-bottom:4px">
    <b style="color:var(--text-secondary)">Reglas de prioridad:</b>
    <span style="margin-left:6px">
      <span style="color:#10B981">●</span> <b>P1</b> Primario — activo sin fallas ·
      <span style="color:#EAB308">●</span> <b>P2</b> Secundario — falla en P1 ·
      <span style="color:#F97316">●</span> <b>P3</b> Terciario — falla en P1 y P2
    </span>
    <span style="margin-left:12px;opacity:.7">Meta / Amazon / Akamai / KIO Querétaro: su tráfico se suma al proveedor activo durante simulaciones.</span>
  </div>
  <div class="isp-matrix-scroll"><table class="isp-matrix-table">
  <thead><tr>
    <th class="isp-matrix-th">Sitio MSO (Egreso)</th>
    <th class="isp-matrix-th">PGW</th>
    <th class="isp-matrix-th" title="${LEVEL_TIP[1]}" style="color:#10B981;cursor:help">P1 — Primario</th>
    <th class="isp-matrix-th" title="${LEVEL_TIP[2]}" style="color:#EAB308;cursor:help">P2 — Secundario</th>
    <th class="isp-matrix-th" title="${LEVEL_TIP[3]}" style="color:#F97316;cursor:help">P3 — Terciario</th>
  </tr></thead><tbody>`;

  // Agrupar por egress para rowspan
  const egressGroups = {};
  sortedGroups.forEach(g => {
    if (!egressGroups[g.egress]) egressGroups[g.egress] = [];
    egressGroups[g.egress].push(g);
  });

  sortedGroups.forEach((g, rowIdx) => {
    const avail = getAvailableProviders(g.egress);
    const isFirstPgw = rowIdx === 0 || sortedGroups[rowIdx - 1].egress !== g.egress;
    const pgwCount = egressGroups[g.egress]?.length || 1;

    const siteCell = isFirstPgw
      ? `<td class="isp-matrix-td isp-matrix-td--site" rowspan="${pgwCount}">${g.egressName || g.egress}</td>`
      : "";

    const levelCells = [1, 2, 3].map(level => {
      const rec = g.byLevel[level];
      const currentVal = rec ? `${rec.isp_provider_id}_${rec.ingress_site_id}` : "";
      const color = LEVEL_COLOR[level];
      const opts = avail.map(p => {
        const val = `${p.isp_provider_id}_${p.ingress_site_id}`;
        const sel = val === currentVal ? " selected" : "";
        return `<option value="${val}"${sel}>${p.isp_provider_name} — ${p.ingress_site_name}</option>`;
      }).join("");
      return `<td class="isp-matrix-td isp-matrix-td--cell" style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="isp-prio-level-dot" style="background:${color}"></span>
          <select class="isp-prio-select"
            data-egress="${g.egress}" data-pgw="${g.pgw}" data-level="${level}"
            data-rec-id="${rec?.id ?? ""}">
            ${opts}
          </select>
        </div>
      </td>`;
    }).join("");

    html += `<tr class="${isFirstPgw ? "isp-matrix-site-first" : "isp-matrix-pgw-row"}">
      ${siteCell}
      <td class="isp-matrix-td isp-matrix-td--pgw">${g.pgw}</td>
      ${levelCells}
    </tr>`;
  });

  html += `</tbody></table></div>
  <div class="isp-matrix-note">Selecciona el proveedor activo en cada nivel de prioridad. Meta / Amazon / Akamai suman su tráfico al proveedor activo.</div>`;
  content.innerHTML = html;

  // Eventos de cambio en selects
  content.querySelectorAll(".isp-prio-select").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      const egressId  = e.target.dataset.egress;
      const pgw       = e.target.dataset.pgw;
      const recId     = +e.target.dataset.recId;
      const [newProvId, newIngress] = e.target.value.split("_");
      const groupKey  = `${egressId}|${pgw}`;
      const g         = groups[groupKey];
      if (!g || !recId) return;

      e.target.disabled = true;
      try {
        // ¿El proveedor seleccionado ya existe en otro nivel del mismo grupo?
        const provKey   = `${newProvId}_${newIngress}`;
        const conflict  = g.byProvKey[provKey];

        if (conflict && conflict.id !== recId) {
          // Swap de niveles entre el registro actual y el conflictivo
          await API.reorderISPPriorities({ id_a: recId, id_b: conflict.id });
        } else if (!conflict) {
          // Proveedor nuevo en el grupo: reemplazar provider del registro actual
          await API.updateISPPriority(recId, {
            isp_provider_id: +newProvId,
            ingress_site_id: newIngress,
          });
        }
        // Si conflict.id === recId: misma selección, no-op
        priorities = await API.getISPPriorities();
        renderPriorityMatrix();
      } catch {
        e.target.style.borderColor = "var(--accent-red)";
        setTimeout(() => { e.target.style.borderColor = ""; e.target.disabled = false; }, 2000);
      }
    });
  });
}


// ── Reporte de simulación ─────────────────────────────────────────────────────

async function renderSimulationReport() {
  const btn    = document.getElementById("isp-report-btn");
  const result = document.getElementById("isp-report-result");
  if (!result) return;

  if (btn) { btn.disabled = true; btn.textContent = "⏳ Generando…"; }
  result.innerHTML = `<div class="isp-loading">Analizando…</div>`;

  try {
    const data = await API.getSimulationReport();
    let html = "";

    // ── Sección 1: Adecuación de prioridades (por proveedor P1 que falla) ───────
    html += `<details open><summary class="isp-report-section">
      🎯 Adecuación de Prioridades ISP
      <span class="isp-report-badge ${data.priority_adequacy.every(r => r.adequate) ? "badge-ok" : "badge-warn"}">
        ${data.priority_adequacy.filter(r => r.adequate).length}/${data.priority_adequacy.length} OK
      </span>
    </summary>
    <div class="isp-matrix-scroll"><table class="isp-matrix-table">
      <thead><tr>
        <th class="isp-matrix-th">Si falla…</th>
        <th class="isp-matrix-th">Sitios afectados</th>
        <th class="isp-matrix-th">Tráfico total</th>
        <th class="isp-matrix-th">Cap. Fallback real</th>
        <th class="isp-matrix-th">Estado</th>
      </tr></thead><tbody>`;

    data.priority_adequacy.forEach(r => {
      const sitesHtml = r.affected_sites.map(s =>
        `<div style="font-size:10px;white-space:nowrap">${s.egress_site_name} ${s.pgw}: ${s.traffic_gbps} Gbps</div>`
      ).join("");
      const fbHtml = r.fallback_details.map(f =>
        `<div style="font-size:10px;white-space:nowrap">P${f.priority_level} ${f.provider} / ${f.ingress_site_name}: ${f.available_gbps} Gbps libre (${f.used_gbps}/${f.capacity_gbps} usado)</div>`
      ).join("");
      html += `<tr>
        <td class="isp-matrix-td">
          <span class="isp-provider-dot" style="background:${r.primary_color}"></span>
          <strong>${r.primary_provider}</strong><br>
          <span style="font-size:10px;color:var(--text-muted)">${r.primary_ingress_site}</span>
        </td>
        <td class="isp-matrix-td" style="min-width:160px">${sitesHtml}</td>
        <td class="isp-matrix-td"><strong>${r.total_gbps} Gbps</strong></td>
        <td class="isp-matrix-td" style="min-width:220px">${fbHtml}
          <div style="font-size:11px;font-weight:600;margin-top:2px;border-top:1px solid var(--border);padding-top:2px">
            Total: ${r.fallback_capacity_gbps} Gbps
          </div>
        </td>
        <td class="isp-matrix-td ${r.adequate ? "sem-green" : "sem-red"}">${r.adequate ? "✅ OK" : "⚠ Déficit"}</td>
      </tr>`;
    });
    html += `</tbody></table></div></details>`;

    // ── Sección 2: Lambdas más críticas ──────────────────────────────────────
    html += `<details><summary class="isp-report-section">⚡ Lambdas Más Críticas (por tráfico en riesgo)</summary>
    <div class="isp-matrix-scroll"><table class="isp-matrix-table">
      <thead><tr>
        <th class="isp-matrix-th">#</th>
        <th class="isp-matrix-th" style="text-align:left">Lambda</th>
        <th class="isp-matrix-th">Tráfico en Riesgo</th>
      </tr></thead><tbody>`;

    data.lambda_ranking.slice(0, 15).forEach((r, i) => {
      html += `<tr>
        <td class="isp-matrix-td">${i + 1}</td>
        <td class="isp-matrix-td" style="text-align:left;font-size:10px">${r.lambda_name}</td>
        <td class="isp-matrix-td ${r.traffic_at_risk_gbps >= 30 ? "sem-red" : "sem-yellow"}">${r.traffic_at_risk_gbps} Gbps</td>
      </tr>`;
    });
    html += `</tbody></table></div></details>`;

    // ── Sección 3: Proveedores ISP más críticos ────────────────────────────────
    html += `<details><summary class="isp-report-section">🌐 Proveedores ISP Más Críticos</summary>
    <div class="isp-matrix-scroll"><table class="isp-matrix-table">
      <thead><tr>
        <th class="isp-matrix-th">#</th>
        <th class="isp-matrix-th">Proveedor</th>
        <th class="isp-matrix-th">Sitio de Ingreso</th>
        <th class="isp-matrix-th">Flujos</th>
        <th class="isp-matrix-th">Tráfico Total</th>
      </tr></thead><tbody>`;

    data.provider_ranking.forEach((r, i) => {
      html += `<tr>
        <td class="isp-matrix-td">${i + 1}</td>
        <td class="isp-matrix-td">
          <span class="isp-provider-dot" style="background:${r.color}"></span>${r.provider}
        </td>
        <td class="isp-matrix-td" style="font-size:11px;color:var(--text-muted)">${r.ingress_site_name || r.ingress_site_id}</td>
        <td class="isp-matrix-td">${r.flows}</td>
        <td class="isp-matrix-td ${r.traffic_gbps >= 60 ? "sem-red" : r.traffic_gbps >= 30 ? "sem-yellow" : "sem-green"}">${r.traffic_gbps} Gbps</td>
      </tr>`;
    });
    html += `</tbody></table></div></details>`;

    // Botón exportar CSV
    html += `<div style="padding:10px;display:flex;gap:8px">
      <button class="btn-tool btn-sm" id="isp-export-csv">⬇ Exportar CSV</button>
    </div>`;

    result.innerHTML = html;

    // Export CSV
    document.getElementById("isp-export-csv")?.addEventListener("click", () => {
      const lines = ["Sección,Proveedor P1,Sitios afectados,Tráfico total (Gbps),Cap. Fallback (Gbps),Estado"];
      data.priority_adequacy.forEach(r => {
        const sites = r.affected_sites.map(s => `${s.egress_site_name} ${s.pgw}`).join("; ");
        lines.push(`Prioridades,"${r.primary_provider} - ${r.primary_ingress_site}","${sites}",${r.total_gbps},${r.fallback_capacity_gbps},${r.adequate ? "OK" : "Déficit"}`);
      });
      data.lambda_ranking.forEach((r, i) => {
        lines.push(`Lambdas,${r.lambda_name},,${r.traffic_at_risk_gbps},Posición ${i + 1}`);
      });
      data.provider_ranking.forEach((r, i) => {
        lines.push(`Proveedores,${r.provider} - ${r.ingress_site_name || r.ingress_site_id},,${r.traffic_gbps},Posición ${i + 1}`);
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `reporte_fallas_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    });

  } catch (err) {
    result.innerHTML = `<div class="isp-util-msg isp-util-error">❌ ${err.error || err.message || "Error al generar reporte"}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "📊 Generar Reporte Completo"; }
  }
}
