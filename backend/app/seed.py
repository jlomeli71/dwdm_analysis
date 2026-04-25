"""
Seed data — Carga inicial de sitios y lambdas del Red ISP Tx.
Datos extraídos directamente del CLAUDE.md.
"""
from .extensions import db
from .models import Site, Lambda, Segment, LambdaSegment, ISPProvider, Router, RouterInterface, TrafficFlow, ISPPriority


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

    "KIO-QRO":        {"name": "KIO Querétaro",          "type": "third_party", "region": "Bajío",    "city": "Querétaro",       "lat": 20.6800, "lon": -100.4500},  # NW del clúster QRO
    "CIRION-ZURICH":  {"name": "Cirion Zurich",          "type": "third_party", "region": "Centro",   "city": "Ciudad de México","lat": 19.3800, "lon": -99.1800},  # S, separado de MSOMEX04
    "CIRION-MIRLO":   {"name": "Cirion Mirlo",           "type": "third_party", "region": "Occidente","city": "Guadalajara",     "lat": 20.6300, "lon": -103.5800},  # W del clúster GDL
    "CIRION-HUMBOLDT":{"name": "Cirion Humboldt",        "type": "third_party", "region": "Norte",    "city": "Monterrey",       "lat": 26.70, "lon": -101.60},  # cuadrícula MTY fila-1 col-W

    # ─── Sitios nuevos ────────────────────────────────────────────────────────

    "MSOMEX05": {"name": "MSO Tultitlan KIO", "type": "third_party", "region": "Centro",  "city": "Ciudad de México", "lat": 16.912386, "lon": -100.092827},
    "MSOMER01": {"name": "MSO Merida",        "type": "own",         "region": "Sureste", "city": "Mérida",           "lat": 20.9071169,"lon": -89.712532},
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
    """Carga los datos iniciales en la base de datos (solo se invoca cuando la BD es nueva)."""
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
    seed_isp_data()


