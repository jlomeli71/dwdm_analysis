/**
 * Módulo de Topología — Grafo D3.js + Mapa Geográfico de México
 */
import { API } from './api.js';

let sites = [], lambdas = [], segments = [];
let selectedLambdas = new Set();
let topoMode = "graph"; // "graph" | "map"
let g = null;
let tooltip = null;
let mexicoGeoData = false;      // false = sin cargar, null = falló, objeto = cargado
let estadosGeoData = false;    // false = sin cargar, null = falló, array features = cargado
let showEstados = true;        // toggle demarcación de estados en mapa
let graphNodes = [], graphLinks = []; // datos actuales para exportación
let currentZoom = null;  // instancia d3.zoom activa (grafo y mapa)
let currentD3Svg = null; // selección D3 del SVG activo
let showLabel = "name";  // "name" | "id" — compartida entre grafo y mapa

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGraph(sitesData, segmentsData, _lambdasData) {
  const nodes = sitesData.map(s => ({
    id: s.id, name: s.name, type: s.type, region: s.region,
    city: s.city, lat: s.lat, lon: s.lon,
  }));

  // Agrupar segmentos entre mismos pares A-B (múltiples fibras = "tubo")
  const edgeMap = new Map();
  segmentsData.forEach(seg => {
    const key = `${seg.site_a_id}|${seg.site_b_id}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    edgeMap.get(key).push(seg);
  });

  const links = [];
  edgeMap.forEach((segs, key) => {
    const [a, b] = key.split("|");
    links.push({ source: a, target: b, segments: segs });
  });

  return { nodes, links };
}


// ── Render Topology ───────────────────────────────────────────────────────────

export async function renderTopology(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Topología de Red DWDM</div>
        <div class="page-subtitle">Red ISP Tx — Red óptica ISP México</div>
      </div>
    </div>
    <div class="topology-toolbar">
      <div class="topo-toggle" id="topo-mode-toggle">
        <button class="active" data-mode="graph">⬡ Grafo Lógico</button>
        <button data-mode="map">🗺 Mapa Geográfico</button>
      </div>
      <div class="topo-toggle" id="label-toggle">
        <button class="active" data-label="name">Nombre</button>
        <button data-label="id">Site ID</button>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-center">⊙ Centrar</button>
      <button class="btn btn-secondary btn-sm" id="btn-estados" title="Mostrar/ocultar demarcación de estados" style="display:none">🗾 Estados</button>
      <button class="btn btn-secondary btn-sm" id="btn-save-coords" style="display:none" disabled>💾 Guardar posiciones</button>
      <div class="zoom-controls">
        <button class="btn btn-secondary btn-sm" id="btn-zoom-in"  title="Acercar">＋</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-out" title="Alejar">－</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-fit" title="Ajustar a la pantalla">⤢</button>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-reset-sel">✕ Quitar selección</button>
      <div class="export-dropdown-wrap" id="export-wrap">
        <button class="btn btn-secondary btn-sm" id="btn-export">⬇ Exportar ▾</button>
        <div class="export-menu" id="export-menu">
          <button data-fmt="png">🖼&nbsp; PNG (imagen)</button>
          <button data-fmt="svg">📐&nbsp; SVG (vector)</button>
          <button data-fmt="pdf">📄&nbsp; PDF</button>
          <button data-fmt="graphml">🔷&nbsp; GraphML (yEd)</button>
          <button data-fmt="dot">🔵&nbsp; DOT (Graphviz)</button>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-isp-layer" title="Mostrar/ocultar ruteadores y proveedores ISP">🌐 Capa IP</button>
      <span id="topo-status" style="font-size:12px;color:var(--text-muted);margin-left:auto;"></span>
    </div>

    <div style="display:flex;gap:12px;position:relative;">
      <!-- Topology SVG -->
      <div style="flex:1;position:relative;">
        <svg id="topology-svg"></svg>
        <div id="unlocated-panel" class="unlocated-panel" style="display:none;"></div>
      </div>
      <!-- Lambda List -->
      <div class="lambda-sidebar" style="position:relative;height:calc(100vh - 220px);">
        <div class="lambda-sidebar-title" id="lambda-sidebar-title">🔆 Lambdas (${lambdas.length})</div>
        <div id="lambda-list"></div>
      </div>
    </div>
    <div class="d3-tooltip" id="d3-tooltip"></div>
  `;

  [sites, lambdas, segments] = await Promise.all([
    API.getSites(), API.getLambdas(), API.getSegments(),
  ]);

  tooltip = document.getElementById("d3-tooltip");

  // Toggle de modo
  const btnEstados  = document.getElementById("btn-estados");
  const btnSaveCoords = document.getElementById("btn-save-coords");
  function syncEstadosBtn() {
    const isMap = topoMode === "map";
    btnEstados.style.display    = isMap ? "" : "none";
    btnSaveCoords.style.display = isMap ? "" : "none";
    btnEstados.classList.toggle("active-tool", showEstados);
  }
  document.getElementById("topo-mode-toggle").addEventListener("click", e => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    document.querySelectorAll("#topo-mode-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    topoMode = btn.dataset.mode;
    syncEstadosBtn();
    drawTopology();
  });

  btnEstados.addEventListener("click", () => {
    showEstados = !showEstados;
    syncEstadosBtn();
    // Mostrar u ocultar la capa de estados sin redibujar todo
    const estadosG = document.getElementById("estados-layer");
    if (estadosG) estadosG.style.display = showEstados ? "" : "none";
  });

  // Toggle de label
  document.getElementById("label-toggle").addEventListener("click", e => {
    const btn = e.target.closest("button[data-label]");
    if (!btn) return;
    document.querySelectorAll("#label-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showLabel = btn.dataset.label;
    g && g.selectAll(".node-label").text(d => showLabel === "name" ? d.name : d.id);
  });

  // ── Zoom controls ───────────────────────────────────────────────────────────
  function applyZoom(factor) {
    if (!currentZoom || !currentD3Svg) return;
    currentD3Svg.transition().duration(250)
      .call(currentZoom.scaleBy, factor);
  }
  document.getElementById("btn-zoom-in") .addEventListener("click", () => applyZoom(1.4));
  document.getElementById("btn-zoom-out").addEventListener("click", () => applyZoom(1 / 1.4));
  document.getElementById("btn-zoom-fit").addEventListener("click", () => {
    if (!currentZoom || !currentD3Svg || !g) return;
    const svgEl  = document.getElementById("topology-svg");
    const { width: W, height: H } = svgEl.getBoundingClientRect();
    const gEl = g.node();
    if (!gEl) return;
    const bb = gEl.getBBox();
    if (!bb.width || !bb.height) return;
    const pad    = 40;
    const scaleX = (W - pad * 2) / bb.width;
    const scaleY = (H - pad * 2) / bb.height;
    const scale  = Math.min(scaleX, scaleY, 4);
    const tx = W / 2 - scale * (bb.x + bb.width  / 2);
    const ty = H / 2 - scale * (bb.y + bb.height / 2);
    currentD3Svg.transition().duration(400)
      .call(currentZoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  });

  document.getElementById("btn-reset-sel").addEventListener("click", () => {
    selectedLambdas.clear();
    document.querySelectorAll(".lambda-item").forEach(el => el.classList.remove("selected"));
    updateLambdaSidebarTitle();
    updateHighlights();
  });

  // ── Toggle Capa IP ──────────────────────────────────────────────────────────
  let ispLayerActive = false;
  let ispRouters = null;
  const btnISP = document.getElementById("btn-isp-layer");
  btnISP?.addEventListener("click", async () => {
    ispLayerActive = !ispLayerActive;
    btnISP.classList.toggle("active-tool", ispLayerActive);
    if (ispLayerActive) {
      if (!ispRouters) {
        try { ispRouters = await (await import("./api.js")).API.getRouters(); } catch { ispRouters = []; }
      }
      _renderISPOverlay(ispRouters);
    } else {
      document.querySelectorAll(".router-isp-badge").forEach(el => el.remove());
    }
  });

  function _renderISPOverlay(rtrData) {
    // Eliminar badges previos (inyectados como hijos de cada .node-group)
    document.querySelectorAll(".router-isp-badge").forEach(el => el.remove());

    const BRAND_COLOR_LOCAL = { cisco: "#2563EB", juniper: "#16A34A", cirion: "#8B5CF6" };
    const rtrBySite = Object.fromEntries(rtrData.map(r => [r.site_id, r]));

    // Adjuntar el badge directamente al .node-group de D3.
    // Al estar dentro del grupo, hereda su transform="translate(x,y)" y se mueve
    // automáticamente con el nodo al hacer drag o al cambiar entre grafo y mapa.
    document.querySelectorAll(".node-group").forEach(el => {
      const datum = el.__data__;
      if (!datum?.id) return;
      const rtr = rtrBySite[datum.id];
      if (!rtr) return;

      const color = BRAND_COLOR_LOCAL[rtr.brand] || "#888";
      const arm   = 7;

      const badge = document.createElementNS("http://www.w3.org/2000/svg", "g");
      badge.setAttribute("class", "router-isp-badge");
      badge.setAttribute("pointer-events", "none");

      // Círculo de router (coordenadas relativas al grupo → 0, 0 = centro del nodo)
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", "10"); circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "#fff"); circle.setAttribute("stroke-width", "1.5");
      circle.setAttribute("opacity", "0.9");
      badge.appendChild(circle);

      // Cruz blanca centrada
      ["h", "v"].forEach(dir => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        if (dir === "h") { line.setAttribute("x1", -arm); line.setAttribute("y1", "0"); line.setAttribute("x2", arm); line.setAttribute("y2", "0"); }
        else             { line.setAttribute("x1", "0"); line.setAttribute("y1", -arm); line.setAttribute("x2", "0"); line.setAttribute("y2", arm); }
        line.setAttribute("stroke", "#fff"); line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-linecap", "round");
        badge.appendChild(line);
      });

      // Nubes ISP: una elipse por proveedor, distribuidas radialmente alrededor del nodo
      const ispIfaces = rtr.interfaces.filter(i => i.iface_type === "isp");
      const provsSeen = new Set();
      let provIdx = 0;
      ispIfaces.forEach(iface => {
        if (provsSeen.has(iface.isp_provider_id)) return;
        provsSeen.add(iface.isp_provider_id);
        const total = [...new Set(ispIfaces.map(i => i.isp_provider_id))].length;
        const angle = (provIdx / total) * Math.PI * 2 - Math.PI / 2;
        const dist  = 44;
        const cx    = Math.cos(angle) * dist;
        const cy    = Math.sin(angle) * dist;
        provIdx++;

        // Línea de conexión
        const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
        ln.setAttribute("x1", "0"); ln.setAttribute("y1", "0");
        ln.setAttribute("x2", cx);  ln.setAttribute("y2", cy);
        ln.setAttribute("stroke", iface.isp_provider_color || "#888");
        ln.setAttribute("stroke-width", "1.5"); ln.setAttribute("stroke-dasharray", "3,2");
        ln.setAttribute("opacity", "0.75");
        badge.appendChild(ln);

        // Elipse nube
        const ell = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        ell.setAttribute("cx", cx); ell.setAttribute("cy", cy);
        ell.setAttribute("rx", "15"); ell.setAttribute("ry", "9");
        ell.setAttribute("fill", iface.isp_provider_color || "#888"); ell.setAttribute("fill-opacity", "0.20");
        ell.setAttribute("stroke", iface.isp_provider_color || "#888"); ell.setAttribute("stroke-width", "1.5");
        badge.appendChild(ell);

        // Etiqueta proveedor
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", cx); txt.setAttribute("y", cy + 3.5);
        txt.setAttribute("text-anchor", "middle"); txt.setAttribute("font-size", "6");
        txt.setAttribute("fill", iface.isp_provider_color || "#888"); txt.setAttribute("font-weight", "700");
        txt.textContent = (iface.isp_provider_name || "ISP").substring(0, 7);
        badge.appendChild(txt);
      });

      el.appendChild(badge);
    });
  }

  // ── Export dropdown ─────────────────────────────────────────────────────────
  const btnExport  = document.getElementById("btn-export");
  const exportMenu = document.getElementById("export-menu");
  btnExport.addEventListener("click", e => {
    e.stopPropagation();
    exportMenu.classList.toggle("open");
  });
  document.addEventListener("click", () => exportMenu.classList.remove("open"));
  exportMenu.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-fmt]");
    if (!btn) return;
    exportMenu.classList.remove("open");
    const fmt = btn.dataset.fmt;
    if      (fmt === "png")     await exportAsPNG();
    else if (fmt === "svg")     exportAsSVG();
    else if (fmt === "pdf")     await exportAsPDF();
    else if (fmt === "graphml") exportAsGraphML();
    else if (fmt === "dot")     exportAsDOT();
  });

  // Render lambda list
  const lambdaList = document.getElementById("lambda-list");
  lambdas.forEach(l => {
    const item = document.createElement("div");
    item.className = "lambda-item";
    item.dataset.id = l.id;
    item.innerHTML = `
      <span class="color-dot" style="background:${l.color}"></span>
      <span style="flex:1;line-height:1.3">${l.name}</span>
    `;
    item.addEventListener("click", () => {
      if (selectedLambdas.has(l.id)) {
        selectedLambdas.delete(l.id);
      } else {
        selectedLambdas.add(l.id);
      }
      document.querySelectorAll(".lambda-item").forEach(el => {
        el.classList.toggle("selected", selectedLambdas.has(+el.dataset.id));
      });
      updateLambdaSidebarTitle();
      updateHighlights();
    });
    lambdaList.appendChild(item);
  });

  drawTopology();
}

