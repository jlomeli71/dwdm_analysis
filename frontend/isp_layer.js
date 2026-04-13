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

export async function renderISPLayer(container) {
  container.innerHTML = `<div class="isp-page">
    <div class="isp-toolbar">
      <div class="isp-toolbar-title">
        <span style="color:var(--accent-cyan);font-size:18px">🌐</span>
        <span>Capa IP / ISP</span>
      </div>
      <div class="isp-toolbar-actions">
        <button class="btn-tool active" id="isp-btn-graph">Grafo lógico</button>
        <button class="btn-tool" id="isp-btn-reload" title="Recargar datos">↺ Actualizar</button>
      </div>
    </div>

    <div class="isp-layout">
      <!-- Visualización D3 -->
      <div class="isp-graph-wrap" id="isp-graph-wrap">
        <svg id="isp-svg" style="width:100%;height:100%"></svg>
      </div>

      <!-- Panel derecho: matriz + métricas ISIS -->
      <div class="isp-matrix-panel" id="isp-matrix-panel">
        <div class="isp-matrix-header">
          <span>Matriz de Tráfico</span>
          <span class="isp-matrix-sub">N° interfaces × 100 Gbps — editable</span>
        </div>
        <div id="isp-matrix-content"><div class="isp-loading">Cargando…</div></div>

        <!-- Métricas ISIS -->
        <div class="isp-metrics-header">
          <span>📡 Métricas ISIS</span>
          <span class="isp-matrix-sub">Cisco &amp; Juniper · default 10 · rango 1–16 777 214</span>
        </div>
        <div id="isp-metrics-content"><div class="isp-loading">Cargando…</div></div>
      </div>
    </div>
  </div>`;

  await loadData();
  renderGraph();
  renderMatrix();
  renderISPMetrics();

  document.getElementById("isp-btn-reload")?.addEventListener("click", async () => {
    await loadData();
    renderGraph();
    renderMatrix();
    renderISPMetrics();
  });
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
  const nodeById = {};
  allNodes.forEach(n => { nodeById[n.id] = n; });

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

  const drag = d3.drag()
    .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on("end",   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });

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

  // Ruteadores: círculo relleno + cruz blanca
  nodeSel.filter(d => d.kind === "router").each(function(d) {
    const sel = d3.select(this);
    const color = BRAND_COLOR[d.brand] || "#888";
    sel.append("circle").attr("r", NODE_R).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.5);
    // Cruz blanca
    const arm = NODE_R * 0.55;
    sel.append("line").attr("x1", -arm).attr("y1", 0).attr("x2", arm).attr("y2", 0)
      .attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
    sel.append("line").attr("x1", 0).attr("y1", -arm).attr("x2", 0).attr("y2", arm)
      .attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
    // Etiqueta
    sel.append("text").attr("dy", NODE_R + 13).attr("text-anchor", "middle")
      .attr("font-size", "10").attr("fill", "var(--text-secondary)").text(d.label);
  });

  // Nubes ISP: forma de nube SVG + etiqueta
  nodeSel.filter(d => d.kind === "isp").each(function(d) {
    const sel = d3.select(this);
    sel.append("path")
      .attr("d", cloudPath(CLOUD_W, CLOUD_H))
      .attr("transform", `translate(${-CLOUD_W / 2},${-CLOUD_H / 2})`)
      .attr("fill", d.color)
      .attr("fill-opacity", 0.25)
      .attr("stroke", d.color)
      .attr("stroke-width", 2);
    sel.append("text").attr("dy", 5).attr("text-anchor", "middle")
      .attr("font-size", "9.5").attr("font-weight", "700").attr("fill", d.color)
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

  // Construir tabla
  let html = `<div class="isp-matrix-scroll"><table class="isp-matrix-table">
  <thead>
    <tr>
      <th class="isp-matrix-th">Proveedor / Sitio</th>
      ${egressSites.map(s => `<th class="isp-matrix-th isp-matrix-th--egress">${egressNames[s] || s}</th>`).join("")}
      <th class="isp-matrix-th">Total</th>
      <th class="isp-matrix-th">Cap. ISP</th>
    </tr>
  </thead>
  <tbody>`;

  rows.forEach(row => {
    const capKey    = `${providers.find(p => p.name === row.providerName)?.id ?? ""}_${row.ingressSiteId}`;
    const capIfaces = ispCapacity[capKey] || 0;
    const rowTotal  = egressSites.reduce((s, e) => s + (row.egressMap[e]?.interfaces_count || 0), 0);
    const pct       = capIfaces > 0 ? Math.round((rowTotal / capIfaces) * 100) : 0;
    const pctColor  = pct >= 80 ? "var(--accent-red)" : pct >= 60 ? "var(--accent-orange)" : "var(--accent-green)";

    html += `<tr>
      <td class="isp-matrix-td isp-matrix-td--label">
        <span class="isp-provider-dot" style="background:${row.providerColor}"></span>
        <span class="isp-matrix-provider">${row.providerName}</span>
        <span class="isp-matrix-site">${row.ingressSiteName}</span>
      </td>
      ${egressSites.map(e => {
        const f = row.egressMap[e];
        const v = f ? f.interfaces_count : null;
        return `<td class="isp-matrix-td isp-matrix-td--cell">
          ${f
            ? `<input class="isp-matrix-input" type="number" min="0" max="96"
                 value="${v}" data-flow-id="${f.id}"
                 title="${f.lambda_names ? "Lambdas: " + f.lambda_names : ""}">`
            : `<span class="isp-matrix-na">—</span>`}
        </td>`;
      }).join("")}
      <td class="isp-matrix-td isp-matrix-td--total">${rowTotal}</td>
      <td class="isp-matrix-td isp-matrix-td--cap">
        <span style="color:${pctColor}">${rowTotal}/${capIfaces}</span>
        <span class="isp-matrix-pct" style="color:${pctColor}">${pct}%</span>
      </td>
    </tr>`;
  });

  // Fila de totales por egress
  const colTotals = {};
  egressSites.forEach(e => {
    colTotals[e] = flows.filter(f => f.egress_site_id === e).reduce((s, f) => s + f.interfaces_count, 0);
  });
  const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);
  html += `<tr class="isp-matrix-totals">
    <td class="isp-matrix-td isp-matrix-td--label"><b>Total ↓</b></td>
    ${egressSites.map(e => `<td class="isp-matrix-td isp-matrix-td--total"><b>${colTotals[e]}</b></td>`).join("")}
    <td class="isp-matrix-td isp-matrix-td--total"><b>${grandTotal}</b></td>
    <td class="isp-matrix-td isp-matrix-td--cap"></td>
  </tr>`;

  html += "</tbody></table></div>";
  html += `<div class="isp-matrix-note">Valores en N° de interfaces de 100 Gbps. Hover sobre celda → lambdas de transporte.</div>`;
  content.innerHTML = html;

  // Eventos de edición inline
  content.querySelectorAll(".isp-matrix-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const flowId = +e.target.dataset.flowId;
      const val    = Math.max(0, +e.target.value);
      e.target.value = val;
      try {
        await API.updateTrafficFlow(flowId, { interfaces_count: val });
        // Refrescar flows en memoria
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

/** Genera el path SVG de una nube simple */
function cloudPath(w, h) {
  const r = h * 0.28;
  const x = w * 0.1, y = h * 0.55;
  return `M${x + r},${y}
    a${r},${r} 0 0,1 ${r * 0.6},${-r * 1.1}
    a${r * 1.1},${r * 1.1} 0 0,1 ${r * 2},${-r * 0.3}
    a${r * 0.9},${r * 0.9} 0 0,1 ${r * 1.6},${r * 1.4}
    a${r * 0.75},${r * 0.75} 0 0,1 ${-r * 0.3},${r}
    H${x + r}Z`;
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