def seed_isp_data():
    """Carga ruteadores, proveedores ISP, interfaces y flujos de tráfico."""
    if Router.query.count() > 0:
        print("[Seed ISP] Datos ISP ya existentes — seed omitido.")
        return

    print("[Seed ISP] Insertando proveedores ISP...")

    # ── Proveedores ISP ───────────────────────────────────────────────────────
    ISP_PROVIDERS = [
        {"name": "Arelion",   "color": "#F97316"},
        {"name": "Gold Data", "color": "#EAB308"},
        {"name": "Cirion",    "color": "#8B5CF6"},
        {"name": "Meta",      "color": "#3B82F6"},
        {"name": "Amazon",    "color": "#F59E0B"},
        {"name": "Akamai",    "color": "#10B981"},
        {"name": "Axtel",     "color": "#C2410C"},
    ]
    providers = {}
    for p in ISP_PROVIDERS:
        obj = ISPProvider(name=p["name"], color=p["color"])
        db.session.add(obj)
        db.session.flush()
        providers[p["name"]] = obj

    print("[Seed ISP] Insertando ruteadores e interfaces...")

    # ── Ruteadores (11 sitios) ────────────────────────────────────────────────
    ROUTERS_DEF = [
        {"site_id": "MSOTOL01",        "name": "RTR-MSOTOL01-01",    "brand": "cisco"},
        {"site_id": "MSOMEX01",        "name": "RTR-MSOMEX01-01",    "brand": "cisco"},
        {"site_id": "MSOMTY01",        "name": "RTR-MSOMTY01-01",    "brand": "cisco"},
        {"site_id": "MSOGDL01",        "name": "RTR-MSOGDL01-01",    "brand": "cisco"},
        {"site_id": "MSOJRZ01",        "name": "RTR-MSOJRZ01-01",    "brand": "juniper"},
        {"site_id": "NFO-038",         "name": "RTR-NFO038-01",      "brand": "juniper"},
        {"site_id": "TAMREY1273",      "name": "RTR-TAMREY1273-01",  "brand": "juniper"},
        {"site_id": "KIO-QRO",         "name": "RTR-KIOQRO-01",      "brand": "juniper"},
        {"site_id": "CIRION-HUMBOLDT", "name": "RTR-CIRION-HUM-01",  "brand": "cirion"},
        {"site_id": "CIRION-MIRLO",    "name": "RTR-CIRION-MIR-01",  "brand": "cirion"},
        {"site_id": "CIRION-ZURICH",   "name": "RTR-CIRION-ZUR-01",  "brand": "cirion"},
        {"site_id": "MSOMEX05",        "name": "RTR-MSOMEX05-01",    "brand": "cirion"},
        {"site_id": "MSOMER01",        "name": "RTR-MSOMER01-01",    "brand": "axtel"},
    ]

    # Prefijos de nombres de interfaces por brand
    LAMBDA_IFACE = {"cisco": "HundredGigE0/0/", "juniper": "xe-0/0/", "cirion": "et-0/0/", "axtel": "et-1/0/"}
    ISP_IFACE    = {"cisco": "HundredGigE0/1/", "juniper": "xe-1/0/", "cirion": "et-0/0/", "axtel": "et-1/0/"}

    # Correspondencia lambda → sitios con router (ingress_site_id, egress_site_id)
    LAMBDA_ROUTER_MAP = [
        ("Apodaca to Megacentro",              "MSOMTY01",      "MSOMEX01"),
        ("Cd Juarez to Apodaca",               "MSOJRZ01",      "MSOMTY01"),
        ("Cd Juarez to Megacentro",            "MSOJRZ01",      "MSOMEX01"),
        ("Cd Juarez to Tlaquepaque",           "MSOJRZ01",      "MSOGDL01"),
        ("Cd Juarez to Toluca",                "MSOJRZ01",      "MSOTOL01"),
        ("Cirion Humboldt to Apodaca Plano 1", "CIRION-HUMBOLDT", "MSOMTY01"),
        ("Cirion Humboldt to Apodaca Plano 2", "CIRION-HUMBOLDT", "MSOMTY01"),
        ("Cirion Mirlo to Tlaquepaque Plano 1","CIRION-MIRLO",  "MSOGDL01"),
        ("Cirion Zurich to Megacentro",        "CIRION-ZURICH", "MSOMEX01"),
        ("Cirion Zurich to Toluca",            "CIRION-ZURICH", "MSOTOL01"),
        ("KIO Networks Qro to Megacentro Plano 1", "KIO-QRO",   "MSOMEX01"),
        ("KIO Networks Qro to Megacentro Plano 2", "KIO-QRO",   "MSOMEX01"),
        ("Laredo to Apodaca",                  "NFO-038",       "MSOMTY01"),
        ("Laredo to Megacentro",               "NFO-038",       "MSOMEX01"),
        ("Laredo to Tlaquepaque",              "NFO-038",       "MSOGDL01"),
        ("Laredo to Toluca",                   "NFO-038",       "MSOTOL01"),
        ("Megacentro to Toluca",               "MSOMEX01",      "MSOTOL01"),
        ("Reynosa to Apodaca",                 "TAMREY1273",    "MSOMTY01"),
        ("Reynosa to Megacentro",              "TAMREY1273",    "MSOMEX01"),
        ("Reynosa to Tlaquepaque",             "TAMREY1273",    "MSOGDL01"),
        ("Reynosa to Toluca",                  "TAMREY1273",    "MSOTOL01"),
        ("Tlaquepaque to Apodaca",             "MSOGDL01",      "MSOMTY01"),
        ("Toluca to Tlaquepaque",              "MSOTOL01",      "MSOGDL01"),
    ]

    # ISP connections per site
    ISP_CONNECTIONS = [
        {"site_id": "MSOJRZ01",        "provider": "Arelion",   "count": 3},
        {"site_id": "NFO-038",         "provider": "Gold Data", "count": 2},
        {"site_id": "TAMREY1273",      "provider": "Gold Data", "count": 2},
        {"site_id": "KIO-QRO",         "provider": "Meta",      "count": 2},
        {"site_id": "KIO-QRO",         "provider": "Amazon",    "count": 2},
        {"site_id": "KIO-QRO",         "provider": "Akamai",    "count": 2},
        {"site_id": "CIRION-HUMBOLDT", "provider": "Cirion",    "count": 2},  # 1 por lambda
        {"site_id": "CIRION-MIRLO",    "provider": "Cirion",    "count": 1},
        {"site_id": "CIRION-ZURICH",   "provider": "Cirion",    "count": 2},
        {"site_id": "MSOMEX05",        "provider": "Cirion",    "count": 1},
        {"site_id": "MSOMER01",        "provider": "Axtel",     "count": 1},
    ]

    # Construir lookup: site_id → lambdas que terminan en ese sitio
    lambda_by_site: dict[str, list] = {}
    for lname, ingress, egress in LAMBDA_ROUTER_MAP:
        lam = Lambda.query.filter_by(name=lname).first()
        if lam:
            lambda_by_site.setdefault(ingress, []).append(lam)
            lambda_by_site.setdefault(egress, []).append(lam)

    routers = {}
    for rd in ROUTERS_DEF:
        rtr = Router(site_id=rd["site_id"], name=rd["name"], brand=rd["brand"])
        db.session.add(rtr)
        db.session.flush()
        routers[rd["site_id"]] = rtr

        # Crear interfaces lambda para este ruteador
        # isis_metric solo aplica a routers propios (Cisco/Juniper), no a Cirion
        lam_prefix  = LAMBDA_IFACE[rd["brand"]]
        isis_metric = 10 if rd["brand"] in ("cisco", "juniper") else None
        for idx, lam in enumerate(lambda_by_site.get(rd["site_id"], [])):
            iface = RouterInterface(
                router_id=rtr.id,
                name=f"{lam_prefix}{idx}",
                iface_type="lambda",
                capacity_gbps=100,
                lambda_id=lam.id,
                isis_metric=isis_metric,
            )
            db.session.add(iface)

    # Crear interfaces ISP
    isp_prefix_idx: dict[str, int] = {}  # site_id → next ISP interface index
    for conn in ISP_CONNECTIONS:
        site_id  = conn["site_id"]
        provider = providers[conn["provider"]]
        rtr      = routers[site_id]
        isp_pfx  = ISP_IFACE[rtr.brand]
        start    = isp_prefix_idx.get(site_id, 0)
        for i in range(conn["count"]):
            iface = RouterInterface(
                router_id=rtr.id,
                name=f"{isp_pfx}{start + i}",
                iface_type="isp",
                capacity_gbps=100,
                isp_provider_id=provider.id,
            )
            db.session.add(iface)
        isp_prefix_idx[site_id] = start + conn["count"]

    db.session.flush()
    print("[Seed ISP] Insertando flujos de tráfico...")

    # ── Flujos de tráfico con PGW y Gbps reales (de traffic_flows_isp.csv) ───
    # Formato: provider, ingress (sitio donde conecta el ISP), egress (MSO donde está el PGW),
    #          pgw ("PGW1"/"PGW2"), gbps (Gbps reales), lambdas (CSV de nombres, o None)
    TRAFFIC_FLOWS = [
        # ── Cd Juárez — Arelion (P3 en PGW1, P2 en PGW2 según prioridades) ──
        {"provider": "Arelion", "ingress": "MSOJRZ01", "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Cd Juarez to Megacentro"},
        {"provider": "Arelion", "ingress": "MSOJRZ01", "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Cd Juarez to Tlaquepaque"},
        {"provider": "Arelion", "ingress": "MSOJRZ01", "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Cd Juarez to Toluca"},
        # ── Apodaca (MSOMTY01) ───────────────────────────────────────────────
        {"provider": "Cirion",    "ingress": "CIRION-HUMBOLDT", "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 30,
         "lambdas": "Cirion Humboldt to Apodaca Plano 1,Cirion Humboldt to Apodaca Plano 2"},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Reynosa to Apodaca"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Laredo to Apodaca"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 30,
         "lambdas": "Laredo to Apodaca"},
        {"provider": "Arelion",   "ingress": "MSOJRZ01",        "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cd Juarez to Apodaca"},
        {"provider": "Cirion",    "ingress": "CIRION-HUMBOLDT", "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cirion Humboldt to Apodaca Plano 1"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMTY01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Apodaca to Megacentro"},
        # ── Megacentro (MSOMEX01) ────────────────────────────────────────────
        {"provider": "Cirion",    "ingress": "CIRION-ZURICH",   "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 30,
         "lambdas": "Cirion Zurich to Megacentro"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Laredo to Megacentro"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 30,
         "lambdas": "Laredo to Megacentro"},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Reynosa to Megacentro"},
        {"provider": "Cirion",    "ingress": "CIRION-ZURICH",   "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cirion Zurich to Megacentro"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMEX01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,KIO Networks Qro to Megacentro Plano 2"},
        # ── Toluca (MSOTOL01) ────────────────────────────────────────────────
        {"provider": "Cirion",    "ingress": "CIRION-ZURICH",   "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 30,
         "lambdas": "Cirion Zurich to Toluca"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Laredo to Toluca"},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 30,
         "lambdas": "Reynosa to Toluca"},
        {"provider": "Arelion",   "ingress": "MSOJRZ01",        "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cd Juarez to Toluca"},
        {"provider": "Cirion",    "ingress": "CIRION-ZURICH",   "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cirion Zurich to Toluca"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOTOL01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca"},
        # ── Tlaquepaque (MSOGDL01) ───────────────────────────────────────────
        {"provider": "Cirion",    "ingress": "CIRION-MIRLO",    "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 30,
         "lambdas": "Cirion Mirlo to Tlaquepaque Plano 1"},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Reynosa to Tlaquepaque"},
        {"provider": "Cirion",    "ingress": "CIRION-MIRLO",    "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 3,
         "lambdas": "Cirion Mirlo to Tlaquepaque Plano 1"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 30,
         "lambdas": "Laredo to Tlaquepaque"},
        {"provider": "Arelion",   "ingress": "MSOJRZ01",        "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cd Juarez to Tlaquepaque"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 2,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW1", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOGDL01", "pgw": "PGW2", "gbps": 1,
         "lambdas": "KIO Networks Qro to Megacentro Plano 1,Megacentro to Toluca,Toluca to Tlaquepaque"},
        # ── Tultitlan KIO (MSOMEX05) ─────────────────────────────────────────
        # Cirion conecta directamente en el sitio; sin lambda DWDM al MSO
        {"provider": "Cirion",    "ingress": "MSOMEX05",        "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 30,
         "lambdas": None},
        {"provider": "Arelion",   "ingress": "MSOJRZ01",        "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Cd Juarez to Megacentro"},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Laredo to Megacentro"},
        {"provider": "Cirion",    "ingress": "MSOMEX05",        "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 0,
         "lambdas": None},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 30,
         "lambdas": None},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Laredo to Megacentro"},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 2,
         "lambdas": None},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 2,
         "lambdas": None},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 1,
         "lambdas": None},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 1,
         "lambdas": None},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW1", "gbps": 1,
         "lambdas": None},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMEX05", "pgw": "PGW2", "gbps": 1,
         "lambdas": None},
        # ── Merida (MSOMER01) ────────────────────────────────────────────────
        # Axtel conecta directamente en el sitio; sin lambda DWDM al MSO
        {"provider": "Axtel",     "ingress": "MSOMER01",        "egress": "MSOMER01", "pgw": "PGW1", "gbps": 30,
         "lambdas": None},
        {"provider": "Gold Data", "ingress": "NFO-038",         "egress": "MSOMER01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Laredo to Megacentro"},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOMER01", "pgw": "PGW1", "gbps": 0,
         "lambdas": "Reynosa to Megacentro"},
        {"provider": "Arelion",   "ingress": "MSOJRZ01",        "egress": "MSOMER01", "pgw": "PGW2", "gbps": 0,
         "lambdas": "Cd Juarez to Megacentro"},
        {"provider": "Axtel",     "ingress": "MSOMER01",        "egress": "MSOMER01", "pgw": "PGW2", "gbps": 0,
         "lambdas": None},
        {"provider": "Gold Data", "ingress": "TAMREY1273",      "egress": "MSOMER01", "pgw": "PGW2", "gbps": 30,
         "lambdas": None},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW1", "gbps": 2,
         "lambdas": None},
        {"provider": "Meta",      "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW2", "gbps": 2,
         "lambdas": None},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW1", "gbps": 1,
         "lambdas": None},
        {"provider": "Amazon",    "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW2", "gbps": 1,
         "lambdas": None},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW1", "gbps": 1,
         "lambdas": None},
        {"provider": "Akamai",    "ingress": "KIO-QRO",         "egress": "MSOMER01", "pgw": "PGW2", "gbps": 1,
         "lambdas": None},
    ]

    for tf in TRAFFIC_FLOWS:
        flow = TrafficFlow(
            isp_provider_id=providers[tf["provider"]].id,
            ingress_site_id=tf["ingress"],
            egress_site_id=tf["egress"],
            pgw=tf["pgw"],
            traffic_gbps=tf["gbps"],
            lambda_names=tf["lambdas"],
        )
        db.session.add(flow)

    db.session.commit()
    print(f"[Seed ISP] Completado: {Router.query.count()} ruteadores, "
          f"{RouterInterface.query.count()} interfaces, "
          f"{TrafficFlow.query.count()} flujos de tráfico.")
    seed_priorities()


