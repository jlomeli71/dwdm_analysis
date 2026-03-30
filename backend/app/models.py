"""Modelos SQLAlchemy para la aplicación DWDM."""
from datetime import datetime
from .extensions import db


class Site(db.Model):
    """Sitio de la red (propio o de tercero)."""
    __tablename__ = "sites"

    id = db.Column(db.String(50), primary_key=True)  # ej: MSOTOL01, NFO-004
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False, default="own")  # own | third_party
    region = db.Column(db.String(50))
    city = db.Column(db.String(100))
    lat = db.Column(db.Float, nullable=True)
    lon = db.Column(db.Float, nullable=True)
    ola = db.Column(db.Boolean, default=False)  # amplificador óptico (OLA/EDFA)

    # Relaciones
    segments_a = db.relationship("Segment", foreign_keys="Segment.site_a_id",
                                  back_populates="site_a", lazy="dynamic")
    segments_b = db.relationship("Segment", foreign_keys="Segment.site_b_id",
                                  back_populates="site_b", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "region": self.region,
            "city": self.city,
            "lat": self.lat,
            "lon": self.lon,
            "ola": self.ola,
        }


class Lambda(db.Model):
    """Circuito óptico (lambda) sobre la red DWDM."""
    __tablename__ = "lambdas"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=False)       # hex ej: #FF69B4
    num_lambdas = db.Column(db.Integer, default=1)
    capacity_per_lambda = db.Column(db.Integer, default=100)  # Gbps
    protection_route_name = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    lambda_segments = db.relationship("LambdaSegment", back_populates="lambda_",
                                       cascade="all, delete-orphan", order_by="LambdaSegment.order_index")

    @property
    def total_capacity_gbps(self):
        return self.num_lambdas * self.capacity_per_lambda

    def to_dict(self, include_segments=False):
        d = {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "num_lambdas": self.num_lambdas,
            "capacity_per_lambda": self.capacity_per_lambda,
            "total_capacity_gbps": self.total_capacity_gbps,
            "protection_route_name": self.protection_route_name,
        }
        if include_segments:
            d["segments"] = [ls.to_dict() for ls in self.lambda_segments]
        return d


class Segment(db.Model):
    """Segmento físico de fibra entre dos sitios.
    Los sitios se almacenan en orden canónico (alfabético por ID).
    """
    __tablename__ = "segments"
    __table_args__ = (
        db.UniqueConstraint("site_a_id", "site_b_id", "fiber", name="uq_segment"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    site_a_id = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    site_b_id = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    fiber = db.Column(db.String(20), nullable=False, default="ruta_1")  # ruta_1 | ruta_2
    fiber_provider = db.Column(db.String(50), nullable=True)
    ola_count = db.Column(db.Integer, default=0)  # amplificadores ópticos intermedios

    # Relaciones
    site_a = db.relationship("Site", foreign_keys=[site_a_id], back_populates="segments_a")
    site_b = db.relationship("Site", foreign_keys=[site_b_id], back_populates="segments_b")
    lambda_segments = db.relationship("LambdaSegment", back_populates="segment",
                                       cascade="all, delete-orphan")

    @property
    def usage_count(self):
        """Número de lambdas que usan este segmento."""
        return len(self.lambda_segments)

    @property
    def usage_percent(self):
        """Porcentaje de uso vs 96 canales."""
        return round((self.usage_count / 96) * 100, 1)

    def to_dict(self, include_lambdas=False):
        d = {
            "id": self.id,
            "site_a_id": self.site_a_id,
            "site_b_id": self.site_b_id,
            "site_a_name": self.site_a.name if self.site_a else None,
            "site_b_name": self.site_b.name if self.site_b else None,
            "fiber": self.fiber,
            "fiber_provider": self.fiber_provider,
            "ola_count": self.ola_count,
            "usage_count": self.usage_count,
            "usage_percent": self.usage_percent,
            "is_overloaded": self.usage_count >= 77,
        }
        if include_lambdas:
            d["lambdas"] = [
                {"id": ls.lambda_.id, "name": ls.lambda_.name, "color": ls.lambda_.color}
                for ls in self.lambda_segments
            ]
        return d


class LambdaSegment(db.Model):
    """Asociación entre lambda y segmento (con orden)."""
    __tablename__ = "lambda_segments"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lambda_id = db.Column(db.Integer, db.ForeignKey("lambdas.id"), nullable=False)
    segment_id = db.Column(db.Integer, db.ForeignKey("segments.id"), nullable=False)
    order_index = db.Column(db.Integer, default=0)  # orden en la trayectoria de la lambda

    # Relaciones
    lambda_ = db.relationship("Lambda", back_populates="lambda_segments")
    segment = db.relationship("Segment", back_populates="lambda_segments")

    def to_dict(self):
        return {
            "segment_id": self.segment_id,
            "site_a_id": self.segment.site_a_id,
            "site_b_id": self.segment.site_b_id,
            "fiber": self.segment.fiber,
            "fiber_provider": self.segment.fiber_provider,
            "order_index": self.order_index,
        }