async function drawTopology() {
  const svgEl = document.getElementById("topology-svg");
  if (!svgEl) return;

  // Esperar un frame para que el navegador calcule el layout antes de leer dimensiones
  await new Promise(r => requestAnimationFrame(r));
  if (!document.getElementById("topology-svg")) return; // puede haber navegado ya

  svgEl.innerHTML = "";

  // getBoundingClientRect() es más fiable que clientWidth/clientHeight en SVG
  const bbox = svgEl.getBoundingClientRect();
  const W = Math.round(bbox.width)  || svgEl.parentElement.getBoundingClientRect().width  || 900;
  const H = Math.round(bbox.height) || svgEl.parentElement.getBoundingClientRect().height || 600;

  const d3svg = d3.select("#topology-svg")
    .attr("width",  W)
    .attr("height", H)
    .attr("viewBox", `0 0 ${W} ${H}`);

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.2, 8])
    .on("zoom", e => g && g.attr("transform", e.transform));
  d3svg.call(zoom);
  currentZoom   = zoom;
  currentD3Svg  = d3svg;

  document.getElementById("btn-center").onclick = () => {
    d3svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity);
  };

  g = d3svg.append("g");

  const { nodes, links } = buildGraph(sites, segments, lambdas);
  graphNodes = nodes;
  graphLinks = links;

  if (topoMode === "map") {
    await renderMap(g, nodes, links, W, H);
  } else {
    renderForceGraph(g, nodes, links, W, H, zoom, d3svg);
  }
  // Re-aplicar highlights si hay selección activa
  if (selectedLambdas.size > 0) updateHighlights();
}

