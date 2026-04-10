"""API de simulación de fallas — solo lectura."""
from flask import Blueprint, request, jsonify
from ..models import Segment, Lambda, LambdaSegment
from ..extensions import db

bp = Blueprint("simulation", __name__)


def _run_simulation(failed_segment_ids: list[int]) -> dict:
    """
    Ejecuta la simulación en memoria (sin modificar BD).
    Retorna el análisis de impacto completo.
    """
    failed_set = set(failed_segment_ids)

    # Obtener todos los segmentos fallidos
    failed_segments = Segment.query.filter(Segment.id.in_(failed_segment_ids)).all()
    failed_info = [
        {
            "id":           s.id,
            "site_a_id":    s.site_a_id,
            "site_b_id":    s.site_b_id,
            "site_a_name":  s.site_a.name if s.site_a else s.site_a_id,
            "site_b_name":  s.site_b.name if s.site_b else s.site_b_id,
            "fiber":        s.fiber,
            "fiber_provider": s.fiber_provider,
        }
        for s in failed_segments
    ]

    # Obtener lambdas que usan al menos un segmento fallido
    affected_ls = LambdaSegment.query.filter(
        LambdaSegment.segment_id.in_(failed_segment_ids)
    ).all()

    affected_lambda_ids = list({ls.lambda_id for ls in affected_ls})
    affected_lambdas = Lambda.query.filter(Lambda.id.in_(affected_lambda_ids)).all()

    results = []
    total_capacity_lost_gbps = 0

    for lam in affected_lambdas:
        # Segmentos de esta lambda
        lam_seg_ids = {ls.segment_id for ls in lam.lambda_segments}
        primary_lost = bool(lam_seg_ids & failed_set)  # Ruta principal afectada

        # Verificar ruta de protección (1+1)
        protection_lost = False
        protection_lambda = None
        if lam.protection_route_name:
            prot_lam = Lambda.query.filter_by(name=lam.protection_route_name).first()
            if prot_lam:
                protection_lambda = prot_lam.name
                prot_seg_ids = {ls.segment_id for ls in prot_lam.lambda_segments}
                protection_lost = bool(prot_seg_ids & failed_set)

        # Determinar estado del servicio
        if primary_lost and (not lam.protection_route_name or protection_lost):
            service_status = "down"          # Servicio caído completamente
        elif primary_lost and not protection_lost:
            service_status = "protected"     # Protección activa (solo ruta principal afectada)
        else:
            service_status = "ok"            # Segmento fallido no afecta esta lambda (raro)

        capacity_lost = lam.num_lambdas * lam.capacity_per_lambda if service_status == "down" else 0
        total_capacity_lost_gbps += capacity_lost

        results.append({
            "lambda_id":           lam.id,
            "lambda_name":         lam.name,
            "color":               lam.color,
            "service_status":      service_status,
            "primary_route_lost":  primary_lost,
            "protection_route":    protection_lambda,
            "protection_lost":     protection_lost if lam.protection_route_name else None,
            "capacity_lost_gbps":  capacity_lost,
            "num_lambdas":         lam.num_lambdas,
        })

    # Ordenar: primero "down", luego "protected"
    results.sort(key=lambda r: ({"down": 0, "protected": 1, "ok": 2}[r["service_status"]]))

    down_count       = sum(1 for r in results if r["service_status"] == "down")
    protected_count  = sum(1 for r in results if r["service_status"] == "protected")

    return {
        "failed_segments":            failed_info,
        "affected_lambdas_total":     len(results),
        "service_down_count":         down_count,
        "service_protected_count":    protected_count,
        "total_capacity_lost_gbps":   total_capacity_lost_gbps,
        "total_capacity_lost_tbps":   round(total_capacity_lost_gbps / 1000, 3),
        "affected_lambdas":           results,
    }


@bp.post("/simulation")
def simulate_by_segments():
    """
    Simula la falla de 1 o 2 segmentos.
    Body: { "segments": [segment_id, ...] }
    """
    data = request.get_json(force=True)
    segment_ids = data.get("segments", [])

    if not segment_ids:
        return jsonify({"error": "Se debe especificar al menos un segmento."}), 422
    if len(segment_ids) > 3:
        return jsonify({"error": "Se pueden simular máximo 3 segmentos simultáneos."}), 422

    # Validar que existan
    for sid in segment_ids:
        if not Segment.query.get(sid):
            return jsonify({"error": f"Segmento ID {sid} no encontrado."}), 404

    result = _run_simulation(segment_ids)
    return jsonify(result)


@bp.post("/simulation/provider")
def simulate_by_provider():
    """
    Simula la falla de todos los segmentos de un proveedor.
    Body: { "provider": "AT&T" }
    """
    data = request.get_json(force=True)
    provider = data.get("provider", "").strip()

    if not provider:
        return jsonify({"error": "Se debe especificar un proveedor."}), 422

    # Usar LIKE para encontrar segmentos con este proveedor aunque sea multi-proveedor (ej. "AT&T, Bestel")
    segments = Segment.query.filter(
        Segment.fiber_provider.like(f"%{provider}%")
    ).all()
    if not segments:
        return jsonify({"error": f"No hay segmentos con proveedor '{provider}'."}), 404

    segment_ids = [s.id for s in segments]
    result = _run_simulation(segment_ids)
    result["provider"] = provider
    result["failed_segments_count"] = len(segment_ids)
    return jsonify(result)
