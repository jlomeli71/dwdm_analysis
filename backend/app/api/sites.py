"""API de sitios — CRUD completo."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Site, Segment, LambdaSegment, Lambda

bp = Blueprint("sites", __name__)


@bp.get("/sites")
def list_sites():
    """Lista todos los sitios."""
    type_filter = request.args.get("type")
    region_filter = request.args.get("region")
    query_text = request.args.get("q", "").lower()

    query = Site.query
    if type_filter:
        query = query.filter(Site.type == type_filter)
    if region_filter:
        query = query.filter(Site.region == region_filter)
    if query_text:
        query = query.filter(
            db.or_(
                Site.name.ilike(f"%{query_text}%"),
                Site.id.ilike(f"%{query_text}%"),
                Site.city.ilike(f"%{query_text}%"),
            )
        )

    sites = query.order_by(Site.type, Site.name).all()
    return jsonify([s.to_dict() for s in sites])


@bp.get("/sites/<string:site_id>")
def get_site(site_id):
    """Obtiene un sitio por ID."""
    site = Site.query.get_or_404(site_id, description=f"Sitio '{site_id}' no encontrado.")
    return jsonify(site.to_dict())


@bp.post("/sites")
def create_site():
    """Crea un nuevo sitio."""
    data = request.get_json(force=True)
    site_id = data.get("id", "").strip()
    name = data.get("name", "").strip()

    # Validaciones básicas
    if not site_id or not name:
        return jsonify({"error": "Los campos 'id' y 'name' son obligatorios."}), 422

    if Site.query.get(site_id):
        return jsonify({"error": f"Ya existe un sitio con el ID '{site_id}'."}), 409

    # Validar coordenadas si se proporcionan
    lat = data.get("lat")
    lon = data.get("lon")
    if lat is not None and (lat < 14.5 or lat > 32.7):
        return jsonify({"error": "Latitud fuera del rango de México (14.5 – 32.7)."}), 422
    if lon is not None and (lon < -118.4 or lon > -86.7):
        return jsonify({"error": "Longitud fuera del rango de México (-118.4 – -86.7)."}), 422

    site = Site(
        id=site_id,
        name=name,
        type=data.get("type", "own"),
        region=data.get("region"),
        city=data.get("city"),
        lat=lat,
        lon=lon,
    )
    db.session.add(site)
    db.session.commit()
    return jsonify(site.to_dict()), 201


@bp.put("/sites/<string:site_id>")
def update_site(site_id):
    """Actualiza un sitio existente."""
    site = Site.query.get_or_404(site_id, description=f"Sitio '{site_id}' no encontrado.")
    data = request.get_json(force=True)

    if "name" in data and not data["name"].strip():
        return jsonify({"error": "El nombre no puede estar vacío."}), 422

    lat = data.get("lat", site.lat)
    lon = data.get("lon", site.lon)
    if lat is not None and (lat < 14.5 or lat > 32.7):
        return jsonify({"error": "Latitud fuera del rango de México (14.5 – 32.7)."}), 422
    if lon is not None and (lon < -118.4 or lon > -86.7):
        return jsonify({"error": "Longitud fuera del rango de México (-118.4 – -86.7)."}), 422

    site.name = data.get("name", site.name).strip()
    site.type = data.get("type", site.type)
    site.region = data.get("region", site.region)
    site.city = data.get("city", site.city)
    site.lat = lat
    site.lon = lon
    site.ola = data.get("ola", site.ola)

    db.session.commit()
    return jsonify(site.to_dict())


@bp.delete("/sites/<string:site_id>")
def delete_site(site_id):
    """Elimina un sitio. Retorna 409 si tiene segmentos activos."""
    site = Site.query.get_or_404(site_id, description=f"Sitio '{site_id}' no encontrado.")

    # Verificar segmentos que referencian este sitio
    segs = Segment.query.filter(
        db.or_(Segment.site_a_id == site_id, Segment.site_b_id == site_id)
    ).all()

    if segs:
        # Obtener lambdas afectadas
        seg_ids = [s.id for s in segs]
        ls_items = LambdaSegment.query.filter(LambdaSegment.segment_id.in_(seg_ids)).all()
        lambda_ids = list({ls.lambda_id for ls in ls_items})
        lambdas = Lambda.query.filter(Lambda.id.in_(lambda_ids)).all()
        return jsonify({
            "error": f"No se puede eliminar el sitio '{site_id}': tiene {len(segs)} segmento(s) activo(s).",
            "affected_lambdas": [{"id": l.id, "name": l.name, "color": l.color} for l in lambdas],
            "affected_segments": len(segs),
        }), 409

    db.session.delete(site)
    db.session.commit()
    return jsonify({"message": f"Sitio '{site_id}' eliminado correctamente."}), 200
