"""Endpoints para la capa IP/ISP: ruteadores, proveedores, flujos de tráfico y simulación ISP."""
from collections import Counter
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Router, ISPProvider, RouterInterface, TrafficFlow, ISPPriority, Lambda, Site

bp = Blueprint("isp", __name__)


# ── Helper: endpoint remoto de una lambda desde un sitio dado ─────────────────

def _lambda_remote_site(lambda_, local_site_id):
    """Devuelve el sitio del otro extremo de la lambda, o None si no se puede determinar."""
    counter = Counter()
    for ls in lambda_.lambda_segments:
        seg = ls.segment
        counter[seg.site_a_id] += 1
        counter[seg.site_b_id] += 1
    # Los sitios terminales aparecen una sola vez en la cadena de segmentos
    endpoints = [s for s, cnt in counter.items() if cnt == 1]
    if not endpoints and lambda_.lambda_segments:
        # Lambda de un solo segmento: ambos sitios son terminales
        seg = lambda_.lambda_segments[0].segment
        endpoints = [seg.site_a_id, seg.site_b_id]
    return next((s for s in endpoints if s != local_site_id), None)


# ── Ruteadores ────────────────────────────────────────────────────────────────

@bp.get("/routers")
def get_routers():
    routers = Router.query.all()
    return jsonify([r.to_dict(include_interfaces=True) for r in routers])


@bp.post("/routers")
def create_router():
    data = request.get_json(silent=True) or {}
    site_id = (data.get("site_id") or "").strip()
    name    = (data.get("name") or "").strip()
    brand   = (data.get("brand") or "").strip().lower()

    if not site_id or not name or not brand:
        return jsonify({"error": "site_id, name y brand son obligatorios"}), 422
    if brand not in ("cisco", "juniper", "cirion", "axtel"):
        return jsonify({"error": "brand debe ser 'cisco', 'juniper', 'cirion' o 'axtel'"}), 422
    if not Site.query.get(site_id):
        return jsonify({"error": f"El sitio '{site_id}' no existe"}), 404
    if Router.query.filter_by(site_id=site_id).first():
        return jsonify({"error": f"Ya existe un ruteador en el sitio '{site_id}'"}), 409

    router = Router(site_id=site_id, name=name, brand=brand)
    db.session.add(router)
    db.session.commit()
    return jsonify(router.to_dict(include_interfaces=True)), 201


@bp.put("/routers/<int:router_id>")
def update_router(router_id):
    router = Router.query.get_or_404(router_id)
    data   = request.get_json(silent=True) or {}
    name   = (data.get("name") or "").strip()
    brand  = (data.get("brand") or "").strip().lower()

    if name:
        router.name = name
    if brand:
        if brand not in ("cisco", "juniper", "cirion", "axtel"):
            return jsonify({"error": "brand debe ser 'cisco', 'juniper', 'cirion' o 'axtel'"}), 422
        router.brand = brand

    db.session.commit()
    return jsonify(router.to_dict(include_interfaces=True))


@bp.delete("/routers/<int:router_id>")
def delete_router(router_id):
    router = Router.query.get_or_404(router_id)
    # Las interfaces se eliminan en cascada (cascade="all, delete-orphan")
    db.session.delete(router)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/router-interfaces")
def create_router_interface():
    data       = request.get_json(silent=True) or {}
    router_id  = data.get("router_id")
    name       = (data.get("name") or "").strip()
    iface_type = (data.get("iface_type") or "").strip().lower()

    if not router_id or not name or not iface_type:
        return jsonify({"error": "router_id, name e iface_type son obligatorios"}), 422
    if iface_type not in ("lambda", "isp"):
        return jsonify({"error": "iface_type debe ser 'lambda' o 'isp'"}), 422
    if not Router.query.get(router_id):
        return jsonify({"error": f"Ruteador {router_id} no existe"}), 404

    iface = RouterInterface(
        router_id       = router_id,
        name            = name,
        iface_type      = iface_type,
        capacity_gbps   = int(data.get("capacity_gbps", 100)),
        lambda_id       = data.get("lambda_id"),
        isp_provider_id = data.get("isp_provider_id"),
        isis_metric     = int(data.get("isis_metric", 10)) if iface_type == "lambda" else None,
    )
    db.session.add(iface)
    db.session.commit()
    return jsonify(iface.to_dict()), 201


