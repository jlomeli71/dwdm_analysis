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

    # ── Redistribución basada en prioridades ISP, agrupada por (egress, pgw) ──
    # Cada (egress, pgw) tiene sus propios fallbacks; se calcula redistribución
    # de forma independiente para evitar mezclar fallbacks de distintos PGW.

    from collections import defaultdict

    # Agrupar flujos afectados por (egress_site_id, pgw)
    pgw_flow_groups: dict[tuple, list] = defaultdict(list)
    for flow in affected_flows:
        pgw_flow_groups[(flow.egress_site_id, flow.pgw)].append(flow)

    # Cache de capacidad por (provider_id, ingress_site_id) para no re-consultar
    _fb_cap_cache: dict[tuple, dict] = {}

    def _get_fb_capacity(prov_id: int, ingress: str) -> dict:
        key = (prov_id, ingress)
        if key not in _fb_cap_cache:
            fb_router = Router.query.filter_by(site_id=ingress).first()
            if not fb_router:
                _fb_cap_cache[key] = {"capacity_gbps": 0, "used_gbps": 0, "available_gbps": 0}
            else:
                fb_ifaces = RouterInterface.query.filter_by(
                    router_id=fb_router.id, iface_type="isp", isp_provider_id=prov_id
                ).count()
                fb_used = sum(
                    f.traffic_gbps
                    for f in TrafficFlow.query.filter_by(
                        isp_provider_id=prov_id, ingress_site_id=ingress
                    ).all()
                )
                cap = fb_ifaces * 100
                _fb_cap_cache[key] = {
                    "capacity_gbps": cap,
                    "used_gbps":     fb_used,
                    "available_gbps": max(0, cap - fb_used),
                }
        return _fb_cap_cache[key]

    priority_fallback = []
    redistribution_detail = []
    total_avail_all = 0
    total_deficit_all = 0

    for (egress, pgw), flows_grp in sorted(pgw_flow_groups.items()):
        grp_affected = sum(f.traffic_gbps for f in flows_grp)
        egress_name  = flows_grp[0].egress_site.name if flows_grp[0].egress_site else egress

        # Fallbacks para este (egress, pgw): todos los proveedores ≠ fallido
        fb_priorities = ISPPriority.query.filter_by(
            egress_site_id=egress, pgw=pgw,
        ).filter(
            ISPPriority.isp_provider_id != provider.id,
        ).order_by(ISPPriority.priority_level).all()

        # Deduplicar dentro de este grupo (egress, pgw)
        seen_in_grp: set[tuple] = set()
        grp_fallbacks = []
        for fp in fb_priorities:
            k = (fp.isp_provider_id, fp.ingress_site_id)
            if k in seen_in_grp:
                continue
            seen_in_grp.add(k)
            cap_info = _get_fb_capacity(fp.isp_provider_id, fp.ingress_site_id)
            fb_entry = {
                "egress_site_id":    egress,
                "egress_site_name":  egress_name,
                "pgw":               pgw,
                "provider":          fp.isp_provider.name if fp.isp_provider else None,
                "color":             fp.isp_provider.color if fp.isp_provider else None,
                "ingress_site_id":   fp.ingress_site_id,
                "ingress_site_name": fp.ingress_site.name if fp.ingress_site else fp.ingress_site_id,
                "priority_level":    fp.priority_level,
                **cap_info,
            }
            grp_fallbacks.append(fb_entry)
            priority_fallback.append({
                "pgw": pgw,
                "egress_site_id": egress,
                "egress_site_name": egress_name,
                "fallback_provider": fb_entry["provider"],
                "fallback_color":    fb_entry["color"],
                "fallback_ingress":  fb_entry["ingress_site_id"],
                "fallback_ingress_name": fb_entry["ingress_site_name"],
                "priority_level":    fb_entry["priority_level"],
                "traffic_at_risk_gbps": grp_affected,
            })

        grp_avail = sum(s["available_gbps"] for s in grp_fallbacks)
        total_avail_all += grp_avail

        # Redistribución ordenada por prioridad: P2 absorbe primero hasta su
        # capacidad disponible; solo si desborda pasa al P3, y así sucesivamente.
        # grp_fallbacks ya viene ordenado por priority_level (menor = mayor prioridad).
        remaining = float(grp_affected)
        for s in grp_fallbacks:
            if remaining <= 0:
                break
            if s["available_gbps"] <= 0:
                continue
            absorbed  = round(min(remaining, s["available_gbps"]), 1)
            remaining = round(remaining - absorbed, 1)
            redistribution_detail.append({
                **s,
                "absorbed_gbps": absorbed,
                "overloaded":    absorbed > s["capacity_gbps"],
            })
        grp_deficit = max(0.0, round(remaining, 1))
        total_deficit_all += grp_deficit

    available_gbps = total_avail_all
    deficit_gbps   = total_deficit_all

    # ── Rerouteo ISIS por interfaces lambda (si hay déficit) ─────────────────

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

    # ── Reconvergencia ISIS por redistribución a sitios remotos ──────────────
    # Para cada entrada de redistribución donde el fallback ingresa por un sitio
    # distinto al proveedor fallido, se busca la lambda que conecta el sitio de
    # ingreso fallback directamente con el sitio egress (PGW destino).
    # Solo se muestra esa lambda específica, no todas las del router fallback.

    isis_reconvergence = []
    seen_isis_iface: set = set()

    for rd_entry in redistribution_detail:
        fb_site_id   = rd_entry["ingress_site_id"]
        fb_site_name = rd_entry["ingress_site_name"]
        egress_site  = rd_entry["egress_site_id"]
        egress_name  = rd_entry["egress_site_name"]

        if fb_site_id == site_id:  # mismo sitio que el fallido → no hay traversal
            continue

        fb_router = Router.query.filter_by(site_id=fb_site_id).first()
        if not fb_router:
            continue

        lambda_ifaces = [
            i for i in fb_router.interfaces
            if i.iface_type == "lambda" and i.lambda_ and i.isis_metric is not None
        ]

        for iface in sorted(lambda_ifaces, key=lambda x: x.isis_metric):
            remote_site_id = _lambda_remote_site(iface.lambda_, fb_site_id)
            # Solo la lambda cuyo extremo remoto ES el sitio egress (PGW destino)
            if remote_site_id != egress_site:
                continue
            key = (fb_site_id, iface.id, egress_site)
            if key in seen_isis_iface:
                continue
            seen_isis_iface.add(key)
            isis_reconvergence.append({
                "source_site_id":   fb_site_id,
                "source_site_name": fb_site_name,
                "egress_site_id":   egress_site,
                "egress_site_name": egress_name,
                "pgw":              rd_entry["pgw"],
                "absorbed_gbps":    rd_entry["absorbed_gbps"],
                "interface_name":   iface.name,
                "lambda_name":      iface.lambda_.name,
                "isis_metric":      iface.isis_metric,
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
        "isis_reconvergence":    isis_reconvergence,
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
    """Actualiza priority_level y/o la asignación de proveedor de un ISPPriority."""
    priority = ISPPriority.query.get_or_404(priority_id)
    data = request.get_json(silent=True) or {}

    # Reasignación de proveedor
    if "isp_provider_id" in data or "ingress_site_id" in data:
        new_provider_id  = int(data.get("isp_provider_id",  priority.isp_provider_id))
        new_ingress_site = data.get("ingress_site_id", priority.ingress_site_id)

        provider = ISPProvider.query.get(new_provider_id)
        if not provider:
            return jsonify({"error": "Proveedor ISP no encontrado"}), 404

        duplicate = ISPPriority.query.filter_by(
            egress_site_id=priority.egress_site_id,
            pgw=priority.pgw,
            isp_provider_id=new_provider_id,
            ingress_site_id=new_ingress_site,
        ).filter(ISPPriority.id != priority_id).first()
        if duplicate:
            return jsonify({"error": "Proveedor ya asignado en otro nivel para este (sitio, PGW)"}), 409

        priority.isp_provider_id = new_provider_id
        priority.ingress_site_id = new_ingress_site
        db.session.commit()
        return jsonify(priority.to_dict())

    # Solo priority_level
    level = data.get("priority_level")
    if level is None or not isinstance(level, int) or level < 1:
        return jsonify({"error": "Se requiere priority_level o {isp_provider_id, ingress_site_id}"}), 422

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
    # Agrupa por proveedor P1 (la entidad que falla), no por (egress, pgw).
    # Cuando un ISP cae afecta TODOS los sitios donde es primario simultáneamente;
    # los proveedores de fallback tienen capacidad COMPARTIDA, no independiente.

    priority_adequacy = []

    # Paso 1: agrupar prioridades por (egress, pgw)
    pgw_groups: dict[tuple, list] = {}
    for p in all_priorities:
        key = (p.egress_site_id, p.pgw)
        pgw_groups.setdefault(key, []).append(p)

    # Paso 2: agrupar por proveedor P1 — la entidad que simularemos que falla
    p1_groups: dict[tuple, list] = {}  # (p1_prov_id, p1_ingress) -> [(egress, pgw, priorities)]
    for (egress, pgw), priorities in pgw_groups.items():
        priorities.sort(key=lambda x: x.priority_level)
        primary = next((p for p in priorities if p.priority_level == 1), None)
        if not primary:
            continue
        p1_key = (primary.isp_provider_id, primary.ingress_site_id)
        p1_groups.setdefault(p1_key, []).append((egress, pgw, priorities))

    # Paso 3: evaluar cada falla de P1
    for (p1_prov_id, p1_ingress), affected in sorted(
        p1_groups.items(), key=lambda x: (x[0][1], x[0][0])
    ):
        p1_prov_obj = ISPProvider.query.get(p1_prov_id)
        p1_site_obj = Site.query.get(p1_ingress)

        # Tráfico total a redistribuir: suma de todos los sitios afectados
        affected_sites_info = []
        total_gbps = 0
        for (egress, pgw, priorities) in affected:
            priority_pairs = {(p.isp_provider_id, p.ingress_site_id) for p in priorities}
            site_gbps = sum(
                f.traffic_gbps for f in all_flows
                if f.egress_site_id == egress
                and f.pgw == pgw
                and (f.isp_provider_id, f.ingress_site_id) in priority_pairs
            )
            total_gbps += site_gbps
            egress_obj = next(
                (p.egress_site for p in priorities if p.egress_site_id == egress), None
            )
            affected_sites_info.append({
                "egress_site_id":   egress,
                "egress_site_name": egress_obj.name if egress_obj else egress,
                "pgw":              pgw,
                "traffic_gbps":     site_gbps,
            })

        # Capacidad de fallback: proveedores P2+P3 deduplicados, con uso GLOBAL
        # (un mismo proveedor que aparece como P2 en varios sitios tiene capacidad única)
        fallback_providers: dict[tuple, dict] = {}
        for (egress, pgw, priorities) in affected:
            for fp in priorities:
                if fp.priority_level == 1:
                    continue
                fb_key = (fp.isp_provider_id, fp.ingress_site_id)
                if fb_key in fallback_providers:
                    continue
                fb_ifaces = RouterInterface.query.filter_by(
                    isp_provider_id=fp.isp_provider_id,
                ).join(Router).filter(Router.site_id == fp.ingress_site_id).count()
                # Uso global actual: todo el tráfico que este proveedor ya carga
                fb_used_global = sum(
                    f.traffic_gbps for f in all_flows
                    if f.isp_provider_id == fp.isp_provider_id
                    and f.ingress_site_id == fp.ingress_site_id
                )
                fb_avail = max(0, fb_ifaces * 100 - fb_used_global)
                fallback_providers[fb_key] = {
                    "priority_level":    fp.priority_level,
                    "provider":          fp.isp_provider.name if fp.isp_provider else None,
                    "ingress_site_id":   fp.ingress_site_id,
                    "ingress_site_name": fp.ingress_site.name if fp.ingress_site else fp.ingress_site_id,
                    "capacity_gbps":     fb_ifaces * 100,
                    "used_gbps":         fb_used_global,
                    "available_gbps":    fb_avail,
                }

        fallback_capacity = sum(v["available_gbps"] for v in fallback_providers.values())
        adequate = fallback_capacity >= total_gbps
        priority_adequacy.append({
            "primary_provider":       p1_prov_obj.name if p1_prov_obj else str(p1_prov_id),
            "primary_ingress_site":   p1_site_obj.name if p1_site_obj else p1_ingress,
            "primary_ingress_site_id": p1_ingress,
            "primary_color":          p1_prov_obj.color if p1_prov_obj else "#888",
            "total_gbps":             total_gbps,
            "fallback_capacity_gbps": fallback_capacity,
            "adequate":               adequate,
            "affected_sites":         affected_sites_info,
            "fallback_details":       list(fallback_providers.values()),
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

    # ── 3. Criticidad de proveedores ISP (por proveedor + sitio de ingreso) ──

    provider_criticality: dict[tuple, dict] = {}
    for flow in all_flows:
        if flow.traffic_gbps == 0:
            continue
        pname   = flow.isp_provider.name  if flow.isp_provider  else "Unknown"
        pcolor  = flow.isp_provider.color if flow.isp_provider  else "#888"
        iname   = flow.ingress_site.name  if flow.ingress_site  else flow.ingress_site_id
        key     = (pname, flow.ingress_site_id)
        if key not in provider_criticality:
            provider_criticality[key] = {
                "traffic_gbps":    0,
                "color":           pcolor,
                "flows":           0,
                "ingress_site_id": flow.ingress_site_id,
                "ingress_site_name": iname,
            }
        provider_criticality[key]["traffic_gbps"] += flow.traffic_gbps
        provider_criticality[key]["flows"] += 1

    provider_ranking = sorted(
        [{"provider": k[0], **v} for k, v in provider_criticality.items()],
        key=lambda x: x["traffic_gbps"], reverse=True
    )

    return jsonify({
        "priority_adequacy":  priority_adequacy,
        "lambda_ranking":     lambda_ranking,
        "provider_ranking":   provider_ranking,
    })
