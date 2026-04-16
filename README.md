# Topología DWDM — Red de Servicios de Internet (ISP)

Aplicación web full-stack para visualizar, gestionar y analizar la topología de red DWDM de un ISP en México. Incluye capa IP/ISP con ruteadores, proveedores de Internet y simulación de fallas.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11+, Flask 3, SQLAlchemy, SQLite |
| Frontend | HTML5, JavaScript ES Modules, D3.js v7, Chart.js v4 |
| API | REST + CORS (flask-cors) |
| Geodatos | `mexico.geojson` local (Natural Earth 110m) — sin CDN |
| Reportes | ReportLab (PDF), openpyxl (Excel), CSV nativo |

## Arrancar la aplicación

### Backend (Flask — Puerto 5001)

```bash
cd backend
./venv/Scripts/activate        # Windows
# source venv/bin/activate     # Linux/Mac

python run.py
```

El backend arranca en `http://localhost:5001`.  
La base de datos SQLite (`dwdm.db`) se crea y puebla automáticamente al arrancar con los 30 sitios, 22+ lambdas y la capa IP/ISP inicial.

### Frontend (Servidor HTTP — Puerto 8080)

```bash
cd frontend
python -m http.server 8080 --bind 127.0.0.1
```

Abrir en el navegador: **http://127.0.0.1:8080**

> Los módulos ES (`type="module"`) requieren servirse via HTTP, no como `file://`.

---

## Datos de la red

| Entidad | Cantidad |
|---|---|
| Sitios propios (MSO + NFO) | 26 |
| Sitios de terceros (Cirion, KIO) | 4 |
| Lambdas (circuitos ópticos 100 Gbps) | 22 |
| Segmentos físicos únicos | ~45 |
| Capacidad total | 2.2 Tbps |
| Proveedores de fibra | AT&T, Bestel, Marcatel, Maxcom, Cirion, QUATTROCOM |
| Ruteadores (Cisco / Juniper / Cirion) | 8 |
| Proveedores ISP | Arelion, Gold Data, Meta, Amazon, Akamai, Cirion |

---

## API Endpoints

### Sitios y Lambdas

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
```

### Dashboard y Reportes

```
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

### Simulación

```
POST   /api/v1/simulation                Simular falla de 1-2 segmentos DWDM
POST   /api/v1/simulation/provider       Simular falla por proveedor de fibra
POST   /api/v1/simulation/isp-provider   Simular falla de proveedor ISP (con redistribución ISIS)
POST   /api/v1/simulation/lambda-traffic Simular impacto de caída de lambdas en tráfico
```

### Capa IP/ISP — Ruteadores

```
GET    /api/v1/routers                   Lista ruteadores con interfaces
POST   /api/v1/routers                   Crear ruteador (site_id, name, brand)
PUT    /api/v1/routers/{id}              Actualizar nombre o marca
DELETE /api/v1/routers/{id}             Eliminar (interfaces en cascada)

POST   /api/v1/router-interfaces         Crear interfaz (lambda o ISP)
PUT    /api/v1/router-interfaces/{id}    Actualizar métrica ISIS
DELETE /api/v1/router-interfaces/{id}    Eliminar interfaz
```

### Capa IP/ISP — Proveedores ISP

```
GET    /api/v1/isp-providers             Lista proveedores ISP
POST   /api/v1/isp-providers             Crear proveedor (name, color hex)
PUT    /api/v1/isp-providers/{id}        Actualizar nombre o color
DELETE /api/v1/isp-providers/{id}        Eliminar (valida interfaces activas → 409)
```

### Utilización mensual (Excel)

```
POST   /api/v1/upload/lambda-utilization Importar Excel de utilización mensual (.xlsx)
GET    /api/v1/lambda-utilization        Obtener datos de utilización por mes
GET    /api/v1/traffic-flows             Lista flujos de tráfico ISP
PUT    /api/v1/traffic-flows/{id}        Actualizar interfaces_count de un flujo
```

---

## Módulos del Frontend

