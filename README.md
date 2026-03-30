# DWDM Topology — Proyecto Philadelphia

Aplicación web full-stack para visualizar, gestionar y analizar la topología de red DWDM de un ISP en México.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11+, Flask 3, SQLAlchemy, SQLite |
| Frontend | HTML5, JavaScript ES Modules, D3.js v7, Chart.js v4 |
| API | REST + CORS |
| Reportes | ReportLab (PDF), openpyxl (Excel), CSV nativo |

## Arrancar la aplicación

### Backend (Flask — Puerto 5000)

```bash
cd backend
# Activar entorno virtual (ya creado)
./venv/Scripts/activate        # Windows
# source venv/bin/activate     # Linux/Mac

# La BD se crea y popula automáticamente al arrancar
python run.py
```

El backend arranca en `http://localhost:5000`.
La base de datos SQLite (`dwdm.db`) se crea con los 30 sitios y 22 lambdas del Proyecto Philadelphia.

### Frontend (Servidor HTTP — Puerto 8080)

```bash
cd frontend
python -m http.server 8080
```

Abrir en el navegador: **http://localhost:8080**

> Los módulos ES (`type="module"`) requieren servirse via HTTP, no como `file://`.

---

## Datos de la red

| Entidad | Cantidad |
|---|---|
| Sitios propios (MSO + NFO) | 26 |
| Sitios de terceros (Cirion, KIO) | 4 |
| Lambdas (circuitos ópticos) | 22 |
| Segmentos físicos únicos | ~45 |
| Capacidad total | 2.2 Tbps |
| Proveedores de fibra | AT&T, Bestel, Marcatel, Maxcom, Cirion, QUATTROCOM |

## API Endpoints

```
GET    /api/v1/sites                     Lista todos los sitios
POST   /api/v1/sites                     Crear sitio
PUT    /api/v1/sites/{site_id}           Actualizar sitio
DELETE /api/v1/sites/{site_id}           Eliminar (valida segmentos activos → 409)

GET    /api/v1/lambdas                   Lista lambdas con segmentos
POST   /api/v1/lambdas                   Crear lambda
PUT    /api/v1/lambdas/{id}              Actualizar lambda
DELETE /api/v1/lambdas/{id}              Eliminar lambda

GET    /api/v1/segments                  Lista segmentos con métricas de uso
GET    /api/v1/segments/{id}/lambdas     Lambdas que usan un segmento

POST   /api/v1/simulation                Simular falla (1-2 segmentos)
POST   /api/v1/simulation/provider       Simular falla por proveedor

GET    /api/v1/dashboard/kpis            KPIs generales
GET    /api/v1/dashboard/heatmap         Datos de calor por segmento
GET    /api/v1/dashboard/segments        Uso por segmento (para gráficas)
GET    /api/v1/dashboard/providers       Distribución por proveedor

GET    /api/v1/reports/general.pdf       Reporte PDF (A4 horizontal)
GET    /api/v1/reports/general.xlsx      Reporte Excel (3 hojas)
GET    /api/v1/reports/sites.csv         CSV de sitios
GET    /api/v1/reports/lambdas.csv       CSV de lambdas
GET    /api/v1/reports/segments.csv      CSV de segmentos
```

## Módulos del Frontend

| Módulo | Descripción |
|---|---|
| **Topología** | Grafo lógico D3 force-directed y mapa geográfico de México. Líneas paralelas por lambda en segmentos compartidos. Selección múltiple de lambdas. Hover en nodos/enlaces/lambdas individuales. Toggle ID/nombre |
| **Sitios & Lambdas** | CRUD completo con modales. Validación de coordenadas, unicidad de color hex |
| **Dashboard** | KPIs, barras de uso por segmento, donut de proveedores, tabla con alertas al 80% |
| **Simulación** | Falla de 1-2 segmentos o por proveedor. Análisis de protección 1+1. Lambdas caídas vs protegidas |
| **Reportes** | Descarga en PDF, Excel y CSV |

## Funcionalidades de Topología

### Grafo Lógico (D3 force-directed)
- Cada **lambda se dibuja como su propia línea coloreada** en cada segmento que utiliza
- Cuando varias lambdas comparten un segmento, sus líneas se muestran **paralelas con separación perpendicular** (4 px entre líneas) — los segmentos más saturados se ven como un haz de colores
- Hover sobre una línea individual → tooltip con nombre, capacidad y ruta de protección de esa lambda
- Hover sobre el espacio entre líneas → tooltip del enlace completo (todos los segmentos y lambdas)
- Nodos arrastrables; botón "Centrar" reinicia posiciones

### Mapa Geográfico
- Contorno real del territorio mexicano renderizado con D3 `geoMercator` + GeoJSON de Natural Earth (archivo local `mexico.geojson`, 174 puntos)
- Los 30 sitios se posicionan en sus coordenadas reales (lat/lon)
- Misma visualización de **líneas paralelas por lambda** que el grafo lógico
- Sitios sin coordenadas aparecen en panel lateral "Sin ubicar"
- Zoom y pan con scroll/drag; botón "Centrar México"

### Selección múltiple de lambdas
- Clic en cualquier lambda del panel lateral la **agrega o quita** de la selección (sin límite)
- Las lambdas seleccionadas se resaltan (grosor 3.5 px, opacidad 100%)
- Las no seleccionadas se atenúan (opacidad 5%)
- El título del panel muestra "X seleccionada(s)"
- Botón **✕ Quitar selección** limpia toda la selección
- Funciona igual en Grafo Lógico y en Mapa Geográfico

## Reglas de negocio clave

- **Eliminación de sitio**: Error 409 si tiene segmentos activos (devuelve lista de lambdas afectadas)
- **Color único**: Cada lambda debe tener un color hex distinto
- **Segmentos canónicos**: `site_a_id < site_b_id` alfabéticamente (previene duplicados lógicos)
- **Capacidad máxima**: 96 lambdas por fibra. Alerta en dashboard si segmento ≥ 77 (80%)
- **Fibras independientes**: `ruta_1` y `ruta_2` entre mismos sitios son físicamente distintas
- **Protección 1+1**: `protection_route_name` referencia la lambda de respaldo; la simulación detecta pérdida total si ambas rutas fallan
- **Simulación es solo lectura**: No modifica la BD

## Estructura del proyecto

```
dwdm_analysis/
├── backend/
│   ├── run.py                   # Punto de entrada Flask
│   ├── requirements.txt
│   ├── dwdm.db                  # SQLite (auto-creada)
│   └── app/
│       ├── __init__.py          # App factory
│       ├── config.py
│       ├── extensions.py
│       ├── models.py            # Site, Lambda, Segment, LambdaSegment
│       ├── seed.py              # 30 sitios + 22 lambdas con coordenadas reales
│       └── api/
│           ├── sites.py
│           ├── lambdas.py
│           ├── segments.py
│           ├── dashboard.py
│           ├── simulation.py
│           └── reports.py
└── frontend/
    ├── index.html               # SPA con routing por hash, nav horizontal
    ├── styles.css               # Dark theme design system
    ├── api.js                   # Cliente API (fetch)
    ├── mexico.geojson           # Contorno de México (Natural Earth, 174 puntos)
    ├── topology.js              # D3 grafo lógico + mapa geográfico + líneas paralelas
    ├── crud.js                  # Gestión de sitios y lambdas
    ├── dashboard.js             # KPIs + Chart.js
    ├── simulation.js            # Simulador de fallas
    └── reports.js               # Descarga de reportes
```
