"""
Seed data — Carga inicial de sitios y lambdas del Proyecto Philadelphia.
Datos extraídos directamente del CLAUDE.md.
"""
from .extensions import db
from .models import Site, Lambda, Segment, LambdaSegment


# ─── Catálogo de sitios ───────────────────────────────────────────────────────

SITE_ID_TO_NAME = {

    # ─── Sitios propios — MSO (Main Switch Office) ────────────────────────────
    # Nota: coordenadas ligeramente ajustadas en clústeres urbanos para evitar solapamiento visual en el mapa

    "MSOTOL01": {"name": "MSO Toluca",       "type": "own", "region": "Centro",       "city": "Toluca",               "lat": 19.2926, "lon": -99.6574},
    "MSOMEX01": {"name": "MSO Megacentro",   "type": "own", "region": "Centro",       "city": "Cuautitlán Izcalli",   "lat": 19.6847, "lon": -99.2039},
    "MSOMEX04": {"name": "Ceylan",           "type": "own", "region": "Centro",       "city": "Ciudad de México",     "lat": 19.5200, "lon": -99.0800},  # separado de CIRION-ZURICH
    "MSOMTY01": {"name": "MSO Apodaca",      "type": "own", "region": "Norte",        "city": "Apodaca",              "lat": 26.70, "lon": -100.10},  # cuadrícula MTY fila-1 col-E
    "MSOMTY02": {"name": "Buenos Aires",     "type": "own", "region": "Norte",        "city": "Monterrey",            "lat": 25.50, "lon": -101.60},  # cuadrícula MTY fila-2 col-W
    "MSOMTY03": {"name": "MSO Gonzalitos",   "type": "own", "region": "Norte",        "city": "Monterrey",            "lat": 24.30, "lon": -101.60},  # cuadrícula MTY fila-3 col-W
    "MSOGDL01": {"name": "MSO Tlaquepaque",  "type": "own", "region": "Occidente",    "city": "San Pedro Tlaquepaque","lat": 20.5800, "lon": -103.2800},  # SE del clúster GDL
    "MSOGDL02": {"name": "Canadá",           "type": "own", "region": "Occidente",    "city": "Guadalajara",          "lat": 20.7400, "lon": -103.3800},  # N del clúster GDL
    "MSOPUE01": {"name": "Puebla Calera",    "type": "own", "region": "Centro-Sur",   "city": "Puebla",               "lat": 19.0414, "lon": -98.2063},
    "MSOJRZ01": {"name": "Cd Juárez",        "type": "own", "region": "Norte",        "city": "Ciudad Juárez",        "lat": 31.6904, "lon": -106.4245},

    # ─── Sitios propios — NFO (Nodo de Fibra Óptica) ─────────────────────────

    "NFO-004":    {"name": "Jilotepec",          "type": "own", "region": "Centro",       "city": "Jilotepec",            "lat": 19.9723, "lon": -99.5285},
    "NFO-006":    {"name": "León LD",             "type": "own", "region": "Bajío",        "city": "León",                 "lat": 21.1236, "lon": -101.6824},
    "NFO-009":    {"name": "QRO San Pablo",       "type": "own", "region": "Bajío",        "city": "Querétaro",            "lat": 20.6200, "lon": -100.3300},  # NE del clúster QRO
    "NFO-010":    {"name": "Río Frío",            "type": "own", "region": "Centro",       "city": "Río Frío",             "lat": 19.3167, "lon": -98.7167},
    "NFO-022":    {"name": "Reynosa Marcatel",    "type": "own", "region": "Norte",        "city": "Reynosa",              "lat": 26.1800, "lon": -98.3000},  # N del clúster Reynosa
    "NFO-025":    {"name": "SLP Marcatel",        "type": "own", "region": "Centro-Norte", "city": "San Luis Potosí",      "lat": 22.2500, "lon": -101.0000},  # N del clúster SLP
    "NFO-027":    {"name": "AGS Bestel",          "type": "own", "region": "Centro-Norte", "city": "Aguascalientes",       "lat": 21.8853, "lon": -102.2916},
    "NFO-032":    {"name": "Irapuato Bestel",     "type": "own", "region": "Bajío",        "city": "Irapuato",             "lat": 20.6765, "lon": -101.3500},
    "NFO-038":    {"name": "Nuevo Laredo",        "type": "own", "region": "Norte",        "city": "Nuevo Laredo",         "lat": 27.4781, "lon": -99.5155},
    "NFO-040":    {"name": "QRO Bestel",          "type": "own", "region": "Bajío",        "city": "Querétaro",            "lat": 20.5200, "lon": -100.4800},  # SW del clúster QRO
    "NFO-044":    {"name": "SLP Bestel",          "type": "own", "region": "Centro-Norte", "city": "San Luis Potosí",      "lat": 22.0500, "lon": -100.9700},  # S del clúster SLP
    "NFO-053":    {"name": "Poza Rica Maxcom",    "type": "own", "region": "Golfo",        "city": "Poza Rica",            "lat": 20.5337, "lon": -97.4473},
    "NFO-075":    {"name": "MTY Marcatel",        "type": "own", "region": "Norte",        "city": "Monterrey",            "lat": 24.30, "lon": -100.10},  # cuadrícula MTY fila-3 col-E
    "NFO-076":    {"name": "MTY Transtelco",      "type": "own", "region": "Norte",        "city": "Monterrey",            "lat": 25.50, "lon": -100.10},  # cuadrícula MTY fila-2 col-E
    "NFO-117":    {"name": "Maravatio",           "type": "own", "region": "Bajío",        "city": "Maravatío",            "lat": 19.8978, "lon": -100.4436},
    "TAMREY1273": {"name": "Reynosa Iusatel",     "type": "own", "region": "Norte",        "city": "Reynosa",              "lat": 25.9800, "lon": -98.2200},  # S del clúster Reynosa

    # ─── Sitios de terceros ────────────────────────────────────────────────────

    "KIO-QRO":        {"name": "KIO Networks Querétaro", "type": "third_party", "region": "Bajío",    "city": "Querétaro",       "lat": 20.6800, "lon": -100.4500},  # NW del clúster QRO
    "CIRION-ZURICH":  {"name": "Cirion Zurich",          "type": "third_party", "region": "Centro",   "city": "Ciudad de México","lat": 19.3800, "lon": -99.1800},  # S, separado de MSOMEX04
    "CIRION-MIRLO":   {"name": "Cirion Mirlo",           "type": "third_party", "region": "Occidente","city": "Guadalajara",     "lat": 20.6300, "lon": -103.5800},  # W del clúster GDL
    "CIRION-HUMBOLDT":{"name": "Cirion Humboldt",        "type": "third_party", "region": "Norte",    "city": "Monterrey",       "lat": 26.70, "lon": -101.60},  # cuadrícula MTY fila-1 col-W
}


