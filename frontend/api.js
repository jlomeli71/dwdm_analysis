/**
 * API Client — Todas las llamadas al backend Flask.
 * Base URL: http://localhost:5001/api/v1
 */
const BASE = "http://localhost:5001/api/v1";

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const API = {
  // Sites
  getSites:   (params = "") => request("GET", `/sites${params}`),
  getSite:    id            => request("GET", `/sites/${id}`),
  createSite: body          => request("POST", "/sites", body),
  updateSite: (id, body)    => request("PUT", `/sites/${id}`, body),
  deleteSite: id            => request("DELETE", `/sites/${id}`),

  // Lambdas
  getLambdas:   ()         => request("GET", "/lambdas"),
  getLambda:    id         => request("GET", `/lambdas/${id}`),
  createLambda: body       => request("POST", "/lambdas", body),
  updateLambda: (id, body) => request("PUT", `/lambdas/${id}`, body),
  deleteLambda: id         => request("DELETE", `/lambdas/${id}`),

  // Segments
  getSegments:        ()   => request("GET", "/segments"),
  getSegmentLambdas:  id   => request("GET", `/segments/${id}/lambdas`),

  // Dashboard
  getKPIs:          ()     => request("GET", "/dashboard/kpis"),
  getHeatmap:       ()     => request("GET", "/dashboard/heatmap"),
  getSegmentUsage:  ()     => request("GET", "/dashboard/segments"),
  getProviders:     ()     => request("GET", "/dashboard/providers"),

  // Simulation
  simulate:         body   => request("POST", "/simulation", body),
  simulateProvider: prov   => request("POST", "/simulation/provider", { provider: prov }),

  // Reports (returns URL for download)
  reportUrl: name => `${BASE}/reports/${name}`,

  // ISP Layer — Routers
  getRouters:              ()         => request("GET",    "/routers"),
  createRouter:            body       => request("POST",   "/routers", body),
  updateRouter:            (id, body) => request("PUT",    `/routers/${id}`, body),
  deleteRouter:            id         => request("DELETE", `/routers/${id}`),

  // ISP Layer — Interfaces de ruteador
  createRouterInterface:   body       => request("POST",   "/router-interfaces", body),
  updateRouterInterface:   (id, body) => request("PUT",    `/router-interfaces/${id}`, body),
  deleteRouterInterface:   id         => request("DELETE", `/router-interfaces/${id}`),

  // ISP Layer — Proveedores ISP
  getISPProviders:         ()         => request("GET",    "/isp-providers"),
  createISPProvider:       body       => request("POST",   "/isp-providers", body),
  updateISPProvider:       (id, body) => request("PUT",    `/isp-providers/${id}`, body),
  deleteISPProvider:       id         => request("DELETE", `/isp-providers/${id}`),

  // ISP Layer — Flujos de tráfico
  getTrafficFlows:         ()         => request("GET",    "/traffic-flows"),
  updateTrafficFlow:       (id, body) => request("PUT",    `/traffic-flows/${id}`, body),

  // ISP Layer — Simulación
  simulateISPProvider:     body       => request("POST", "/simulation/isp-provider", body),
  simulateLambdaTraffic:   body       => request("POST", "/simulation/lambda-traffic", body),

  // Utilización mensual (Excel import)
  uploadLambdaUtilization: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(BASE + "/upload/lambda-utilization", { method: "POST", body: fd })
      .then(r => r.json().catch(() => ({})))
      .then(data => { if (!data.status) throw data; return data; });
  },
  getLambdaUtilization: (month = "") => request("GET", `/lambda-utilization${month ? "?month=" + month : ""}`),
};