@bp.delete("/router-interfaces/<int:iface_id>")
def delete_router_interface(iface_id):
    iface = RouterInterface.query.get_or_404(iface_id)
    db.session.delete(iface)
    db.session.commit()
    return jsonify({"ok": True})


@bp.put("/router-interfaces/<int:iface_id>")
def update_router_interface(iface_id):
    """Actualiza la métrica ISIS de una interfaz lambda (Cisco/Juniper)."""
    iface = RouterInterface.query.get_or_404(iface_id)
    data  = request.get_json(silent=True) or {}

    if "isis_metric" in data:
        val = data["isis_metric"]
        if not isinstance(val, int) or not (1 <= val <= 16777214):
            return jsonify({"error": "isis_metric debe ser un entero entre 1 y 16 777 214"}), 422
        if iface.iface_type != "lambda":
            return jsonify({"error": "isis_metric solo aplica a interfaces tipo 'lambda'"}), 422
        iface.isis_metric = val

    db.session.commit()
    return jsonify(iface.to_dict())


# ── Proveedores ISP ───────────────────────────────────────────────────────────

@bp.get("/isp-providers")
def get_isp_providers():
    providers = ISPProvider.query.order_by(ISPProvider.name).all()
    return jsonify([p.to_dict() for p in providers])


@bp.post("/isp-providers")
def create_isp_provider():
    data  = request.get_json(silent=True) or {}
    name  = (data.get("name") or "").strip()
    color = (data.get("color") or "").strip()

    if not name or not color:
        return jsonify({"error": "name y color son obligatorios"}), 422
    if not color.startswith("#") or len(color) != 7:
        return jsonify({"error": "color debe ser un hex de 7 caracteres (#RRGGBB)"}), 422
    if ISPProvider.query.filter_by(name=name).first():
        return jsonify({"error": f"Ya existe un proveedor llamado '{name}'"}), 409

    prov = ISPProvider(name=name, color=color)
    db.session.add(prov)
    db.session.commit()
    return jsonify(prov.to_dict()), 201


@bp.put("/isp-providers/<int:prov_id>")
def update_isp_provider(prov_id):
    prov  = ISPProvider.query.get_or_404(prov_id)
    data  = request.get_json(silent=True) or {}
    name  = (data.get("name") or "").strip()
    color = (data.get("color") or "").strip()

    if name and name != prov.name:
        if ISPProvider.query.filter_by(name=name).first():
            return jsonify({"error": f"Ya existe un proveedor llamado '{name}'"}), 409
        prov.name = name
    if color:
        if not color.startswith("#") or len(color) != 7:
            return jsonify({"error": "color debe ser un hex de 7 caracteres (#RRGGBB)"}), 422
        prov.color = color

    db.session.commit()
    return jsonify(prov.to_dict())


@bp.delete("/isp-providers/<int:prov_id>")
def delete_isp_provider(prov_id):
    prov = ISPProvider.query.get_or_404(prov_id)
    iface_count = RouterInterface.query.filter_by(isp_provider_id=prov_id).count()
    flow_count  = TrafficFlow.query.filter_by(isp_provider_id=prov_id).count()
    if iface_count or flow_count:
        return jsonify({
            "error": f"No se puede eliminar: el proveedor tiene "
                     f"{iface_count} interfaz(ces) y {flow_count} flujo(s) activos"
        }), 409

    db.session.delete(prov)
    db.session.commit()
    return jsonify({"ok": True})


# ── Flujos de tráfico ─────────────────────────────────────────────────────────

@bp.get("/traffic-flows")
def get_traffic_flows():
    flows = TrafficFlow.query.all()
    return jsonify([f.to_dict() for f in flows])


@bp.put("/traffic-flows/<int:flow_id>")
def update_traffic_flow(flow_id):
    flow = TrafficFlow.query.get_or_404(flow_id)
    data = request.get_json(silent=True) or {}

    if "traffic_gbps" in data:
        gbps = int(data["traffic_gbps"])
        if gbps < 0:
            return jsonify({"error": "traffic_gbps no puede ser negativo"}), 400
        # Validar que no supere la capacidad ISP total en el sitio ingress
        isp_capacity_gbps = RouterInterface.query.filter_by(
            isp_provider_id=flow.isp_provider_id,
        ).join(Router).filter(Router.site_id == flow.ingress_site_id).count() * 100
        if gbps > isp_capacity_gbps:
            return jsonify({
                "error": f"traffic_gbps ({gbps}) supera la capacidad ISP "
                         f"disponible en el sitio ({isp_capacity_gbps} Gbps)"
            }), 400
        flow.traffic_gbps = gbps

    db.session.commit()
    return jsonify(flow.to_dict())


