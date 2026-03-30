"""API de segmentos — lectura."""
from flask import Blueprint, request, jsonify
from ..models import Segment, LambdaSegment

bp = Blueprint("segments", __name__)


@bp.get("/segments")
def list_segments():
    """Lista todos los segmentos únicos con métricas de uso."""
    provider_filter = request.args.get("provider")
    overloaded_only = request.args.get("overloaded") == "true"

    segments = Segment.query.all()

    if provider_filter:
        segments = [s for s in segments if s.fiber_provider == provider_filter]
    if overloaded_only:
        segments = [s for s in segments if s.usage_count >= 77]

    # Ordenar por mayor uso
    segments.sort(key=lambda s: s.usage_count, reverse=True)
    return jsonify([s.to_dict(include_lambdas=True) for s in segments])


@bp.get("/segments/<int:segment_id>")
def get_segment(segment_id):
    """Obtiene un segmento con todas las lambdas que lo usan."""
    seg = Segment.query.get_or_404(segment_id)
    return jsonify(seg.to_dict(include_lambdas=True))


@bp.get("/segments/<int:segment_id>/lambdas")
def get_segment_lambdas(segment_id):
    """Lista las lambdas que usan un segmento específico."""
    seg = Segment.query.get_or_404(segment_id)
    lambdas = [
        {"id": ls.lambda_.id, "name": ls.lambda_.name, "color": ls.lambda_.color,
         "num_lambdas": ls.lambda_.num_lambdas, "capacity_gbps": ls.lambda_.total_capacity_gbps}
        for ls in seg.lambda_segments
    ]
    return jsonify({
        "segment_id": segment_id,
        "site_a": seg.site_a_id,
        "site_b": seg.site_b_id,
        "fiber": seg.fiber,
        "fiber_provider": seg.fiber_provider,
        "usage_count": seg.usage_count,
        "usage_percent": seg.usage_percent,
        "lambdas": lambdas,
    })
