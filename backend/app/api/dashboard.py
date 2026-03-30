"""API de dashboard — KPIs y heatmap."""
from flask import Blueprint, jsonify
from sqlalchemy import func
from ..models import Site, Lambda, Segment, LambdaSegment
from ..extensions import db

bp = Blueprint("dashboard", __name__)


@bp.get("/dashboard/kpis")
def get_kpis():
    """KPIs generales de la red."""
    total_sites     = Site.query.count()
    own_sites       = Site.query.filter_by(type="own").count()
    third_party     = Site.query.filter_by(type="third_party").count()
    total_lambdas   = Lambda.query.count()
    total_segments  = Segment.query.count()

    # Capacidad total = suma de (num_lambdas * capacity_per_lambda) de todas las lambdas
    cap_result = db.session.query(
        func.sum(Lambda.num_lambdas * Lambda.capacity_per_lambda)
    ).scalar() or 0
    total_capacity_gbps  = cap_result
    total_capacity_tbps  = round(cap_result / 1000, 3)

    # Segmentos en alerta (≥77 lambdas)
    all_segments = Segment.query.all()
    alert_segments = [s for s in all_segments if s.usage_count >= 77]

    # Proveedor más común
    providers = {}
    for seg in all_segments:
        p = seg.fiber_provider or "Desconocido"
        providers[p] = providers.get(p, 0) + 1
    top_provider = max(providers, key=providers.get) if providers else None

    return jsonify({
        "total_sites":          total_sites,
        "own_sites":            own_sites,
        "third_party_sites":    third_party,
        "total_lambdas":        total_lambdas,
        "total_segments":       total_segments,
        "total_capacity_gbps":  total_capacity_gbps,
        "total_capacity_tbps":  total_capacity_tbps,
        "alert_segments_count": len(alert_segments),
        "top_fiber_provider":   top_provider,
    })


@bp.get("/dashboard/heatmap")
def get_heatmap():
    """Datos de calor por segmento, para overlay en el grafo D3."""
    segments = Segment.query.all()
    result = []
    for seg in segments:
        usage = seg.usage_count
        # Nivel de calor: 0=libre, 1=bajo, 2=medio, 3=alto, 4=alerta
        if usage == 0:
            heat = 0
        elif usage <= 24:
            heat = 1
        elif usage <= 48:
            heat = 2
        elif usage <= 76:
            heat = 3
        else:
            heat = 4  # alerta ≥77

        result.append({
            "segment_id":    seg.id,
            "site_a_id":     seg.site_a_id,
            "site_b_id":     seg.site_b_id,
            "fiber":         seg.fiber,
            "fiber_provider":seg.fiber_provider,
            "usage_count":   usage,
            "usage_percent": seg.usage_percent,
            "heat_level":    heat,
        })

    result.sort(key=lambda x: x["usage_count"], reverse=True)
    return jsonify(result)


@bp.get("/dashboard/segments")
def get_segment_usage():
    """Segmentos ordenados por uso, con datos para gráficas."""
    segments = Segment.query.all()
    data = []
    for seg in segments:
        label = f"{seg.site_a_id} ↔ {seg.site_b_id} ({seg.fiber})"
        data.append({
            "segment_id":       seg.id,
            "label":            label,
            "site_a_id":        seg.site_a_id,
            "site_b_id":        seg.site_b_id,
            "fiber":            seg.fiber,
            "fiber_provider":   seg.fiber_provider,
            "usage_count":      seg.usage_count,
            "capacity_gbps":    seg.usage_count * 100,
            "usage_percent":    seg.usage_percent,
            "is_overloaded":    seg.usage_count >= 77,
        })
    data.sort(key=lambda x: x["usage_count"], reverse=True)
    return jsonify(data)


@bp.get("/dashboard/providers")
def get_provider_distribution():
    """Distribución de segmentos por proveedor de fibra."""
    segments = Segment.query.all()
    providers: dict[str, int] = {}
    for seg in segments:
        p = seg.fiber_provider or "Desconocido"
        providers[p] = providers.get(p, 0) + 1

    return jsonify([
        {"provider": p, "count": c}
        for p, c in sorted(providers.items(), key=lambda x: x[1], reverse=True)
    ])