function renderForceGraph(g, nodes, links, W, H, zoom, d3svg) {
  const unlocated = document.getElementById("unlocated-panel");
  unlocated && (unlocated.style.display = "none");

  const LINE_SPACING = 4; // px de separación entre lambdas paralelas

  // ── Por cada enlace, qué lambdas lo usan ─────────────────────────────────
  const lambdasByLink = new Map();
  links.forEach(link => {
    const here = lambdas.filter(lam =>
      lam.segments && link.segments.some(seg =>
        lam.segments.some(ls => ls.segment_id === seg.id)
      )
    );
    lambdasByLink.set(link, here);
  });

  // ── Líneas de hit transparentes (tooltip de enlace) ───────────────────────
  const linkHit = g.append("g").attr("class", "link-hits")
    .selectAll("line").data(links).join("line")
    .attr("stroke", "transparent")
    .attr("stroke-width", 18)
    .attr("cursor", "pointer")
    .on("mouseover", (event, d) => showEdgeTooltip(event, d))
    .on("mouseout",  () => hideTooltip())
    .on("click",     (event, d) => showEdgeTooltip(event, d, true));

  // ── Líneas paralelas por lambda ───────────────────────────────────────────
  const allSubLines = []; // {line, link, i, total}
  const lambdaLinesG = g.append("g").attr("class", "lambda-lines");

  links.forEach(link => {
    const here = lambdasByLink.get(link) || [];
    if (here.length === 0) {
      // Enlace sin lambdas: línea tenue de referencia
      const line = lambdaLinesG.append("line")
        .attr("stroke", "rgba(45,139,255,0.12)")
        .attr("stroke-width", 1);
      allSubLines.push({ line, link, i: 0, total: 1 });
    } else {
      here.forEach((lam, i) => {
        const line = lambdaLinesG.append("line")
          .attr("stroke", lam.color)
          .attr("stroke-width", 1.8)
          .attr("stroke-opacity", 0.85)
          .attr("cursor", "pointer")
          .attr("data-lambda-id", lam.id)
          .on("mouseover", event => {
            tooltip.innerHTML = `
              <div class="tooltip-title">
                <span class="tooltip-lambda-dot" style="background:${lam.color};margin-right:6px;display:inline-block"></span>${lam.name}
              </div>
              <div class="tooltip-row"><span class="tooltip-label">Capacidad</span><span>${lam.capacity_per_lambda || 100} Gbps</span></div>
              ${lam.protection_route_name ? `<div class="tooltip-row"><span class="tooltip-label">Protección 1+1</span><span>${lam.protection_route_name}</span></div>` : ''}
            `;
            positionTooltip(event);
          })
          .on("mouseout", () => hideTooltip());
        allSubLines.push({ line, link, i, total: here.length });
      });
    }
  });

  // ── Nodos ─────────────────────────────────────────────────────────────────
  const node = g.append("g").attr("class", "nodes")
    .selectAll("g").data(nodes, d => d.id).join("g")
    .attr("class", "node-group")
    .attr("cursor", "pointer")
    .call(d3.drag()
      .on("start", (event, _d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        // Anclar todos los nodos en su posición actual para que la simulación no los mueva
        nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
      })
      .on("drag",  (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end",   (event, _d) => {
        if (!event.active) sim.alphaTarget(0);
        // El nodo queda fijo donde el usuario lo dejó; los demás ya estaban anclados
      })
    )
    .on("mouseover", (event, d) => showNodeTooltip(event, d))
    .on("mouseout",  () => hideTooltip());

  node.each(function(d) {
    const sel = d3.select(this);
    if (d.type === "own") {
      sel.append("circle").attr("r", 14)
        .attr("fill", "var(--bg-card)").attr("stroke", "var(--accent-blue)").attr("stroke-width", 2);
    } else {
      sel.append("rect").attr("x", -12).attr("y", -12).attr("width", 24).attr("height", 24)
        .attr("rx", 4).attr("fill", "var(--bg-card)")
        .attr("stroke", "var(--accent-purple)").attr("stroke-width", 2).attr("stroke-dasharray", "4,2");
    }
    sel.append("text").attr("class", "node-label")
      .attr("dy", "28").attr("text-anchor", "middle")
      .attr("font-size", "9").attr("fill", "var(--text-secondary)")
      .text(d.name);
  });

  // ── Simulación de fuerza ──────────────────────────────────────────────────
  const sim = d3.forceSimulation(nodes)
    .force("link",      d3.forceLink(links).id(d => d.id).distance(120))
    .force("charge",    d3.forceManyBody().strength(-450))
    .force("center",    d3.forceCenter(W / 2, H / 2))
    .force("collision", d3.forceCollide(30))
    .on("tick", () => {
      // Hit areas: centradas en el enlace
      linkHit
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

      // Líneas lambda con offset perpendicular
      allSubLines.forEach(({ line, link, i, total }) => {
        const sx = link.source.x, sy = link.source.y;
        const tx = link.target.x, ty = link.target.y;
        const dx = tx - sx, dy = ty - sy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const offset = (i - (total - 1) / 2) * LINE_SPACING;
        const px = -dy / len, py = dx / len; // vector perpendicular unitario
        line
          .attr("x1", sx + px * offset).attr("y1", sy + py * offset)
          .attr("x2", tx + px * offset).attr("y2", ty + py * offset);
      });

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

  document.getElementById("btn-center").onclick = () => {
    d3svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity);
    sim.alpha(0.5).restart();
  };
}

async function loadMexicoGeo() {
  if (mexicoGeoData !== false) return mexicoGeoData;
  try {
    const data = await d3.json('./mexico.geojson');
    mexicoGeoData = (data && data.features && data.features[0]) || null;
  } catch (e) {
    console.warn("No se pudo cargar mexico.geojson:", e);
    mexicoGeoData = null;
  }
  return mexicoGeoData;
}

async function loadEstadosGeo() {
  if (estadosGeoData !== false) return estadosGeoData;
  try {
    const data = await d3.json('./mexico-estados.geojson');
    estadosGeoData = (data && data.features) || null;
  } catch (e) {
    console.warn("No se pudo cargar mexico-estados.geojson:", e);
    estadosGeoData = null;
  }
  return estadosGeoData;
}

async function renderMap(g, nodes, links, W, H) {
  // Sitios con y sin coordenadas
  const locatedNodes = nodes.filter(n => n.lat != null && n.lon != null);
  const unlocatedNodes = nodes.filter(n => n.lat == null || n.lon == null);

  const unlocatedPanel = document.getElementById("unlocated-panel");
  if (unlocatedNodes.length > 0) {
    unlocatedPanel.style.display = "block";
    unlocatedPanel.innerHTML = `
      <div class="unlocated-title">📍 Sin ubicar (${unlocatedNodes.length})</div>
      ${unlocatedNodes.map(n => `
        <div class="unlocated-node">
          <span style="color:${n.type==='own'?'var(--accent-green)':'var(--accent-purple)'}">●</span>
          ${n.name}
        </div>
      `).join("")}
    `;
  } else {
    unlocatedPanel.style.display = "none";
  }

  const pad = 48;
  let toPixel;
  let projection = null; // expuesta al scope para invertir pixel→lat/lon en drag-end

  // ── Contorno real de México ──────────────────────────────────────────────
  const mexicoFeature = await loadMexicoGeo();

  if (mexicoFeature) {
    // Proyección geoMercator ajustada al SVG
    projection = d3.geoMercator()
      .fitExtent([[pad, pad], [W - pad, H - pad]], mexicoFeature);
    const path = d3.geoPath(projection);

    // ── Demarcación de estados (capa inferior) ─────────────────────────────
    const estadosFeatures = await loadEstadosGeo();
    const estadosG = g.append("g")
      .attr("id", "estados-layer")
      .style("display", showEstados ? "" : "none");

    if (estadosFeatures) {
      // Polígonos de estados
      estadosG.selectAll("path.estado")
        .data(estadosFeatures)
        .join("path")
        .attr("class", "estado")
        .attr("d", path)
        .attr("fill", "rgba(45,100,200,0.06)")
        .attr("stroke", "rgba(100,160,255,0.35)")
        .attr("stroke-width", 0.8)
        .attr("stroke-linejoin", "round");

      // Centroide con nombre del estado
      estadosG.selectAll("text.estado-label")
        .data(estadosFeatures)
        .join("text")
        .attr("class", "estado-label")
        .attr("transform", d => {
          const c = d3.geoPath(projection).centroid(d);
          return isFinite(c[0]) && isFinite(c[1]) ? `translate(${c})` : "translate(-999,-999)";
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "7")
        .attr("font-family", "var(--font-mono, monospace)")
        .attr("fill", "rgba(160,195,255,0.65)")
        .attr("pointer-events", "none")
        .text(d => d.properties.name || "");
    }

    // Relleno suave + borde del país (encima de estados)
    g.append("path")
      .datum(mexicoFeature)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "rgba(74, 158, 255, 0.75)")
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round");

    toPixel = (lat, lon) => projection([lon, lat]);
  } else {
    // Fallback: escala lineal + contorno simplificado
    const xScale = d3.scaleLinear().domain([-118.4, -86.7]).range([pad, W - pad]);
    const yScale = d3.scaleLinear().domain([32.7, 14.5]).range([pad, H - pad]);
    const mexicoOutline = [
      [-117.1,32.5],[-114.8,32.5],[-111.0,31.3],[-108.2,31.0],[-106.4,31.8],
      [-104.0,29.5],[-100.9,29.4],[-99.5,26.4],[-97.1,25.9],[-97.2,22.2],
      [-96.7,19.7],[-94.5,18.2],[-92.0,18.5],[-90.8,18.4],[-89.6,18.5],
      [-87.5,16.0],[-87.0,14.5],[-88.0,15.0],[-90.0,16.0],[-91.0,17.0],
      [-92.0,17.8],[-94.0,18.5],[-96.0,19.5],[-97.0,21.0],[-97.0,22.5],
      [-99.0,23.0],[-100.0,24.0],[-101.0,24.5],[-102.0,24.0],[-103.0,23.5],
      [-104.5,23.5],[-105.5,23.0],[-106.0,24.5],[-109.0,23.5],[-110.0,24.0],
      [-110.5,26.0],[-112.0,27.5],[-114.0,29.2],[-116.0,30.0],[-117.0,30.7],
      [-117.1,32.5],
    ];
    const lineGen = d3.line().x(d => xScale(d[0])).y(d => yScale(d[1])).curve(d3.curveCatmullRom);
    g.append("path")
      .datum(mexicoOutline)
      .attr("d", lineGen)
      .attr("fill", "rgba(45,139,255,0.04)")
      .attr("stroke", "rgba(45,139,255,0.20)")
      .attr("stroke-width", 1.5);
    toPixel = (lat, lon) => [xScale(lon), yScale(lat)];
  }

  // Construir mapa de posiciones de nodos por ID
  // posMap guarda [x, y] en píxeles y se actualiza durante el drag
  const posMap = new Map();
  locatedNodes.forEach(n => { posMap.set(n.id, toPixel(n.lat, n.lon)); });

  // Coordenadas modificadas pendientes de guardar { siteId → {lat, lon} }
  const pendingCoords = new Map();

  // ── Links: líneas paralelas por lambda ────────────────────────────────────
  const LINE_SPACING = 4;
  const visibleLinks = links.filter(l => posMap.has(l.source) && posMap.has(l.target));

  // Hit areas transparentes para tooltip del enlace completo
  const linkHitsG = g.append("g").attr("class", "link-hits");
  linkHitsG.selectAll("line").data(visibleLinks).join("line")
    .attr("stroke", "transparent")
    .attr("stroke-width", 18)
    .attr("cursor", "pointer")
    .attr("x1", d => posMap.get(d.source)[0]).attr("y1", d => posMap.get(d.source)[1])
    .attr("x2", d => posMap.get(d.target)[0]).attr("y2", d => posMap.get(d.target)[1])
    .on("mouseover", (event, d) => showEdgeTooltip(event, d))
    .on("mouseout",  () => hideTooltip())
    .on("click",     (event, d) => showEdgeTooltip(event, d, true));

  // Líneas paralelas: una por lambda, con offset perpendicular
  const lambdaLinesG = g.append("g").attr("class", "lambda-lines");

  visibleLinks.forEach(link => {
    const [sx, sy] = posMap.get(link.source);
    const [tx, ty] = posMap.get(link.target);
    const dx = tx - sx, dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len; // vector perpendicular unitario

    const here = lambdas.filter(lam =>
      lam.segments && link.segments.some(seg =>
        lam.segments.some(ls => ls.segment_id === seg.id)
      )
    );

    if (here.length === 0) {
      lambdaLinesG.append("line")
        .attr("stroke", "rgba(45,139,255,0.12)").attr("stroke-width", 1)
        .attr("x1", sx).attr("y1", sy).attr("x2", tx).attr("y2", ty);
    } else {
      here.forEach((lam, i) => {
        const offset = (i - (here.length - 1) / 2) * LINE_SPACING;
        lambdaLinesG.append("line")
          .attr("stroke", lam.color)
          .attr("stroke-width", 1.8)
          .attr("stroke-opacity", 0.85)
          .attr("cursor", "pointer")
          .attr("data-lambda-id", lam.id)
          .attr("x1", sx + px * offset).attr("y1", sy + py * offset)
          .attr("x2", tx + px * offset).attr("y2", ty + py * offset)
          .on("mouseover", event => {
            tooltip.innerHTML = `
              <div class="tooltip-title">
                <span class="tooltip-lambda-dot" style="background:${lam.color};margin-right:6px;display:inline-block"></span>${lam.name}
              </div>
              <div class="tooltip-row"><span class="tooltip-label">Capacidad</span><span>${lam.capacity_per_lambda || 100} Gbps</span></div>
              ${lam.protection_route_name ? `<div class="tooltip-row"><span class="tooltip-label">Protección 1+1</span><span>${lam.protection_route_name}</span></div>` : ''}
            `;
            positionTooltip(event);
          })
          .on("mouseout", () => hideTooltip());
      });
    }
  });

  // ── Función para redibujar todas las líneas de un nodo movido ────────────
  function redrawLinksForNode(nodeId) {
    visibleLinks.forEach(link => {
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (src !== nodeId && tgt !== nodeId) return;

      const [sx, sy] = posMap.get(src) || [0, 0];
      const [tx, ty] = posMap.get(tgt) || [0, 0];
      const dx = tx - sx, dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const px = -dy / len, py = dx / len;

      const here = lambdas.filter(lam =>
        lam.segments && link.segments.some(seg =>
          lam.segments.some(ls => ls.segment_id === seg.id)
        )
      );

      // Actualizar hit areas
      linkHitsG.selectAll("line").filter(d => {
        const ds = typeof d.source === "object" ? d.source.id : d.source;
        const dt = typeof d.target === "object" ? d.target.id : d.target;
        return (ds === src && dt === tgt) || (ds === tgt && dt === src);
      })
        .attr("x1", sx).attr("y1", sy).attr("x2", tx).attr("y2", ty);

      // Actualizar líneas lambda
      const li = visibleLinks.indexOf(link);
      lambdaLinesG.selectAll("line").filter(function() {
        return +this.getAttribute("data-link-idx") === li;
      })
        .each(function() {
          const i = +this.getAttribute("data-sub-idx");
          const total = here.length || 1;
          const offset = (i - (total - 1) / 2) * LINE_SPACING;
          d3.select(this)
            .attr("x1", sx + px * offset).attr("y1", sy + py * offset)
            .attr("x2", tx + px * offset).attr("y2", ty + py * offset);
        });
    });
  }

  // Necesitamos data-link-idx y data-sub-idx en cada línea lambda para poder
  // identificarlas durante el drag — reconstruimos las líneas con esos atributos
  lambdaLinesG.selectAll("*").remove();
  visibleLinks.forEach((link, li) => {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;
    const [sx, sy] = posMap.get(src);
    const [tx, ty] = posMap.get(tgt);
    const dx = tx - sx, dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;

    const here = lambdas.filter(lam =>
      lam.segments && link.segments.some(seg =>
        lam.segments.some(ls => ls.segment_id === seg.id)
      )
    );

    if (here.length === 0) {
      lambdaLinesG.append("line")
        .attr("stroke", "rgba(45,139,255,0.12)").attr("stroke-width", 1)
        .attr("data-link-idx", li).attr("data-sub-idx", 0).attr("data-src", src)
        .attr("x1", sx).attr("y1", sy).attr("x2", tx).attr("y2", ty);
    } else {
      here.forEach((lam, i) => {
        const offset = (i - (here.length - 1) / 2) * LINE_SPACING;
        lambdaLinesG.append("line")
          .attr("stroke", lam.color).attr("stroke-width", 1.8)
          .attr("stroke-opacity", 0.85).attr("cursor", "pointer")
          .attr("data-lambda-id", lam.id)
          .attr("data-link-idx", li).attr("data-sub-idx", i).attr("data-src", src)
          .attr("x1", sx + px * offset).attr("y1", sy + py * offset)
          .attr("x2", tx + px * offset).attr("y2", ty + py * offset)
          .on("mouseover", event => {
            tooltip.innerHTML = `
              <div class="tooltip-title">
                <span class="tooltip-lambda-dot" style="background:${lam.color};margin-right:6px;display:inline-block"></span>${lam.name}
              </div>
              <div class="tooltip-row"><span class="tooltip-label">Capacidad</span><span>${lam.capacity_per_lambda || 100} Gbps</span></div>
              ${lam.protection_route_name ? `<div class="tooltip-row"><span class="tooltip-label">Protección 1+1</span><span>${lam.protection_route_name}</span></div>` : ''}
            `;
            positionTooltip(event);
          })
          .on("mouseout", () => hideTooltip());
      });
    }
  });

  // ── Nodos con drag ────────────────────────────────────────────────────────

  const nodeG = g.append("g").selectAll("g")
    .data(locatedNodes)
    .join("g")
    .attr("class", "node-group")   // misma clase que el grafo → _renderISPOverlay funciona en ambos modos
    .attr("cursor", "grab")
    .attr("transform", d => { const [x, y] = posMap.get(d.id); return `translate(${x},${y})`; })
    .on("mouseover", (event, d) => { if (!event.buttons) showNodeTooltip(event, d); })
    .on("mouseout", () => hideTooltip())
    .call(d3.drag()
      .on("start", (_event, _d) => { hideTooltip(); })
      .on("drag", function(event, d) {
        // event.x/y ya están en el espacio del grupo <g> (zoom aplicado por D3)
        posMap.set(d.id, [event.x, event.y]);
        d3.select(this).attr("transform", `translate(${event.x},${event.y})`);
        redrawLinksForNode(d.id);
      })
      .on("end", function(event, d) {
        // Invertir proyección: coordenadas del grupo → lat/lon
        if (projection) {
          const [lon, lat] = projection.invert([event.x, event.y]);
          if (isFinite(lat) && isFinite(lon)) {
            pendingCoords.set(d.id, { lat: +lat.toFixed(6), lon: +lon.toFixed(6) });
            // Actualizar el objeto nodo en memoria para que exportaciones/tooltips sean correctos
            d.lat = +lat.toFixed(6);
            d.lon = +lon.toFixed(6);
            // Actualizar también en el array global de sites
            const site = sites.find(s => s.id === d.id);
            if (site) { site.lat = d.lat; site.lon = d.lon; }
          }
        }
        syncSaveBtn();
      })
    );

  nodeG.each(function(d) {
    const sel = d3.select(this);
    sel.append("circle").attr("r", 10)
      .attr("fill", "var(--bg-card)")
      .attr("stroke", d.type === "own" ? "var(--accent-blue)" : "var(--accent-purple)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", d.type === "own" ? null : "3,2");
    sel.append("text").attr("class", "node-label")
      .attr("dy", "22").attr("text-anchor", "middle")
      .attr("font-size", "8").attr("fill", "var(--text-secondary)")
      .text(d => showLabel === "name" ? d.name : d.id);
  });

  // ── Botón guardar posiciones ───────────────────────────────────────────────
  const btnSave = document.getElementById("btn-save-coords");
  function syncSaveBtn() {
    if (btnSave) {
      btnSave.style.display = topoMode === "map" ? "" : "none";
      btnSave.disabled = pendingCoords.size === 0;
      btnSave.textContent = pendingCoords.size > 0
        ? `💾 Guardar posiciones (${pendingCoords.size})`
        : "💾 Guardar posiciones";
    }
  }
  syncSaveBtn();

  if (btnSave) {
    // Reasignar handler (el mapa se puede redibujar)
    btnSave.onclick = async () => {
      if (pendingCoords.size === 0) return;
      btnSave.disabled = true;
      btnSave.textContent = "Guardando…";
      const errors = [];
      for (const [siteId, coords] of pendingCoords) {
        try {
          await API.updateSite(siteId, coords);
        } catch {
          errors.push(siteId);
        }
      }
      if (errors.length === 0) {
        pendingCoords.clear();
        syncSaveBtn();
        // Toast de confirmación
        const toast = document.createElement("div");
        toast.className = "toast toast-success";
        toast.textContent = "✓ Posiciones guardadas correctamente";
        document.getElementById("toast-container").appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } else {
        btnSave.disabled = false;
        btnSave.textContent = `⚠ Error en ${errors.length} sitio(s)`;
      }
    };
  }

  document.getElementById("topo-status").innerHTML =
    `${locatedNodes.length}/${nodes.length} sitios ubicados &nbsp;·&nbsp; ` +
    `<span title="Las coordenadas son aproximadas y pueden estar ajustadas para evitar solapamiento visual entre sitios cercanos." ` +
    `style="cursor:help;border-bottom:1px dashed currentColor;">` +
    `⚠ Coordenadas aproximadas</span>`;
}

// ── Colors ────────────────────────────────────────────────────────────────────

function getLinkColor(d) {
  if (selectedLambdas.size > 0) {
    const matching = lambdas.filter(l =>
      selectedLambdas.has(l.id) &&
      d.segments.some(seg => l.segments && l.segments.some(ls => ls.segment_id === seg.id))
    );
    if (matching.length === 0) return "rgba(45,139,255,0.08)";
    if (matching.length === 1) return matching[0].color;
    // Múltiples lambdas seleccionadas en el mismo enlace → blanco brillante
    return "#ffffff";
  }
  // Sin selección: color por proveedor principal
  const providers = d.segments.map(s => s.fiber_provider).filter(Boolean);
  const mainProv = providers[0] || "";
  const provColors = {
    "AT&T": "#00d4ff", "Bestel": "#00e5a0", "Marcatel": "#a855f7",
    "Maxcom": "#ff8c42", "Cirion": "#ff69b4", "QUATTROCOM": "#8B4513",
    "Transtelco": "#FFD700",
  };
  return provColors[mainProv] || "#2d8bff";
}

function updateHighlights() {
  if (!g) return;

  // Grafo lógico: líneas paralelas por lambda
  g.selectAll(".lambda-lines line")
    .attr("stroke-opacity", function() {
      if (selectedLambdas.size === 0) return 0.85;
      const lamId = +this.getAttribute("data-lambda-id");
      if (!lamId) return 0.04;
      return selectedLambdas.has(lamId) ? 1 : 0.05;
    })
    .attr("stroke-width", function() {
      if (selectedLambdas.size === 0) return 1.8;
      const lamId = +this.getAttribute("data-lambda-id");
      return selectedLambdas.has(lamId) ? 3.5 : 0.8;
    });

  // Mapa geográfico: líneas .link con color por lambda seleccionada
  g.selectAll(".link")
    .attr("stroke", d => getLinkColor(d))
    .attr("stroke-opacity", d => {
      if (selectedLambdas.size === 0) return 0.7;
      const onLink = lambdas.some(l =>
        selectedLambdas.has(l.id) &&
        d.segments.some(seg => l.segments && l.segments.some(ls => ls.segment_id === seg.id))
      );
      return onLink ? 1 : 0.08;
    })
    .attr("stroke-width", d => {
      if (selectedLambdas.size === 0) return Math.max(2, d.segments.length * 2);
      const onLink = lambdas.some(l =>
        selectedLambdas.has(l.id) &&
        d.segments.some(seg => l.segments && l.segments.some(ls => ls.segment_id === seg.id))
      );
      return onLink ? 5 : 1;
    });
}

function updateLambdaSidebarTitle() {
  const title = document.getElementById("lambda-sidebar-title");
  if (!title) return;
  if (selectedLambdas.size > 0) {
    title.textContent = `🔆 Lambdas — ${selectedLambdas.size} seleccionada${selectedLambdas.size > 1 ? 's' : ''}`;
  } else {
    title.textContent = `🔆 Lambdas (${lambdas.length})`;
  }
}

// ── Tooltips ─────────────────────────────────────────────────────────────────

function showNodeTooltip(event, d) {
  const lambdaNames = lambdas.filter(l =>
    l.segments && l.segments.some(s => {
      const seg = segments.find(sg => sg.id === s.segment_id);
      return seg && (seg.site_a_id === d.id || seg.site_b_id === d.id);
    })
  );
  tooltip.innerHTML = `
    <div class="tooltip-title">${d.name}</div>
    <div class="tooltip-row"><span class="tooltip-label">Site ID</span><span style="font-family:var(--font-mono)">${d.id}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">Tipo</span><span>${d.type === 'own' ? '🏢 Propio' : '🔗 Tercero'}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">Región</span><span>${d.region || '-'}</span></div>
    <div class="tooltip-row"><span class="tooltip-label">Ciudad</span><span>${d.city || '-'}</span></div>
    ${d.lat != null ? `<div class="tooltip-row"><span class="tooltip-label">Coords</span><span>${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}</span></div>` : ''}
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Lambdas:</div>
    <div class="tooltip-lambdas">
      ${lambdaNames.slice(0,8).map(l => `<span title="${l.name}" class="tooltip-lambda-dot" style="background:${l.color}"></span>`).join('')}
      ${lambdaNames.length > 8 ? `<span style="font-size:10px;color:var(--text-muted)">+${lambdaNames.length-8}</span>` : ''}
    </div>
  `;
  positionTooltip(event);
}

function showEdgeTooltip(event, d) {
  const lambdaNames = lambdas.filter(l =>
    l.segments && d.segments.some(seg => l.segments.some(ls => ls.segment_id === seg.id))
  );
  const totalUsage = d.segments.reduce((acc, s) => acc + (s.usage_count || 0), 0);
  tooltip.innerHTML = `
    <div class="tooltip-title">🔗 ${d.source.id || d.source} ↔ ${d.target.id || d.target}</div>
    ${d.segments.map(seg => `
      <div style="border-bottom:1px solid var(--border);padding:4px 0;margin:4px 0;font-size:11px;">
        <span style="color:var(--text-muted)">${seg.fiber}</span> · 
        <span style="color:var(--accent-blue)">${seg.fiber_provider || 'N/A'}</span>
        <span style="float:right;color:${seg.usage_count>=77?'var(--accent-red)':'var(--accent-green)'}">${seg.usage_count}/96</span>
      </div>
    `).join('')}
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Lambdas en este enlace:</div>
    <div class="tooltip-lambdas">
      ${lambdaNames.map(l => `<span title="${l.name}" class="tooltip-lambda-dot" style="background:${l.color}"></span>`).join('')}
    </div>
    <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">Capacidad total: <b style="color:var(--text-primary)">${totalUsage * 100} Gbps</b></div>
  `;
  positionTooltip(event);
}

function positionTooltip(event) {
  const tt = tooltip;
  tt.classList.add("visible");
  const rect = tt.parentElement ? tt.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
  let x = event.clientX - rect.left + 14;
  let y = event.clientY - rect.top - 10;
  if (x + 280 > rect.width) x -= 300;
  tt.style.left = x + "px";
  tt.style.top = y + "px";
}

function hideTooltip() {
  tooltip && tooltip.classList.remove("visible");
}

// ── Export ────────────────────────────────────────────────────────────────────

function _download(url, filename) {
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function _downloadText(text, filename, mime = "text/plain") {
  _download(URL.createObjectURL(new Blob([text], { type: mime })), filename);
}

/**
 * Paso 1 – DOM walk: copia fill/stroke computados del SVG vivo al clon.
 * getComputedStyle sobre los elementos vivos ya tiene los var() resueltos
 * por el browser, así que obtenemos el color real (p.ej. "rgb(19,30,53)").
 */
function _applyComputedColors(liveEl, cloneEl) {
  if (!liveEl || liveEl.nodeType !== Node.ELEMENT_NODE) return;
  try {
    const cs = window.getComputedStyle(liveEl);
    if ((liveEl.getAttribute('fill')   || '').includes('var(')) {
      const v = cs.getPropertyValue('fill').trim();
      if (v) cloneEl.setAttribute('fill', v);
    }
    if ((liveEl.getAttribute('stroke') || '').includes('var(')) {
      const v = cs.getPropertyValue('stroke').trim();
      if (v) cloneEl.setAttribute('stroke', v);
    }
  } catch (_) { /* ignorar si el elemento no soporta getComputedStyle */ }
  const lc = liveEl.children, cc = cloneEl.children;
  for (let i = 0; i < lc.length && i < cc.length; i++) _applyComputedColors(lc[i], cc[i]);
}

/**
 * Paso 2 – String replace: sustituye cualquier var(--x) residual en el
 * texto serializado, usando los valores del :root del documento actual.
 * Sirve como seguro adicional para referencias que el paso 1 no alcance.
 */
function _resolveVars(svgData) {
  const isLight = document.body.classList.contains('light');
  // Valores explícitos según tema (más fiable que getPropertyValue en exports)
  const palette = isLight ? {
    '--bg-card':        '#ffffff',
    '--accent-blue':    '#2d8bff',
    '--accent-purple':  '#a855f7',
    '--text-secondary': '#445577',
    '--text-muted':     '#7a94bb',
    '--text-primary':   '#1a2845',
    '--border':         '#c8d8f0',
    '--font-mono':      'monospace',
  } : {
    '--bg-card':        '#131e35',
    '--accent-blue':    '#2d8bff',
    '--accent-purple':  '#a855f7',
    '--text-secondary': '#8899bb',
    '--text-muted':     '#4d6080',
    '--text-primary':   '#e8f0fe',
    '--border':         '#1e3058',
    '--font-mono':      'monospace',
  };
  let out = svgData;
  for (const [v, val] of Object.entries(palette)) {
    out = out.split(`var(${v})`).join(val);
  }
  // var(--font-mono, monospace) con fallback explícito
  out = out.replace(/var\(--font-mono,\s*monospace\)/g, 'monospace');
  // Eliminar cualquier var() sin resolver restante (evita render negro)
  out = out.replace(/var\(--[\w-]+(?:,\s*[^)]+)?\)/g, 'currentColor');
  return out;
}

/** Renderiza el SVG actual en un canvas 2× y devuelve { canvas, W, H, bg }. */
function _svgToCanvas() {
  return new Promise(resolve => {
    const svgEl = document.getElementById("topology-svg");
    const { width: W, height: H } = svgEl.getBoundingClientRect();
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width",  W);
    clone.setAttribute("height", H);

    // Paso 1: colores computados del árbol vivo → clon (resuelve var(--x))
    _applyComputedColors(svgEl, clone);

    const bg = document.body.classList.contains("light") ? "#f8f9fc" : "#1a1d27";
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", W); bgRect.setAttribute("height", H);
    bgRect.setAttribute("fill", bg);
    clone.insertBefore(bgRect, clone.firstChild);

    // Paso 2: eliminar cualquier var() residual en el texto serializado
    const svgData = _resolveVars(new XMLSerializer().serializeToString(clone));
    const blobUrl = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(blobUrl);
      resolve({ canvas, W, H, bg });
    };
    img.src = blobUrl;
  });
}

