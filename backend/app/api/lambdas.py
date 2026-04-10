"""API de lambdas — CRUD completo."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Lambda, Segment, LambdaSegment, Site

bp = Blueprint("lambdas", __name__)


def _canonical(a: str, b: str):
    return (a, b) if a <= b else (b, a)


@bp.get("/lambdas")
def list_lambdas():
    """Lista todas las lambdas con sus segmentos."""
    lambdas = Lambda.query.order_by(Lambda.name).all()
    return jsonify([l.to_dict(include_segments=True) for l in lambdas])


@bp.get("/lambdas/<int:lambda_id>")
def get_lambda(lambda_id):
    """Obtiene una lambda por ID."""
    lam = Lambda.query.get_or_404(lambda_id)
    return jsonify(lam.to_dict(include_segments=True))


@bp.post("/lambdas")
def create_lambda():
    """Crea una nueva lambda."""
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    color = data.get("color", "").strip()

    if not name:
        return jsonify({"error": "El campo 'name' es obligatorio."}), 422
    if not color or not color.startswith("#") or len(color) != 7:
        return jsonify({"error": "El campo 'color' debe ser un hex válido (#RRGGBB)."}), 422

    # Regla: color único entre lambdas activas
    if Lambda.query.filter_by(color=color.upper()).first() or \
       Lambda.query.filter_by(color=color.lower()).first():
        return jsonify({"error": f"El color '{color}' ya está en uso por otra lambda."}), 422

    if Lambda.query.filter_by(name=name).first():
        return jsonify({"error": f"Ya existe una lambda con el nombre '{name}'."}), 409

    lam = Lambda(
        name=name,
        color=color,
        num_lambdas=data.get("num_lambdas", 1),
        capacity_per_lambda=data.get("capacity_per_lambda", 100),
        protection_route_name=data.get("protection_route_name"),
    )
    db.session.add(lam)
    db.session.flush()

    # Insertar segmentos
    segments_data = data.get("segments", [])
    order = 0
    for seg_data in segments_data:
        site_a = seg_data.get("site_a_id", "").strip()
        site_b = seg_data.get("site_b_id", "").strip()
        if not site_a or not site_b or site_a == site_b:
            continue  # ignorar tramos inválidos o bucles
        fiber    = seg_data.get("fiber", "ruta_1")
        provider = seg_data.get("fiber_provider", "").strip()

        can_a, can_b = _canonical(site_a, site_b)
        seg = Segment.query.filter_by(site_a_id=can_a, site_b_id=can_b, fiber=fiber).first()
        if not seg:
            seg = Segment(site_a_id=can_a, site_b_id=can_b, fiber=fiber, fiber_provider=provider or None)
            db.session.add(seg)
            db.session.flush()
        elif provider:
            seg.fiber_provider = provider  # actualizar proveedor si el usuario lo cambió

        ls = LambdaSegment(lambda_id=lam.id, segment_id=seg.id, order_index=order)
        db.session.add(ls)
        order += 1

    db.session.commit()
    return jsonify(lam.to_dict(include_segments=True)), 201


@bp.put("/lambdas/<int:lambda_id>")
def update_lambda(lambda_id):
    """Actualiza una lambda existente."""
    lam = Lambda.query.get_or_404(lambda_id)
    data = request.get_json(force=True)

    new_color = data.get("color", lam.color)
    if new_color != lam.color:
        if not new_color.startswith("#") or len(new_color) != 7:
            return jsonify({"error": "El campo 'color' debe ser un hex válido (#RRGGBB)."}), 422
        existing = Lambda.query.filter(
            Lambda.color == new_color, Lambda.id != lambda_id
        ).first()
        if existing:
            return jsonify({"error": f"El color '{new_color}' ya está en uso por '{existing.name}'."}), 422

    lam.name = data.get("name", lam.name)
    lam.color = new_color
    lam.num_lambdas = data.get("num_lambdas", lam.num_lambdas)
    lam.capacity_per_lambda = data.get("capacity_per_lambda", lam.capacity_per_lambda)
    lam.protection_route_name = data.get("protection_route_name", lam.protection_route_name)

    # Actualizar segmentos si se proporcionan
    if "segments" in data:
        LambdaSegment.query.filter_by(lambda_id=lam.id).delete(synchronize_session=False)
        db.session.flush()
        order = 0
        for seg_data in data["segments"]:
            site_a = seg_data.get("site_a_id", "").strip()
            site_b = seg_data.get("site_b_id", "").strip()
            if not site_a or not site_b or site_a == site_b:
                continue  # ignorar tramos inválidos o bucles
            fiber    = seg_data.get("fiber", "ruta_1")
            provider = seg_data.get("fiber_provider", "").strip()
            can_a, can_b = _canonical(site_a, site_b)
            seg = Segment.query.filter_by(site_a_id=can_a, site_b_id=can_b, fiber=fiber).first()
            if not seg:
                seg = Segment(site_a_id=can_a, site_b_id=can_b, fiber=fiber, fiber_provider=provider or None)
                db.session.add(seg)
                db.session.flush()
            elif provider:
                seg.fiber_provider = provider  # actualizar proveedor si el usuario lo cambió
            ls = LambdaSegment(lambda_id=lam.id, segment_id=seg.id, order_index=order)
            db.session.add(ls)
            order += 1

    db.session.commit()
    return jsonify(lam.to_dict(include_segments=True))


@bp.delete("/lambdas/<int:lambda_id>")
def delete_lambda(lambda_id):
    """Elimina una lambda y sus asociaciones con segmentos."""
    lam = Lambda.query.get_or_404(lambda_id)
    name = lam.name
    db.session.delete(lam)
    db.session.commit()
    return jsonify({"message": f"Lambda '{name}' eliminada correctamente."})
