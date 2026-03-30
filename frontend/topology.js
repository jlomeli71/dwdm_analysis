/**
 * Módulo de Topología — Grafo D3.js + Mapa Geográfico de México
 */
import { API } from './api.js';

let sites = [], lambdas = [], segments = [];
let selectedLambdas = new Set();
let topoMode = "graph"; // "graph" | "map"
let simulation = null;
let svg = null, g = null;
let tooltip = null;
let mexicoGeoData = false; // false = sin cargar, null = falló, objeto = cargado

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGraph(sitesData, segmentsData, lambdasData) {
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

function getLambdaColorsForSegment(segId, lambdasData) {
  const colors = [];
  lambdasData.forEach(l => {
    if (l.segments && l.segments.some(s => s.segment_id === segId)) {
      colors.push({ color: l.color, name: l.name });
    }
  });
  return colors;
}

// ── Render Topology ───────────────────────────────────────────────────────────

export async function renderTopology(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Topología de Red DWDM</div>
        <div class="page-subtitle">Proyecto Philadelphia — Red óptica ISP México</div>
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
      <button class="btn btn-secondary btn-sm" id="btn-reset-sel">✕ Quitar selección</button>
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
  document.getElementById("topo-mode-toggle").addEventListener("click", e => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    document.querySelectorAll("#topo-mode-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    topoMode = btn.dataset.mode;
    drawTopology();
  });

  // Toggle de label
  let showLabel = "name";
  document.getElementById("label-toggle").addEventListener("click", e => {
    const btn = e.target.closest("button[data-label]");
    if (!btn) return;
    document.querySelectorAll("#label-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showLabel = btn.dataset.label;
    g && g.selectAll(".node-label").text(d => showLabel === "name" ? d.name : d.id);
  });

  document.getElementById("btn-reset-sel").addEventListener("click", () => {
    selectedLambdas.clear();
    document.querySelectorAll(".lambda-item").forEach(el => el.classList.remove("selected"));
    updateLambdaSidebarTitle();
    updateHighlights();
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

  document.getElementById("btn-center").onclick = () => {
    d3svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity);
  };

  g = d3svg.append("g");
  svg = d3svg;

  const { nodes, links } = buildGraph(sites, segments, lambdas);

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
      .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end",   (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = d.fy = null; })
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

  simulation = sim;
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

  // ── Contorno real de México ──────────────────────────────────────────────
  const mexicoFeature = await loadMexicoGeo();

  if (mexicoFeature) {
    // Proyección geoMercator ajustada al SVG
    const projection = d3.geoMercator()
      .fitExtent([[pad, pad], [W - pad, H - pad]], mexicoFeature);
    const path = d3.geoPath(projection);

    // Relleno suave + borde del país
    g.append("path")
      .datum(mexicoFeature)
      .attr("d", path)
      .attr("fill", "var(--map-country-fill)")
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
  const posMap = new Map();
  locatedNodes.forEach(n => { posMap.set(n.id, toPixel(n.lat, n.lon)); });

  // ── Links: líneas paralelas por lambda ────────────────────────────────────
  const LINE_SPACING = 4;
  const visibleLinks = links.filter(l => posMap.has(l.source) && posMap.has(l.target));

  // Hit areas transparentes para tooltip del enlace completo
  g.append("g").attr("class", "link-hits")
    .selectAll("line").data(visibleLinks).join("line")
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

  // Nodos
  const nodeG = g.append("g").selectAll("g")
    .data(locatedNodes)
    .join("g")
    .attr("transform", d => { const [x, y] = posMap.get(d.id); return `translate(${x},${y})`; })
    .on("mouseover", (event, d) => showNodeTooltip(event, d))
    .on("mouseout", () => hideTooltip());

  nodeG.each(function(d) {
    const sel = d3.select(this);
    sel.append("circle").attr("r", 10)
      .attr("fill", "var(--bg-card)")
      .attr("stroke", d.type === "own" ? "var(--accent-blue)" : "var(--accent-purple)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", d.type === "own" ? null : "3,2");
    sel.append("text").attr("dy", "22").attr("text-anchor", "middle")
      .attr("font-size", "8").attr("fill", "var(--text-secondary)").text(d.name);
  });

  document.getElementById("topo-status").textContent =
    `${locatedNodes.length}/${nodes.length} sitios ubicados en el mapa`;
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