# ── Simulación ISP ────────────────────────────────────────────────────────────

@bp.post("/simulation/isp-provider")
def simulate_isp_provider():
    """
    Simula la caída de un proveedor ISP en un sitio.
    Calcula redistribución proporcional local y, si queda déficit,
    sugiere rerouteo ISIS por interfaces lambda (métrica ascendente).
    """
    data          = request.get_json(silent=True) or {}
    provider_name = data.get("provider")
    site_id       = data.get("site_id")

    if not provider_name or not site_id:
        return jsonify({"error": "Se requieren 'provider' y 'site_id'"}), 400

    provider = ISPProvider.query.filter_by(name=provider_name).first()
    if not provider:
        return jsonify({"error": f"Proveedor '{provider_name}' no encontrado"}), 404

    router = Router.query.filter_by(site_id=site_id).first()
    if not router:
        return jsonify({"error": f"No hay ruteador en el sitio '{site_id}'"}), 404

    # ── Flujos e interfaces afectados ─────────────────────────────────────────

    affected_flows = TrafficFlow.query.filter_by(
        isp_provider_id=provider.id,
        ingress_site_id=site_id,
    ).all()

    affected_gbps = sum(f.traffic_gbps for f in affected_flows)

    provider_ifaces_total = RouterInterface.query.filter_by(
        router_id=router.id,
        iface_type="isp",
        isp_provider_id=provider.id,
    ).count()

    # ── Prioridades ISP: identificar qué proveedor absorbe el tráfico ─────────

    priority_fallback = []
    for flow in affected_flows:
        pgw = flow.pgw
        # Buscar proveedores de prioridad 2 y 3 para este PGW/egress
        fallback_priorities = ISPPriority.query.filter_by(
            egress_site_id=flow.egress_site_id,
            pgw=pgw,
        ).filter(ISPPriority.priority_level > 1).order_by(ISPPriority.priority_level).all()

        for fp in fallback_priorities:
            if fp.isp_provider_id != provider.id:
                priority_fallback.append({
                    "pgw":                 pgw,
                    "egress_site_id":      flow.egress_site_id,
                    "egress_site_name":    flow.egress_site.name if flow.egress_site else flow.egress_site_id,
                    "fallback_provider":   fp.isp_provider.name if fp.isp_provider else None,
                    "fallback_color":      fp.isp_provider.color if fp.isp_provider else None,
                    "fallback_ingress":    fp.ingress_site_id,
                    "priority_level":      fp.priority_level,
                    "traffic_at_risk_gbps": flow.traffic_gbps,
                })

    # ── Capacidad disponible de OTROS proveedores en el mismo sitio ───────────

    from ..models import ISPProvider as ISP
    other_providers = db.session.query(ISP).join(RouterInterface).filter(
        RouterInterface.router_id == router.id,
        RouterInterface.iface_type == "isp",
        RouterInterface.isp_provider_id != provider.id,
    ).distinct().all()

    other_summary = []
    for op in other_providers:
        op_ifaces_total = RouterInterface.query.filter_by(
            router_id=router.id, iface_type="isp", isp_provider_id=op.id
        ).count()
        op_used_gbps = sum(
            f.traffic_gbps
            for f in TrafficFlow.query.filter_by(isp_provider_id=op.id, ingress_site_id=site_id).all()
        )
        op_capacity_gbps = op_ifaces_total * 100
        op_avail_gbps = max(0, op_capacity_gbps - op_used_gbps)
        other_summary.append({
            "provider":          op.name,
            "color":             op.color,
            "capacity_gbps":     op_capacity_gbps,
            "used_gbps":         op_used_gbps,
            "available_gbps":    op_avail_gbps,
        })

    available_gbps = sum(s["available_gbps"] for s in other_summary)
    deficit_gbps   = max(0, affected_gbps - available_gbps)

    # ── Redistribución proporcional (local) ────────────────────────────────────

    redistribution_detail = []
    if available_gbps > 0 and affected_gbps > 0:
        for s in other_summary:
            if s["available_gbps"] > 0:
                prop          = s["available_gbps"] / available_gbps
                absorbed_gbps = round(affected_gbps * prop, 1)
                redistribution_detail.append({
                    "provider":       s["provider"],
                    "color":          s["color"],
                    "capacity_gbps":  s["capacity_gbps"],
                    "absorbed_gbps":  absorbed_gbps,
                    "overloaded":     absorbed_gbps > s["capacity_gbps"],
                })

    # ── Rerouteo ISIS por interfaces lambda (solo si hay déficit) ────────────

    isis_rerouting = []
    if deficit_gbps > 0 and router.brand in ("cisco", "juniper"):
        lambda_ifaces = [
            i for i in router.interfaces
            if i.iface_type == "lambda" and i.lambda_ and i.isis_metric is not None
        ]
        seen_remote = set()
        for iface in sorted(lambda_ifaces, key=lambda x: x.isis_metric):
            remote_site_id = _lambda_remote_site(iface.lambda_, site_id)
            if not remote_site_id or remote_site_id in seen_remote:
                continue
            seen_remote.add(remote_site_id)

            remote_router = Router.query.filter_by(site_id=remote_site_id).first()
            if not remote_router:
                continue

            remote_isp_total = RouterInterface.query.filter_by(
                router_id=remote_router.id, iface_type="isp"
            ).count() * 100

            remote_used = sum(
                f.traffic_gbps
                for f in TrafficFlow.query.filter_by(ingress_site_id=remote_site_id).all()
            )
            remote_available = max(0, remote_isp_total - remote_used)

            isis_rerouting.append({
                "interface_name":            iface.name,
                "lambda_name":               iface.lambda_.name,
                "isis_metric":               iface.isis_metric,
                "remote_site_id":            remote_site_id,
                "remote_site_name":          remote_router.site.name if remote_router.site else remote_site_id,
                "remote_isp_capacity_gbps":  remote_isp_total,
                "remote_isp_available_gbps": remote_available,
            })

    return jsonify({
        "provider":              provider_name,
        "provider_color":        provider.color,
        "site_id":               site_id,
        "site_name":             router.site.name if router.site else site_id,
        "provider_ifaces_total": provider_ifaces_total,
        "affected_flows_count":  len(affected_flows),
        "affected_gbps":         affected_gbps,
        "available_gbps":        available_gbps,
        "deficit_gbps":          deficit_gbps,
        "status":                "deficit" if deficit_gbps > 0 else ("redistributed" if affected_gbps > 0 else "no_traffic"),
        "priority_fallback":     priority_fallback,
        "redistribution_detail": redistribution_detail,
        "isis_rerouting":        isis_rerouting,
        "affected_flows":        [f.to_dict() for f in affected_flows],
    })


