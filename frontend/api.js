/**
 * API Client — Todas las llamadas al backend Flask.
 * Base URL: http://localhost:5000/api/v1
 */
const BASE = "http://localhost:5000/api/v1";

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
};