| Módulo | Descripción |
|---|---|
| **Topología** | Grafo lógico D3 force-directed y mapa geográfico de México. Líneas paralelas por lambda. Overlay de Capa IP/ISP (ruteadores + nubes de proveedores). Selección múltiple de lambdas. Toggle ID/nombre. Posiciones guardables en localStorage |
| **Gestión de Red** | CRUD completo con modales: Sitios, Lambdas, Ruteadores (con interfaces) y Proveedores ISP |
| **Dashboard** | KPIs, barras de uso por segmento, donut de proveedores, tabla con alertas al 80% |
| **Simulación** | Falla de 1-2 segmentos DWDM, por proveedor de fibra o por proveedor ISP. Análisis de protección 1+1. Selector de sitio de ingreso con nombre y toggle ID/Nombre |
| **Reportes** | Descarga en PDF, Excel y CSV. Importación de Excel de utilización mensual |
| **Capa IP/ISP** | Grafo dedicado de ruteadores e interfaces ISP. Matriz de capacidad con LAG. Semáforo de utilización (verde/amarillo/rojo). Simulación de redistribución de tráfico ISIS |

---

## Funcionalidades de Topología

### Grafo Lógico (D3 force-directed)
- Cada **lambda se dibuja como su propia línea coloreada** en cada segmento que utiliza
- Cuando varias lambdas comparten un segmento, sus líneas se muestran **paralelas** (4 px de separación perpendicular)
- Hover sobre una línea individual → tooltip con nombre, capacidad y protección 1+1
- Hover sobre el espacio entre líneas → tooltip del enlace completo
- Nodos arrastrables; posiciones guardables en `localStorage` con botón "💾 Guardar posiciones"

### Overlay Capa IP/ISP (sobre el grafo DWDM)
- Botón de toggle activa/oculta la capa IP sobre cualquiera de los dos modos de topología
- **Ruteadores** (Cisco=azul, Juniper=verde, Cirion=naranja) aparecen como badge con símbolo X desplazado del nodo DWDM
- Una línea punteada conecta el badge del ruteador con su sitio DWDM
- **Proveedores ISP** aparecen como elipses con relleno sólido y texto blanco, conectados al ruteador por una línea
- Los badges de ruteadores y elipses de proveedores son **arrastrables independientemente**; posiciones guardadas en `localStorage` separado

### Mapa Geográfico
- Contorno real de México con `d3.geoMercator()` + `mexico.geojson` (Natural Earth 110m, sin CDN)
- 30 sitios posicionados con coordenadas lat/lon reales en la BD
- Misma visualización de líneas paralelas por lambda que el grafo lógico
- Zoomable y paneable; botones de zoom y ajuste a pantalla

### Selección múltiple de lambdas
- Clic en una lambda del panel lateral la agrega/quita del conjunto de seleccionadas (`Set`)
- Seleccionadas: opacidad 100%, grosor 3.5 px — No seleccionadas: opacidad 5%
- Funciona igual en Grafo Lógico y en Mapa Geográfico

---

## Capa IP/ISP

### Ruteadores
- Un ruteador por sitio (restricción actual); marcas: Cisco, Juniper, Cirion
- Interfaces tipo **lambda** (100 Gbps, con métrica ISIS para rerouteo)
- Interfaces tipo **ISP** (100 Gbps, vinculadas a un proveedor ISP)
- Agrupación LAG: múltiples interfaces se agrupan en una interfaz lógica de mayor capacidad
- Semáforo de utilización: verde (<60%), amarillo (60–80%), rojo (>80%)

### Simulación ISP
- Seleccionar proveedor ISP + sitio de ingreso
- Calcula redistribución proporcional de tráfico entre proveedores alternativos
- Si hay déficit, sugiere rerouteo ISIS por interfaces lambda (ordenadas por métrica)
- Muestra detalle de interfaces afectadas, capacidad disponible y déficit en Gbps

