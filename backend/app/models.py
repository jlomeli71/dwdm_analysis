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
    router = db.relationship("Router", back_populates="site", uselist=False)

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
    fiber_provider = db.Column(db.String(200), nullable=True)
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


# ── Capa IP / ISP ─────────────────────────────────────────────────────────────

class ISPProvider(db.Model):
    """Proveedor de servicio de Internet (tránsito/peering)."""
    __tablename__ = "isp_providers"

    id    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name  = db.Column(db.String(100), unique=True, nullable=False)
    color = db.Column(db.String(7), nullable=False)   # hex color para visualización

    interfaces   = db.relationship("RouterInterface", back_populates="isp_provider")
    traffic_flows = db.relationship("TrafficFlow", back_populates="isp_provider")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color}


class Router(db.Model):
    """Ruteador IP asociado a un sitio de la red."""
    __tablename__ = "routers"

    id      = db.Column(db.Integer, primary_key=True, autoincrement=True)
    site_id = db.Column(db.String(50), db.ForeignKey("sites.id"), unique=True, nullable=False)
    name    = db.Column(db.String(100), nullable=False)   # ej: RTR-MSOTOL01-01
    brand   = db.Column(db.String(20),  nullable=False)   # cisco | juniper | cirion

    site       = db.relationship("Site", back_populates="router")
    interfaces = db.relationship("RouterInterface", back_populates="router",
                                  cascade="all, delete-orphan", order_by="RouterInterface.id")

    def to_dict(self, include_interfaces=False):
        d = {
            "id": self.id,
            "site_id": self.site_id,
            "site_name": self.site.name if self.site else None,
            "name": self.name,
            "brand": self.brand,
        }
        if include_interfaces:
            d["interfaces"] = [i.to_dict() for i in self.interfaces]
        return d


class RouterInterface(db.Model):
    """Interfaz de un ruteador (100 Gbps). Puede conectar a una lambda o a un proveedor ISP."""
    __tablename__ = "router_interfaces"

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    router_id       = db.Column(db.Integer, db.ForeignKey("routers.id"), nullable=False)
    name            = db.Column(db.String(50), nullable=False)   # ej: xe-0/0/0
    iface_type      = db.Column(db.String(20), nullable=False)   # lambda | isp
    capacity_gbps   = db.Column(db.Integer, default=100)
    # Para interfaces conectadas a una lambda:
    lambda_id       = db.Column(db.Integer, db.ForeignKey("lambdas.id"), nullable=True)
    # Métrica ISIS (solo en interfaces lambda de routers Cisco/Juniper, default 10)
    isis_metric     = db.Column(db.Integer, default=10, nullable=True)
    # Para interfaces conectadas a un proveedor ISP:
    isp_provider_id = db.Column(db.Integer, db.ForeignKey("isp_providers.id"), nullable=True)

    router       = db.relationship("Router", back_populates="interfaces")
    lambda_      = db.relationship("Lambda")
    isp_provider = db.relationship("ISPProvider", back_populates="interfaces")

    def to_dict(self):
        return {
            "id": self.id,
            "router_id": self.router_id,
            "name": self.name,
            "iface_type": self.iface_type,
            "capacity_gbps": self.capacity_gbps,
            "lambda_id": self.lambda_id,
            "lambda_name": self.lambda_.name if self.lambda_ else None,
            "isis_metric": self.isis_metric,
            "isp_provider_id": self.isp_provider_id,
            "isp_provider_name": self.isp_provider.name if self.isp_provider else None,
            "isp_provider_color": self.isp_provider.color if self.isp_provider else None,
        }


class TrafficFlow(db.Model):
    """Flujo de tráfico de bajada entre un proveedor ISP (ingress) y un sitio MSO (egress).
    traffic_gbps almacena Gbps reales (puede ser no múltiplo de 100).
    pgw identifica el gateway que consume el tráfico (PGW1 / PGW2), opcional.
    """
    __tablename__ = "traffic_flows"

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    isp_provider_id = db.Column(db.Integer, db.ForeignKey("isp_providers.id"), nullable=False)
    ingress_site_id = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    egress_site_id  = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    pgw             = db.Column(db.String(10), nullable=True)   # "PGW1" | "PGW2" | None
    traffic_gbps    = db.Column(db.Integer, default=0)          # Gbps reales
    # Lambdas que transportan este flujo (CSV de nombres, para flujos multi-hop)
    lambda_names    = db.Column(db.String(500), nullable=True)

    isp_provider = db.relationship("ISPProvider", back_populates="traffic_flows")
    ingress_site = db.relationship("Site", foreign_keys=[ingress_site_id])
    egress_site  = db.relationship("Site", foreign_keys=[egress_site_id])

    def to_dict(self):
        return {
            "id": self.id,
            "isp_provider_id": self.isp_provider_id,
            "isp_provider_name": self.isp_provider.name if self.isp_provider else None,
            "isp_provider_color": self.isp_provider.color if self.isp_provider else None,
            "ingress_site_id": self.ingress_site_id,
            "ingress_site_name": self.ingress_site.name if self.ingress_site else None,
            "egress_site_id": self.egress_site_id,
            "egress_site_name": self.egress_site.name if self.egress_site else None,
            "pgw": self.pgw,
            "traffic_gbps": self.traffic_gbps,
            "lambda_names": self.lambda_names,
        }


class ISPPriority(db.Model):
    """Prioridad de un proveedor ISP para un PGW en un sitio MSO.
    Modela la redundancia BGP: priority_level 1=primario, 2=secundario, 3=terciario.
    """
    __tablename__ = "isp_priorities"
    __table_args__ = (
        db.UniqueConstraint(
            "egress_site_id", "pgw", "isp_provider_id", "ingress_site_id",
            name="uq_isp_priority"
        ),
    )

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    egress_site_id  = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    pgw             = db.Column(db.String(10), nullable=False)   # "PGW1" | "PGW2"
    isp_provider_id = db.Column(db.Integer, db.ForeignKey("isp_providers.id"), nullable=False)
    ingress_site_id = db.Column(db.String(50), db.ForeignKey("sites.id"), nullable=False)
    priority_level  = db.Column(db.Integer, nullable=False)       # 1=primario, 2=secundario, 3=terciario

    egress_site  = db.relationship("Site", foreign_keys=[egress_site_id])
    ingress_site = db.relationship("Site", foreign_keys=[ingress_site_id])
    isp_provider = db.relationship("ISPProvider")

    def to_dict(self):
        return {
            "id": self.id,
            "egress_site_id":    self.egress_site_id,
            "egress_site_name":  self.egress_site.name  if self.egress_site  else None,
            "pgw":               self.pgw,
            "isp_provider_id":   self.isp_provider_id,
            "isp_provider_name": self.isp_provider.name  if self.isp_provider else None,
            "isp_provider_color":self.isp_provider.color if self.isp_provider else None,
            "ingress_site_id":   self.ingress_site_id,
            "ingress_site_name": self.ingress_site.name  if self.ingress_site  else None,
            "priority_level":    self.priority_level,
        }
