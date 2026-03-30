"""Configuración de la aplicación Flask."""
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Config:
    # Base de datos SQLite en desarrollo
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'dwdm.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Documentación OpenAPI
    API_TITLE = "DWDM Topology API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/"
    OPENAPI_SWAGGER_UI_PATH = "/swagger-ui"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"

    # Seguridad básica
    SECRET_KEY = os.environ.get("SECRET_KEY", "dwdm-dev-secret-key-change-in-prod")
