"""Flask application factory."""
import os
from flask import Flask
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
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

    # Inicializar Flask-Admin (explorador de BD)
    admin = Admin(app, name="DWDM — Admin BD", template_mode="bootstrap4")

    # Crear tablas y cargar seed data solo si la BD no existe
    with app.app_context():
        from .models import Site, Lambda, Segment, LambdaSegment

        # Registrar modelos en el panel admin
        admin.add_view(ModelView(Site, db.session, name="Sitios"))
        admin.add_view(ModelView(Lambda, db.session, name="Lambdas"))
        admin.add_view(ModelView(Segment, db.session, name="Segmentos"))
        admin.add_view(ModelView(LambdaSegment, db.session, name="Lambda-Segmento"))

        db_path = app.config["SQLALCHEMY_DATABASE_URI"].replace("sqlite:///", "")
        db_is_new = not os.path.isfile(db_path)

        db.create_all()  # idempotente: crea tablas si no existen

        if db_is_new:
            from .seed import seed_database
            seed_database()
        else:
            print("[Seed] Base de datos existente detectada — seed omitido.")

    @app.get("/")
    def health():
        return {"status": "ok", "app": "DWDM Topology API", "version": "1.0"}

    return app