async function exportAsPNG() {
  const { canvas } = await _svgToCanvas();
  _download(canvas.toDataURL("image/png"), "topologia-dwdm.png");
}

function exportAsSVG() {
  const svgEl = document.getElementById("topology-svg");
  const { width: W, height: H } = svgEl.getBoundingClientRect();
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width",  W);
  clone.setAttribute("height", H);

  // Paso 1: colores computados del árbol vivo → clon
  _applyComputedColors(svgEl, clone);

  const bg = document.body.classList.contains("light") ? "#f8f9fc" : "#1a1d27";
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("width", W); bgRect.setAttribute("height", H);
  bgRect.setAttribute("fill", bg);
  clone.insertBefore(bgRect, clone.firstChild);

  // Paso 2: var() residuales en el texto serializado
  _downloadText(_resolveVars(new XMLSerializer().serializeToString(clone)), "topologia-dwdm.svg", "image/svg+xml");
}

async function exportAsPDF() {
  const { canvas, W, H, bg } = await _svgToCanvas();
  const dataURL = canvas.toDataURL("image/png");
  const html = `<!DOCTYPE html>
<html><head><title>Topología DWDM — Red ISP Tx</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${bg}; }
  img  { width:100%; height:auto; display:block; }
  @page { size:${W > H ? "landscape" : "portrait"}; margin:8mm; }
</style></head>
<body><img src="${dataURL}"/>
<script>window.onload = () => { window.focus(); window.print(); }<\/script>
</body></html>`;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const win = window.open(blobUrl, "_blank");
  if (!win) { alert("Permite ventanas emergentes para exportar PDF."); return; }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function exportAsGraphML() {
  if (!graphNodes.length) return;
  const SCALE = 1.5;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/graphml"',
    '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '         xmlns:y="http://www.yworks.com/xml/graphml"',
    '         xsi:schemaLocation="http://graphml.graphdrawing.org/graphml',
    '           http://www.yworks.com/xml/schema/graphml/1.1/ygraphml.xsd">',
    '  <key id="nG" for="node" yfiles.type="nodegraphics"/>',
    '  <key id="eG" for="edge" yfiles.type="edgegraphics"/>',
    '  <key id="nD" for="node" attr.name="description" attr.type="string"/>',
    '  <graph id="G" edgedefault="undirected">',
  ];

  graphNodes.forEach(n => {
    const x     = ((n.fx ?? n.x ?? 0) * SCALE).toFixed(1);
    const y     = ((n.fy ?? n.y ?? 0) * SCALE).toFixed(1);
    const fill  = n.type === "own" ? "#2D8BFF" : "#9B59B6";
    const shape = n.type === "own" ? "ellipse"  : "rectangle";
    lines.push(
      `    <node id="${n.id}">`,
      `      <data key="nD">${escapeXml(n.region || "")} | ${escapeXml(n.city || "")}</data>`,
      `      <data key="nG"><y:ShapeNode>`,
      `        <y:Geometry x="${x}" y="${y}" width="120" height="50"/>`,
      `        <y:Fill color="${fill}" transparent="false"/>`,
      `        <y:BorderStyle type="line" width="2.0" color="#FFFFFF"/>`,
      `        <y:NodeLabel alignment="center" fontFamily="Arial" fontSize="11" textColor="#FFFFFF">${escapeXml(n.name)}&#10;${escapeXml(n.id)}</y:NodeLabel>`,
      `        <y:Shape type="${shape}"/>`,
      `      </y:ShapeNode></data>`,
      `    </node>`,
    );
  });

  graphLinks.forEach((link, i) => {
    const src  = typeof link.source === "object" ? link.source.id : link.source;
    const tgt  = typeof link.target === "object" ? link.target.id : link.target;
    const prov = [...new Set((link.segments || []).map(s => s.fiber_provider).filter(Boolean))].join(", ");
    lines.push(
      `    <edge id="e${i}" source="${src}" target="${tgt}">`,
      `      <data key="eG"><y:PolyLineEdge>`,
      `        <y:LineStyle type="line" width="2.0" color="#2D8BFF"/>`,
      `        <y:Arrows source="none" target="none"/>`,
      prov ? `        <y:EdgeLabel>${escapeXml(prov)}</y:EdgeLabel>` : "",
      `      </y:PolyLineEdge></data>`,
      `    </edge>`,
    );
  });

  lines.push("  </graph>", "</graphml>");
  _downloadText(lines.join("\n"), "topologia-dwdm.graphml", "application/xml");
}