@bp.post("/simulation/lambda-traffic")
def simulate_lambda_traffic():
    """Calcula el impacto de la caída de una o varias lambdas sobre los flujos de tráfico."""
    data = request.get_json(silent=True) or {}
    lambda_names = data.get("lambda_names", [])  # lista de nombres de lambda

    if not lambda_names:
        return jsonify({"error": "Se requiere 'lambda_names' (lista de nombres)"}), 400

    failed_set = set(lambda_names)
    all_flows  = TrafficFlow.query.all()

    affected = []
    for flow in all_flows:
        if not flow.lambda_names or flow.traffic_gbps == 0:
            continue
        flow_lambdas = {n.strip() for n in flow.lambda_names.split(",")}
        impacted = flow_lambdas & failed_set
        if impacted:
            affected.append({
                **flow.to_dict(),
                "failed_lambdas": list(impacted),
                "traffic_at_risk_gbps": flow.traffic_gbps,
            })

    total_at_risk = sum(a["traffic_at_risk_gbps"] for a in affected)

    return jsonify({
        "failed_lambdas": list(failed_set),
        "affected_flows_count": len(affected),
        "total_traffic_at_risk_gbps": total_at_risk,
        "affected_flows": affected,
    })


# ── Prioridades ISP ───────────────────────────────────────────────────────────

@bp.get("/isp-priorities")
def get_isp_priorities():
    """Lista todas las prioridades ISP, agrupadas por (egress_site, pgw)."""
    priorities = ISPPriority.query.order_by(
        ISPPriority.egress_site_id,
        ISPPriority.pgw,
        ISPPriority.priority_level,
    ).all()
    return jsonify([p.to_dict() for p in priorities])


@bp.put("/isp-priorities/<int:priority_id>")
def update_isp_priority(priority_id):
    """Actualiza el priority_level de un registro ISPPriority."""
    priority = ISPPriority.query.get_or_404(priority_id)
    data  = request.get_json(silent=True) or {}
    level = data.get("priority_level")

    if level is None or not isinstance(level, int) or level < 1:
        return jsonify({"error": "priority_level debe ser un entero ≥ 1"}), 422

    priority.priority_level = level
    db.session.commit()
    return jsonify(priority.to_dict())