def seed_priorities():
    """Carga las prioridades ISP por PGW desde prioridades_isp.csv."""
    if ISPPriority.query.count() > 0:
        print("[Seed Priorities] Prioridades ya existentes — seed omitido.")
        return

    print("[Seed Priorities] Insertando prioridades ISP...")

    # Lookup de providers por nombre
    prov_map = {p.name: p for p in ISPProvider.query.all()}

    # Datos de prioridades (de prioridades_isp.csv)
    # egress: MSO donde está el PGW | pgw: PGW1/PGW2 | provider: ISP | ingress: sitio de conexión | level: 1/2/3
    ISP_PRIORITIES = [
        # ── Apodaca (MSOMTY01) ───────────────────────────────────────────────
        {"egress": "MSOMTY01", "pgw": "PGW1", "provider": "Cirion",    "ingress": "CIRION-HUMBOLDT", "level": 1},
        {"egress": "MSOMTY01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 2},
        {"egress": "MSOMTY01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "NFO-038",         "level": 3},
        {"egress": "MSOMTY01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "NFO-038",         "level": 1},
        {"egress": "MSOMTY01", "pgw": "PGW2", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 2},
        {"egress": "MSOMTY01", "pgw": "PGW2", "provider": "Cirion",    "ingress": "CIRION-HUMBOLDT", "level": 3},
        # ── Megacentro (MSOMEX01) ────────────────────────────────────────────
        {"egress": "MSOMEX01", "pgw": "PGW1", "provider": "Cirion",    "ingress": "CIRION-ZURICH",   "level": 1},
        {"egress": "MSOMEX01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "NFO-038",         "level": 2},
        {"egress": "MSOMEX01", "pgw": "PGW1", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 3},
        {"egress": "MSOMEX01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "NFO-038",         "level": 1},
        {"egress": "MSOMEX01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 2},
        {"egress": "MSOMEX01", "pgw": "PGW2", "provider": "Cirion",    "ingress": "CIRION-ZURICH",   "level": 3},
        # ── Toluca (MSOTOL01) ────────────────────────────────────────────────
        {"egress": "MSOTOL01", "pgw": "PGW1", "provider": "Cirion",    "ingress": "CIRION-ZURICH",   "level": 1},
        {"egress": "MSOTOL01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "NFO-038",         "level": 2},
        {"egress": "MSOTOL01", "pgw": "PGW1", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 3},
        {"egress": "MSOTOL01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 1},
        {"egress": "MSOTOL01", "pgw": "PGW2", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 2},
        {"egress": "MSOTOL01", "pgw": "PGW2", "provider": "Cirion",    "ingress": "CIRION-ZURICH",   "level": 3},
        # ── Tlaquepaque (MSOGDL01) ───────────────────────────────────────────
        {"egress": "MSOGDL01", "pgw": "PGW1", "provider": "Cirion",    "ingress": "CIRION-MIRLO",    "level": 1},
        {"egress": "MSOGDL01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 2},
        {"egress": "MSOGDL01", "pgw": "PGW1", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 3},
        {"egress": "MSOGDL01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "NFO-038",         "level": 1},
        {"egress": "MSOGDL01", "pgw": "PGW2", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 2},
        {"egress": "MSOGDL01", "pgw": "PGW2", "provider": "Cirion",    "ingress": "CIRION-MIRLO",    "level": 3},
        # ── Tultitlan KIO (MSOMEX05) ─────────────────────────────────────────
        {"egress": "MSOMEX05", "pgw": "PGW1", "provider": "Cirion",    "ingress": "MSOMEX05",        "level": 1},
        {"egress": "MSOMEX05", "pgw": "PGW1", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 2},
        {"egress": "MSOMEX05", "pgw": "PGW1", "provider": "Gold Data", "ingress": "NFO-038",         "level": 3},
        {"egress": "MSOMEX05", "pgw": "PGW2", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 1},
        {"egress": "MSOMEX05", "pgw": "PGW2", "provider": "Gold Data", "ingress": "NFO-038",         "level": 2},
        {"egress": "MSOMEX05", "pgw": "PGW2", "provider": "Cirion",    "ingress": "MSOMEX05",        "level": 3},
        # ── Merida (MSOMER01) ────────────────────────────────────────────────
        {"egress": "MSOMER01", "pgw": "PGW1", "provider": "Axtel",     "ingress": "MSOMER01",        "level": 1},
        {"egress": "MSOMER01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "NFO-038",         "level": 2},
        {"egress": "MSOMER01", "pgw": "PGW1", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 3},
        {"egress": "MSOMER01", "pgw": "PGW2", "provider": "Gold Data", "ingress": "TAMREY1273",      "level": 1},
        {"egress": "MSOMER01", "pgw": "PGW2", "provider": "Arelion",   "ingress": "MSOJRZ01",        "level": 2},
        {"egress": "MSOMER01", "pgw": "PGW2", "provider": "Axtel",     "ingress": "MSOMER01",        "level": 3},
    ]

    for p in ISP_PRIORITIES:
        prov = prov_map.get(p["provider"])
        if not prov:
            print(f"  [WARN] Proveedor '{p['provider']}' no encontrado — omitido.")
            continue
        priority = ISPPriority(
            egress_site_id=p["egress"],
            pgw=p["pgw"],
            isp_provider_id=prov.id,
            ingress_site_id=p["ingress"],
            priority_level=p["level"],
        )
        db.session.add(priority)

    db.session.commit()
    print(f"[Seed Priorities] Completado: {ISPPriority.query.count()} prioridades ISP.")