function exportAsDOT() {
  if (!graphNodes.length) return;
  const lines = [
    "graph DWDM {",
    "  layout=neato;",
    "  overlap=false;",
    "  splines=true;",
    '  node [fontname="Arial" fontsize=10];',
    '  edge [fontname="Arial" fontsize=9];',
    "",
  ];

  graphNodes.forEach(n => {
    const shape = n.type === "own" ? "ellipse" : "box";
    const color = n.type === "own" ? "#2D8BFF"  : "#9B59B6";
    const x = ((n.fx ?? n.x ?? 0) / 72).toFixed(2);
    const y = (-(n.fy ?? n.y ?? 0) / 72).toFixed(2); // invertir Y (Graphviz origin bottom-left)
    lines.push(`  "${n.id}" [label="${n.name}\\n${n.id}" shape=${shape} color="${color}" pos="${x},${y}!"];`);
  });

  lines.push("");
  const seen = new Set();
  graphLinks.forEach(link => {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const tgt = typeof link.target === "object" ? link.target.id : link.target;
    const key = [src, tgt].sort().join("||");
    if (seen.has(key)) return;
    seen.add(key);
    const prov = [...new Set((link.segments || []).map(s => s.fiber_provider).filter(Boolean))].join(", ");
    lines.push(`  "${src}" -- "${tgt}"${prov ? ` [label="${prov}"]` : ""};`);
  });

  lines.push("}");
  _downloadText(lines.join("\n"), "topologia-dwdm.dot");
}