@bp.post("/isp-priorities/reorder")
def reorder_isp_priorities():
    """
    Intercambia los priority_level de dos registros ISPPriority.
    Body: { "id_a": <int>, "id_b": <int> }
    """
    data = request.get_json(silent=True) or {}
    id_a = data.get("id_a")
    id_b = data.get("id_b")

    if not id_a or not id_b:
        return jsonify({"error": "Se requieren 'id_a' e 'id_b'"}), 422

    pa = ISPPriority.query.get_or_404(id_a)
    pb = ISPPriority.query.get_or_404(id_b)

    pa.priority_level, pb.priority_level = pb.priority_level, pa.priority_level
    db.session.commit()
    return jsonify({"a": pa.to_dict(), "b": pb.to_dict()})


# ── Simulación: falla de ruteador ─────────────────────────────────────────────

@bp.post("/simulation/router")
def simulate_router_failure():
    """
    Simula la caída de un ruteador.
    Calcula: flujos afectados (ingress en ese sitio), lambdas que pasan por el sitio,
    capacidad en riesgo, y análisis de prioridades BGP (fallback ISP).
    """
    data      = request.get_json(silent=True) or {}
    router_id = data.get("router_id")

    if not router_id:
        return jsonify({"error": "Se requiere 'router_id'"}), 400

    router = Router.query.get_or_404(router_id)
    site_id = router.site_id

    # Flujos con ingress en este sitio
    affected_flows = TrafficFlow.query.filter_by(ingress_site_id=site_id).all()
    affected_gbps  = sum(f.traffic_gbps for f in affected_flows)

    # Lambdas que terminan o pasan por este sitio
    lambda_ifaces = [i for i in router.interfaces if i.iface_type == "lambda" and i.lambda_]
    affected_lambdas = list({i.lambda_.name for i in lambda_ifaces})

    # Prioridades de fallback para los PGWs afectados
    pgw_egress_pairs = {(f.egress_site_id, f.pgw) for f in affected_flows if f.pgw}
    priority_fallback = []
    for egress_site_id, pgw in sorted(pgw_egress_pairs):
        fallbacks = ISPPriority.query.filter_by(
            egress_site_id=egress_site_id, pgw=pgw,
        ).order_by(ISPPriority.priority_level).all()
        priority_fallback.append({
            "egress_site_id":   egress_site_id,
            "pgw":              pgw,
            "priorities":       [fp.to_dict() for fp in fallbacks],
        })

    # Rerouteo ISIS: hacia qué sitios puede reconverger el tráfico
    isis_options = []
    for iface in sorted(
        [i for i in router.interfaces if i.iface_type == "lambda" and i.isis_metric],
        key=lambda x: x.isis_metric
    ):
        remote = _lambda_remote_site(iface.lambda_, site_id)
        if not remote:
            continue
        remote_rtr = Router.query.filter_by(site_id=remote).first()
        remote_isp = RouterInterface.query.filter_by(
            router_id=remote_rtr.id, iface_type="isp"
        ).count() * 100 if remote_rtr else 0
        isis_options.append({
            "lambda_name":              iface.lambda_.name,
            "isis_metric":              iface.isis_metric,
            "remote_site_id":           remote,
            "remote_site_name":         remote_rtr.site.name if remote_rtr and remote_rtr.site else remote,
            "remote_isp_capacity_gbps": remote_isp,
        })

    return jsonify({
        "router_id":            router_id,
        "router_name":          router.name,
        "site_id":              site_id,
        "site_name":            router.site.name if router.site else site_id,
        "affected_flows_count": len(affected_flows),
        "affected_gbps":        affected_gbps,
        "affected_lambdas":     affected_lambdas,
        "priority_fallback":    priority_fallback,
        "isis_options":         isis_options,
        "affected_flows":       [f.to_dict() for f in affected_flows],
    })


# ── Reporte de simulación completo ────────────────────────────────────────────