### Importación de utilización mensual
- Importa archivo `.xlsx` con datos de utilización de lambdas (formato THP_Marzo26)
- Detecta inconsistencias (lambdas de 200 Gbps = segunda lambda sin registrar)
- Almacena historial por mes; permite cargar un archivo por cada período

---

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Eliminación de sitio | Error 409 si tiene segmentos activos (devuelve lista de lambdas afectadas) |
| Color único | Cada lambda debe tener un color hex distinto |
| Segmentos canónicos | `site_a_id < site_b_id` alfabéticamente (previene duplicados lógicos) |
| Capacidad máxima | 96 lambdas por fibra. Alerta en dashboard si segmento ≥ 77 (80%) |
| Fibras independientes | `ruta_1` y `ruta_2` entre mismos sitios son físicamente distintas |
| Protección 1+1 | `protection_route_name` referencia la lambda de respaldo |
| Simulación | Solo lectura — no modifica la BD |
| Ruteador por sitio | Un único ruteador por Site ID (restricción de BD) |
| Proveedor ISP eliminable | Solo si no tiene interfaces ni flujos activos (→ 409) |

---

## Estructura del proyecto

```
dwdm_analysis/
├── backend/
│   ├── run.py                   # Punto de entrada Flask
│   ├── requirements.txt
│   ├── dwdm.db                  # SQLite (auto-creada al arrancar)
│   └── app/
│       ├── __init__.py          # App factory + registro de blueprints
│       ├── config.py
│       ├── extensions.py
│       ├── models.py            # Site, Lambda, Segment, LambdaSegment,
│       │                        # Router, RouterInterface, ISPProvider,
│       │                        # TrafficFlow, LambdaUtilization
│       ├── seed.py              # 30 sitios + 22 lambdas + ruteadores + ISP
│       └── api/
│           ├── sites.py
│           ├── lambdas.py
│           ├── segments.py
│           ├── dashboard.py
│           ├── simulation.py
│           ├── reports.py
│           └── isp.py           # Ruteadores, interfaces, proveedores ISP,
│                                # flujos de tráfico, simulación ISP, Excel
└── frontend/
    ├── index.html               # SPA con routing por hash, nav horizontal
    ├── styles.css               # Dark theme design system
    ├── api.js                   # Cliente API (fetch) — todos los endpoints
    ├── mexico.geojson           # Contorno de México (Natural Earth, 174 puntos)
    ├── topology.js              # D3 grafo lógico + mapa geográfico +
    │                            # overlay Capa IP/ISP con drag independiente
    ├── crud.js                  # CRUD: Sitios, Lambdas, Ruteadores, Prov. ISP
    ├── dashboard.js             # KPIs + Chart.js
    ├── simulation.js            # Simulador DWDM + ISP, selector sitio/nombre
    ├── isp_layer.js             # Grafo IP/ISP dedicado, matriz, semáforo LAG
    └── reports.js               # Descarga PDF/Excel/CSV + import utilización
```

---

## Changelog reciente

### [branch: new_feature_isp] — 2026-04

- **CRUD completo para Ruteadores y Proveedores ISP** en la sección "Gestión de Red" (pestañas nuevas)
- **Overlay Capa IP** en ambos modos de topología: ruteadores con línea de conexión al sitio DWDM, elipses ISP arrastrable e independientes del ruteador
- **Guardado de posiciones** en localStorage para grafo lógico DWDM, grafo ISP, badges de ruteadores y elipses de proveedores
- **Simulación ISP mejorada**: selector de "Sitio de ingreso" respeta toggle ID/Nombre y muestra el nombre del sitio
- **Elipses de proveedores ISP** con relleno sólido del color del proveedor y texto en blanco (coherente en overlay y grafo ISP)
- **Drag independiente** en grafo ISP: arrastrar un nodo no arrastra los conectados
- **Nav actualizado**: iconos con color (emoji), etiqueta "Gestión de Red" en lugar de "Sitios & Lambdas"
- **8 nuevos endpoints REST**: POST/PUT/DELETE para ruteadores, POST/DELETE para interfaces, POST/PUT/DELETE para proveedores ISP
