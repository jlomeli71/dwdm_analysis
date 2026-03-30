"""Flask application factory."""
from flask import Flask
from .config import Config
from .extensions import db, cors
from .api import register_blueprints


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Inicializar extensiones
    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Registrar blueprints
    register_blueprints(app)

    # Crear tablas y cargar seed data
    with app.app_context():
        db.create_all()
        from .seed import seed_database
        seed_database()

    @app.get("/")
    def health():
        return {"status": "ok", "app": "DWDM Topology API", "version": "1.0"}

    return app