@bp.get("/simulation/report")
def get_simulation_report():
    """
    Genera un reporte de análisis completo:
    1. Adecuación de prioridades: verifica si prioridad 2+3 cubren el tráfico de prioridad 1.
    2. Criticidad de lambdas: lambdas ordenadas por tráfico ISP afectado si fallan.
    3. Criticidad de proveedores ISP: proveedores ordenados por tráfico afectado si fallan.
    """
    all_flows      = TrafficFlow.query.all()
    all_priorities = ISPPriority.query.all()

    # ── 1. Adecuación de prioridades ─────────────────────────────────────────
    # Para cada (egress_site, pgw), verificar si el proveedor primario falla
    # y los secundarios/terciarios tienen capacidad suficiente.

    priority_adequacy = []
    # Agrupar prioridades por (egress_site, pgw)
    pgw_groups: dict[tuple, list] = {}
    for p in all_priorities:
        key = (p.egress_site_id, p.pgw)
        pgw_groups.setdefault(key, []).append(p)

    for (egress, pgw), priorities in sorted(pgw_groups.items()):
        priorities.sort(key=lambda x: x.priority_level)
        primary = next((p for p in priorities if p.priority_level == 1), None)
        if not primary:
            continue

        # Tráfico primario
        primary_flows = [
            f for f in all_flows
            if f.isp_provider_id == primary.isp_provider_id
            and f.ingress_site_id == primary.ingress_site_id
            and f.egress_site_id == egress
            and f.pgw == pgw
        ]
        primary_gbps = sum(f.traffic_gbps for f in primary_flows)

        # Capacidad de fallback (prioridades 2 y 3)
        fallback_capacity = 0
        fallback_details  = []
        for fp in priorities:
            if fp.priority_level == 1:
                continue
            fb_ifaces = RouterInterface.query.filter_by(
                isp_provider_id=fp.isp_provider_id,
            ).join(Router).filter(Router.site_id == fp.ingress_site_id).count()
            fb_used = sum(
                f.traffic_gbps
                for f in all_flows
                if f.isp_provider_id == fp.isp_provider_id
                and f.ingress_site_id == fp.ingress_site_id
                and f.egress_site_id == egress
                and f.pgw == pgw
            )
            fb_avail = max(0, fb_ifaces * 100 - fb_used)
            fallback_capacity += fb_avail
            fallback_details.append({
                "priority_level":    fp.priority_level,
                "provider":          fp.isp_provider.name if fp.isp_provider else None,
                "ingress_site_id":   fp.ingress_site_id,
                "available_gbps":    fb_avail,
            })

        adequate = fallback_capacity >= primary_gbps
        priority_adequacy.append({
            "egress_site_id":     egress,
            "egress_site_name":   primary.egress_site.name if primary.egress_site else egress,
            "pgw":                pgw,
            "primary_provider":   primary.isp_provider.name if primary.isp_provider else None,
            "primary_gbps":       primary_gbps,
            "fallback_capacity_gbps": fallback_capacity,
            "adequate":           adequate,
            "fallback_details":   fallback_details,
        })

    # ── 2. Criticidad de lambdas (por tráfico afectado) ───────────────────────

    lambda_criticality: dict[str, int] = {}
    for flow in all_flows:
        if not flow.lambda_names or flow.traffic_gbps == 0:
            continue
        for lname in flow.lambda_names.split(","):
            lname = lname.strip()
            lambda_criticality[lname] = lambda_criticality.get(lname, 0) + flow.traffic_gbps

    lambda_ranking = sorted(
        [{"lambda_name": k, "traffic_at_risk_gbps": v} for k, v in lambda_criticality.items()],
        key=lambda x: x["traffic_at_risk_gbps"], reverse=True
    )

    # ── 3. Criticidad de proveedores ISP ──────────────────────────────────────

    provider_criticality: dict[str, dict] = {}
    for flow in all_flows:
        if flow.traffic_gbps == 0:
            continue
        pname = flow.isp_provider.name if flow.isp_provider else "Unknown"
        pcolor = flow.isp_provider.color if flow.isp_provider else "#888"
        if pname not in provider_criticality:
            provider_criticality[pname] = {"traffic_gbps": 0, "color": pcolor, "flows": 0}
        provider_criticality[pname]["traffic_gbps"] += flow.traffic_gbps
        provider_criticality[pname]["flows"] += 1

    provider_ranking = sorted(
        [{"provider": k, **v} for k, v in provider_criticality.items()],
        key=lambda x: x["traffic_gbps"], reverse=True
    )

    return jsonify({
        "priority_adequacy":  priority_adequacy,
        "lambda_ranking":     lambda_ranking,
        "provider_ranking":   provider_ranking,
    })