# ─── Trayectorias de lambdas ──────────────────────────────────────────────────
# fiber_provider: string con uno o varios proveedores separados por coma (ej. "AT&T, Bestel")

LAMBDA_PATHS = [

    # ── ORIGEN: NUEVO LAREDO ──────────────────────────────────────────────────

    {
        "name": "Laredo to Toluca", "color": "#FF69B4", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-038", "NFO-076"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("NFO-076", "NFO-075"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-075", "NFO-025"), "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-025", "NFO-009"), "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-009", "NFO-004"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("NFO-004", "MSOTOL01"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
        ],
    },
    {
        "name": "Laredo to Apodaca", "color": "#4169E1", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-038", "NFO-076"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("NFO-076", "MSOMTY02"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY02", "MSOMTY01"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Laredo to Megacentro", "color": "#8B4513", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-038", "NFO-076"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("NFO-076", "NFO-075"),  "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-075", "NFO-022"),  "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-022", "NFO-053"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Axtel"},
            {"sites": ("MSOPUE01", "NFO-053"), "fiber": "ruta_1", "fiber_provider": "AT&T, Maxcom"},
            {"sites": ("MSOPUE01", "NFO-010"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "NFO-010"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "MSOMEX01"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Laredo to Tlaquepaque", "color": "#228B22", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-038", "NFO-076"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("NFO-044", "NFO-076"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("NFO-027", "NFO-044"), "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-006", "NFO-027"), "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL02", "NFO-006"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOGDL01", "MSOGDL02"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },

    # ── ORIGEN: REYNOSA ───────────────────────────────────────────────────────

    {
        "name": "Reynosa to Toluca", "color": "#1A1A1A", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-022", "TAMREY1273"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-022", "NFO-053"),    "fiber": "ruta_1", "fiber_provider": "AT&T, Axtel"},
            {"sites": ("MSOPUE01", "NFO-053"),   "fiber": "ruta_1", "fiber_provider": "AT&T, Maxcom"},
            {"sites": ("MSOPUE01", "NFO-010"),   "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "NFO-010"),   "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "MSOTOL01"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
        ],
    },
    {
        "name": "Reynosa to Megacentro", "color": "#87CEEB", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-022", "TAMREY1273"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-022", "NFO-075"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-025", "NFO-075"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-009", "NFO-025"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-004", "NFO-009"),    "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "NFO-004"),   "fiber": "ruta_1", "fiber_provider": "Unknown"},
            {"sites": ("MSOMEX01", "MSOMEX04"),  "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Reynosa to Tlaquepaque", "color": "#DC143C", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-022", "TAMREY1273"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-022", "NFO-075"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-025", "NFO-075"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-009", "NFO-025"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-009", "NFO-040"),    "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-032", "NFO-040"),    "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL02", "NFO-032"),   "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL01", "MSOGDL02"),  "fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Reynosa to Apodaca", "color": "#800080", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("NFO-022", "TAMREY1273"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-022", "NFO-075"),    "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("MSOMTY02", "NFO-075"),   "fiber": "ruta_1", "fiber_provider": "Unknown"},
            {"sites": ("MSOMTY02", "MSOMTY03"),  "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY01", "MSOMTY03"),  "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },

    # ── INTERCONEXIÓN MSO ─────────────────────────────────────────────────────

    {
        "name": "Megacentro to Toluca", "color": "#808080", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOMEX01", "MSOMEX04"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMEX04", "MSOTOL01"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
        ],
    },
    {
        "name": "Toluca to Tlaquepaque", "color": "#008B8B", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOTOL01", "NFO-004"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("NFO-004", "NFO-009"),   "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("NFO-009", "NFO-040"),   "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("NFO-032", "NFO-040"),   "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL02", "NFO-032"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL01", "MSOGDL02"), "fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Tlaquepaque to Apodaca", "color": "#ADFF2F", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOGDL01", "MSOGDL02"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOGDL02", "NFO-006"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("NFO-006", "NFO-027"),   "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-027", "NFO-044"),   "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-044", "NFO-076"),   "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("MSOMTY02", "NFO-076"),  "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY02", "MSOMTY03"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY01", "MSOMTY03"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Apodaca to Megacentro", "color": "#FFD700", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOMTY01", "MSOMTY02"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY02", "NFO-075"),  "fiber": "ruta_1", "fiber_provider": "Unknown"},
            {"sites": ("NFO-022", "NFO-075"),   "fiber": "ruta_1", "fiber_provider": "Marcatel"},
            {"sites": ("NFO-022", "NFO-053"),   "fiber": "ruta_1", "fiber_provider": "AT&T, Axtel"},
            {"sites": ("MSOPUE01", "NFO-053"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Maxcom"},
            {"sites": ("MSOPUE01", "NFO-010"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "NFO-010"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX01", "MSOMEX04"), "fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },

    # ── ORIGEN: CD JUÁREZ ─────────────────────────────────────────────────────

    {
        "name": "Cd Juarez to Apodaca", "color": "#FF8C00", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOJRZ01", "NFO-027"), "fiber": "ruta_1", "fiber_provider": "Axtel"},
            {"sites": ("NFO-027", "NFO-044"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-044", "NFO-076"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("MSOMTY01", "NFO-076"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cd Juarez to Megacentro", "color": "#FF00FF", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOJRZ01", "NFO-027"), "fiber": "ruta_1", "fiber_provider": "Axtel"},
            {"sites": ("NFO-006", "NFO-027"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-006", "NFO-032"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-032", "NFO-040"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOMEX04", "NFO-040"), "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("MSOMEX01", "MSOMEX04"),"fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cd Juarez to Tlaquepaque", "color": "#6B3A2A", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOJRZ01", "NFO-027"), "fiber": "ruta_1", "fiber_provider": "Axtel"},
            {"sites": ("NFO-006", "NFO-027"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("MSOGDL02", "NFO-006"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOGDL01", "MSOGDL02"),"fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cd Juarez to Toluca", "color": "#D2691E", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("MSOJRZ01", "NFO-027"), "fiber": "ruta_1", "fiber_provider": "Axtel"},
            {"sites": ("NFO-006", "NFO-027"),  "fiber": "ruta_1", "fiber_provider": "Bestel"},
            {"sites": ("NFO-006", "NFO-009"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("NFO-004", "NFO-009"),  "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOTOL01", "NFO-004"), "fiber": "ruta_1", "fiber_provider": "Totalplay"},
        ],
    },

    # ── ORIGEN: KIO NETWORKS QUERÉTARO ───────────────────────────────────────

    {
        "name": "KIO Networks Qro to Megacentro Plano 1", "color": "#4B0082",
        "num_lambdas": 1, "capacity_per_lambda": 100,
        "protection_route": "KIO Networks Qro to Megacentro Plano 2",
        "segments": [
            {"sites": ("KIO-QRO", "NFO-040"),   "fiber": "ruta_1", "fiber_provider": "Quattrocom"},
            {"sites": ("MSOMEX04", "NFO-040"),  "fiber": "ruta_1", "fiber_provider": "AT&T, Bestel"},
            {"sites": ("MSOMEX01", "MSOMEX04"), "fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "KIO Networks Qro to Megacentro Plano 2", "color": "#40E0D0",
        "num_lambdas": 1, "capacity_per_lambda": 100,
        "protection_route": "KIO Networks Qro to Megacentro Plano 1",
        "segments": [
            {"sites": ("KIO-QRO", "NFO-009"),   "fiber": "ruta_1", "fiber_provider": "Quattrocom"},
            {"sites": ("NFO-004", "NFO-009"),    "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX04", "NFO-004"),   "fiber": "ruta_1", "fiber_provider": "Totalplay"},
            {"sites": ("MSOMEX01", "MSOMEX04"),  "fiber": "ruta_2", "fiber_provider": "AT&T"},
        ],
    },

    # ── ORIGEN: CIRION ────────────────────────────────────────────────────────

    {
        "name": "Cirion Zurich to Megacentro", "color": "#EE82EE", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": "Cirion Zurich to Toluca",
        "segments": [
            {"sites": ("CIRION-ZURICH", "MSOMEX01"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cirion Zurich to Toluca", "color": "#3CB371", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("CIRION-ZURICH", "MSOMEX01"), "fiber": "ruta_2", "fiber_provider": "AT&T"},
            {"sites": ("MSOMEX01", "NFO-004"),       "fiber": "ruta_1", "fiber_provider": "Unknown"},
            {"sites": ("MSOTOL01", "NFO-004"),       "fiber": "ruta_1", "fiber_provider": "Totalplay"},
        ],
    },
    {
        "name": "Cirion Humboldt to Apodaca Plano 1", "color": "#B22222", "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "Cirion Humboldt to Apodaca Plano 2",
        "segments": [
            {"sites": ("CIRION-HUMBOLDT", "MSOMTY01"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cirion Humboldt to Apodaca Plano 2", "color": "#B87333", "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "Cirion Humboldt to Apodaca Plano 1",
        "segments": [
            {"sites": ("CIRION-HUMBOLDT", "MSOMTY02"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
            {"sites": ("MSOMTY02", "MSOMTY01"),        "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
    {
        "name": "Cirion Mirlo to Tlaquepaque Plano 1", "color": "#FF2400", "num_lambdas": 1,
        "capacity_per_lambda": 100, "protection_route": None,
        "segments": [
            {"sites": ("CIRION-MIRLO", "MSOGDL01"), "fiber": "ruta_1", "fiber_provider": "AT&T"},
        ],
    },
]


def _canonical(site_a: str, site_b: str):
    """Retorna (site_a, site_b) en orden canónico (alfabético)."""
    return (site_a, site_b) if site_a <= site_b else (site_b, site_a)


def seed_database():
    """Carga los datos iniciales en la base de datos si está vacía.
    Las coordenadas (lat/lon) siempre se sincronizan desde SITE_ID_TO_NAME.
    """

    # Sincronizar coordenadas siempre (permite ajustar el mapa sin borrar la BD)
    updated = 0
    for site_id, info in SITE_ID_TO_NAME.items():
        site = db.session.get(Site, site_id)
        if site and (site.lat != info.get("lat") or site.lon != info.get("lon")):
            site.lat = info.get("lat")
            site.lon = info.get("lon")
            updated += 1
    if updated:
        db.session.commit()
        print(f"[Seed] Coordenadas actualizadas para {updated} sitio(s).")

    if Site.query.count() > 0:
        print("[Seed] Base de datos ya tiene datos. Se omite el seeding completo.")
        return

    print("[Seed] Insertando sitios...")

    # Insertar sitios
    for site_id, info in SITE_ID_TO_NAME.items():
        site = Site(
            id=site_id,
            name=info["name"],
            type=info["type"],
            region=info["region"],
            city=info["city"],
            lat=info.get("lat"),
            lon=info.get("lon"),
        )
        db.session.add(site)
    db.session.flush()

    print("[Seed] Insertando lambdas y segmentos...")

    # Caché de segmentos para evitar duplicados
    segment_cache: dict[tuple, Segment] = {}

    def get_or_create_segment(s_a, s_b, fiber, provider) -> Segment:
        key = (*_canonical(s_a, s_b), fiber)
        if key not in segment_cache:
            can_a, can_b = _canonical(s_a, s_b)
            seg = Segment(
                site_a_id=can_a,
                site_b_id=can_b,
                fiber=fiber,
                fiber_provider=provider,
            )
            db.session.add(seg)
            db.session.flush()
            segment_cache[key] = seg
        return segment_cache[key]

    # Insertar lambdas
    for lp in LAMBDA_PATHS:
        lam = Lambda(
            name=lp["name"],
            color=lp["color"],
            num_lambdas=lp["num_lambdas"],
            capacity_per_lambda=lp["capacity_per_lambda"],
            protection_route_name=lp.get("protection_route"),
        )
        db.session.add(lam)
        db.session.flush()

        for idx, seg_data in enumerate(lp["segments"]):
            s_a, s_b = seg_data["sites"]
            seg = get_or_create_segment(s_a, s_b, seg_data["fiber"], seg_data["fiber_provider"])
            ls = LambdaSegment(lambda_id=lam.id, segment_id=seg.id, order_index=idx)
            db.session.add(ls)

    db.session.commit()
    print(f"[Seed] Completado: {Site.query.count()} sitios, "
          f"{Lambda.query.count()} lambdas, "
          f"{Segment.query.count()} segmentos.")
