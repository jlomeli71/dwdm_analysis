"""Init del paquete de API — registra los blueprints."""
from flask import Blueprint

def register_blueprints(app):
    from .sites import bp as sites_bp
    from .lambdas import bp as lambdas_bp
    from .segments import bp as segments_bp
    from .dashboard import bp as dashboard_bp
    from .simulation import bp as simulation_bp
    from .reports import bp as reports_bp
    from .isp import bp as isp_bp

    prefix = "/api/v1"
    app.register_blueprint(sites_bp, url_prefix=prefix)
    app.register_blueprint(lambdas_bp, url_prefix=prefix)
    app.register_blueprint(segments_bp, url_prefix=prefix)
    app.register_blueprint(dashboard_bp, url_prefix=prefix)
    app.register_blueprint(simulation_bp, url_prefix=prefix)
    app.register_blueprint(reports_bp, url_prefix=prefix)
    app.register_blueprint(isp_bp, url_prefix=prefix)
