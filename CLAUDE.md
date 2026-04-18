# CLAUDE.md — Proyecto: Topología DWDM ISP TX

---

## Rol del Asistente

Actúa como un ingeniero senior con experiencia en:

* Redes de transporte óptico DWDM (Ciena, Infinera) — sistemas 96 canales C-band
* Redes IP para servicios de Internet (ISP)
* Desarrollo backend con Python y Flask
* Desarrollo frontend con React + D3.js
* Bases de datos relacionales (SQLite en desarrollo, MySQL en producción)
* Análisis y visualización de datos de red
* APIs REST con documentación OpenAPI/Swagger

Cuando generes código:

* Usa nombres de variables en inglés, comentarios en español
* Prioriza legibilidad y mantenibilidad sobre optimización prematura
* Sigue el principio DRY y estructura modular
* Incluye manejo de errores y validaciones
* Genera pruebas básicas cuando sea relevante

---

## Contexto del Proyecto

Aplicación web full-stack para visualizar, gestionar y analizar la topología de una red de transporte óptico DWDM de un ISP en México.

La red conecta sitios propios (MSO/NFO) con puntos de interconexión de terceros (Cirion, KIO Networks) mediante **lambdas** (circuitos ópticos de 100 Gbps cada uno) que atraviesan múltiples segmentos de fibra arrendada a proveedores como AT&T, Axtel, Bestel, Marcatel, Totalplay, Maxcom, y Cirion. Puede haber mas de un proveedor como dueño de una lambda, en segmeentos compartidos.

**Tecnología DWDM:** Equipos Ciena e Infinera. Sistemas de 96 canales en C-band. Capacidad teórica máxima por fibra: 96 × 100 Gbps = **9.6 Tbps**.

**Esquema de protección:** 1+1 por ruta alternativa. Cada lambda crítica debe tener una ruta de protección definida que no comparta segmentos físicos con la ruta principal. La simulación de fallas debe identificar cuáles lambdas pierden ambas rutas ante una falla doble.

**OLAs/EDFAs:** Existen amplificadores ópticos intermedios en la red (sin detalles documentados aún). El modelo de datos debe contemplar un campo opcional para registrarlos en el futuro.

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11+, Flask 3, SQLAlchemy, SQLite |
| Frontend | HTML5, JavaScript ES Modules, D3.js v7, Chart.js v4 |
| Navegación | SPA con routing por hash (`#topology`, `#crud`, etc.), nav horizontal superior |
| BD Desarrollo | SQLite (auto-creada y poblada al arrancar) |
| BD Producción | MySQL 8 |
| API | REST + CORS (flask-cors) |
| Exportación | ReportLab (PDF), openpyxl (Excel), csv nativo |
| Geodatos | `mexico.geojson` local (Natural Earth 110m, 174 puntos) — sin dependencia CDN |

---

## Modelo de Datos

### Sitios (`SITE_ID_TO_NAME`)

Cada sitio incluye ID, nombre, tipo, región, ciudad y coordenadas geográficas aproximadas para renderizado en mapa real.

> **Regla:** Al eliminar un sitio, verificar primero que ningún segmento activo lo referencie. Si hay segmentos, retornar error 409 con la lista de lambdas afectadas.
> **Frontend:** Mostrar tanto el Site ID como el nombre del sitio (toggle); opciones para agregar, editar nombre, editar ID, y eliminar sitios desde la UI.

```python
SITE_ID_TO_NAME = {

    # ─── Sitios propios — MSO (Main Switch Office) ────────────────────────────

    "MSOTOL01": {
        "name": "MSO Toluca",
        "type": "own",
        "region": "Centro",
        "city": "Toluca",
        "lat": null,
        "lon": null,
    },
    "MSOMEX01": {
        "name": "MSO Megacentro",
        "type": "own",
        "region": "Centro",
        "city": "Cuautitlán Izcalli",
        "lat": null,
        "lon": null,
    },
    "MSOMEX04": {
        "name": "Ceylan",
        "type": "own",
        "region": "Centro",
        "city": "Ciudad de México",
        "lat": null,
        "lon": null,
    },
    "MSOMTY01": {
        "name": "MSO Apodaca",
        "type": "own",
        "region": "Norte",
        "city": "Apodaca",
        "lat": null,
        "lon": null,
    },
    "MSOMTY02": {
        "name": "Buenos Aires",
        "type": "own",
        "region": "Norte",
        "city": "Monterrey",
        "lat": null,
        "lon": null,
    },
    "MSOMTY03": {
        "name": "MSO Gonzalitos",
        "type": "own",
        "region": "Norte",
        "city": "Monterrey",
        "lat": null,
        "lon": null,
    },
    "MSOGDL01": {
        "name": "MSO Tlaquepaque",
        "type": "own",
        "region": "Occidente",
        "city": "San Pedro Tlaquepaque",
        "lat": null,
        "lon": null,
    },
    "MSOGDL02": {
        "name": "Canadá",
        "type": "own",
        "region": "Occidente",
        "city": "Guadalajara",
        "lat": null,
        "lon": null,
    },
    "MSOPUE01": {
        "name": "Puebla Calera",
        "type": "own",
        "region": "Centro-Sur",
        "city": "Puebla",
        "lat": null,
        "lon": null,
    },
    "MSOJRZ01": {
        "name": "Cd Juárez",
        "type": "own",
        "region": "Norte",
        "city": "Ciudad Juárez",
        "lat": null,
        "lon": null,
    },
    "TAMREY1273": {
        "name": "Reynosa Iusatel",
        "type": "own",
        "region": "Norte",
        "city": "Reynosa",
        "lat": null,
        "lon": null,
    },

    # ─── Sitios propios — NFO (Nodo de Fibra Óptica) ─────────────────────────

    "NFO-004": {
        "name": "Jilotepec",
        "type": "own",
        "region": "Centro",
        "city": "Jilotepec",
        "lat": null,
        "lon": null,
    },
    "NFO-006": {
        "name": "León LD",
        "type": "own",
        "region": "Bajío",
        "city": "León",
        "lat": null,
        "lon": null,
    },
    "NFO-009": {
        "name": "QRO San Pablo",
        "type": "own",
        "region": "Bajío",
        "city": "Querétaro",
        "lat": null,
        "lon": null,
    },
    "NFO-010": {
        "name": "Río Frío",
        "type": "own",
        "region": "Centro",
        "city": "Río Frío",
        "lat": null,
        "lon": null,
    },
    "NFO-022": {
        "name": "Reynosa Marcatel",
        "type": "own",
        "region": "Norte",
        "city": "Reynosa",
        "lat": null,
        "lon": null,
    },
    "NFO-025": {
        "name": "SLP Marcatel",
        "type": "own",
        "region": "Centro-Norte",
        "city": "San Luis Potosí",
        "lat": null,
        "lon": null,
    },
    "NFO-027": {
        "name": "AGS Bestel",
        "type": "own",
        "region": "Centro-Norte",
        "city": "Aguascalientes",
        "lat": null,
        "lon": null,
    },
    "NFO-032": {
        "name": "Irapuato Bestel",
        "type": "own",
        "region": "Bajío",
        "city": "Irapuato",
        "lat": null,
        "lon": null,
    },
    "NFO-038": {
        "name": "Nuevo Laredo",
        "type": "own",
        "region": "Norte",
        "city": "Nuevo Laredo",
        "lat": null,
        "lon": null,
    },
    "NFO-040": {
        "name": "QRO Bestel",
        "type": "own",
        "region": "Bajío",
        "city": "Querétaro",
        "lat": null,
        "lon": null,
    },
    "NFO-044": {
        "name": "SLP Bestel",
        "type": "own",
        "region": "Centro-Norte",
        "city": "San Luis Potosí",
        "lat": null,
        "lon": null,
    },
    "NFO-053": {
        "name": "Poza Rica Maxcom",
        "type": "own",
        "region": "Golfo",
        "city": "Poza Rica",
        "lat": null,
        "lon": null,
    },
    "NFO-075": {
        "name": "MTY Marcatel",
        "type": "own",
        "region": "Norte",
        "city": "Monterrey",
        "lat": null,
        "lon": null,
    },
    "NFO-076": {
        "name": "MTY Transtelco",
        "type": "own",
        "region": "Norte",
        "city": "Monterrey",
        "lat": null,
        "lon": null,
    },
    "NFO-117": {
        "name": "Maravatio",
        "type": "own",
        "region": "Bajío",
        "city": "Maravatío",
        "lat": null,
        "lon": null,
    },

    # ─── Sitios de terceros ────────────────────────────────────────────────────

    "KIO-QRO": {
        "name": "KIO Networks Querétaro",
        "type": "third_party",
        "region": "Bajío",
        "city": "Querétaro",
        "lat": null,
        "lon": null,
    },
    "CIRION-ZURICH": {
        "name": "Cirion Zurich",
        "type": "third_party",
        "region": "Centro",
        "city": "Ciudad de México",
        "lat": null,
        "lon": null,
    },
    "CIRION-MIRLO": {
        "name": "Cirion Mirlo",
        "type": "third_party",
        "region": "Occidente",
        "city": "Guadalajara",
        "lat": null,
        "lon": null,
    },
    "CIRION-HUMBOLDT": {
        "name": "Cirion Humboldt",
        "type": "third_party",
        "region": "Norte",
        "city": "Monterrey",
        "lat": null,
        "lon": null,
    },

    # ─── Sitios propios — MSO nuevos ──────────────────────────────────────────

    "MSOMEX05": {
        "name": "MSO Tultitlan KIO",
        "type": "third_party",
        "region": "Centro",
        "city": "Ciudad de Mexico",
        "lat": 16.912386,
        "lon": -100.092827,
    },
    "MSOMER01": {
        "name": "MSO Merida",
        "type": "own",
        "region": "Sureste",
        "city": "Merida",
        "lat": 20.9071169,
        "lon": -89.712532,
    },
}
```

> **Nota sobre coordenadas geográficas:** Los valores de `lat`/`lon` son **aproximados** y pueden estar ajustados intencionalmente para evitar solapamiento visual entre sitios cercanos en el mapa. No representan la ubicación física exacta. El usuario puede arrastrar los nodos en el Mapa Geográfico y guardar la posición ajustada desde la UI (botón "💾 Guardar posiciones").

> **Nota sobre OLAs:** Cuando se tenga información de amplificadores ópticos intermedios, agregar a cada sitio un campo opcional `"ola": true` y al segmento el campo `"ola_count": int`.

---

### Lambdas (`LAMBDA_PATHS`)

**Definición de campos:**

| Campo | Descripción |
|---|---|
| `name` | Nombre descriptivo de la lambda (origen → destino) |
| `color` | Color hex único para visualización en topología |
| `num_lambdas` | Número de lambdas paralelas sobre esta trayectoria (1 por defecto) |
| `capacity_per_lambda` | Capacidad por lambda en Gbps (100 Gbps estándar) |
| `protection_route` | Nombre de la lambda que actúa como ruta de protección 1+1 (opcional) |
| `segments` | Lista de segmentos que componen la trayectoria |

**Definición de campos por segmento:**

| Campo | Descripción |
|---|---|
| `sites` | Par de Site IDs conectados (orden canónico alfabético en BD) |
| `fiber` | Identificador de fibra física: `ruta_1` o `ruta_2` (fibras independientes entre mismos sitios) |
| `fiber_provider` | Proveedor de la fibra arrendada en ese tramo (AT&T, Bestel, Marcatel, etc.) |

**Restricciones del sistema:**

* Capacidad máxima por fibra: **96 lambdas** × 100 Gbps = 9.6 Tbps
* Un segmento `A↔B` es equivalente a `B↔A`. La BD almacena orden canónico (alfabético por ID)
* `ruta_1` y `ruta_2` entre los mismos sitios son **físicamente independientes**
* Al crear/editar lambda, validar que el color hex no esté en uso por otra lambda activa

```python
LAMBDA_PATHS = [


    # ── ORIGEN: NUEVO LAREDO ──────────────────────────────────────────────────

    {
        "name": "Laredo to Toluca",
        "color": "#FF69B4",          # Rosa
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,    # Definir ruta de protección 1+1 cuando aplique
        "segments": [
            {"sites": {"NFO-038", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"Bestel", "AT&T"}},
            {"sites": {"NFO-076", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-075", "NFO-025"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-025", "NFO-009"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-009", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-004", "MSOTOL01"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
        ],
    },

    {
        "name": "Laredo to Apodaca",
        "color": "#4169E1",          # Azul rey
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"NFO-038", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"Bestel", "AT&T"}},
            {"sites": {"NFO-076", "MSOMTY02"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY02", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Laredo to Megacentro",
        "color": "#8B4513",          # Café
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"NFO-038", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"Bestel", "AT&T"}},
            {"sites": {"NFO-076", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-075", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-022", "NFO-053"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Axtel"}},
            {"sites": {"NFO-053", "MSOPUE01"}, "fiber": "ruta_1", "fiber_provider": {"Maxcom", "AT&T"}},
            {"sites": {"MSOPUE01", "NFO-010"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-010", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},  
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},  
        ],
    },

    {
        "name": "Laredo to Tlaquepaque",
        "color": "#228B22",          # Verde
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"NFO-038", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"Bestel", "AT&T"}},
            {"sites": {"NFO-076", "NFO-044"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel"}},
            {"sites": {"NFO-044", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-027", "NFO-006"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-006", "MSOGDL02"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"MSOGDL02", "MSOGDL01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    # ── ORIGEN: REYNOSA ───────────────────────────────────────────────────────

    {
        "name": "Reynosa to Toluca",
        "color": "#1A1A1A",          # Negro
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"TAMREY1273", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-022", "NFO-053"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Axtel"}},
            {"sites": {"NFO-053", "MSOPUE01"}, "fiber": "ruta_1", "fiber_provider": {"Maxcom", "AT&T"}},
            {"sites": {"MSOPUE01", "NFO-010"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-010", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"MSOMEX04", "MSOTOL01"}, "fiber": "ruta_1", "fiber_provider": {"Bestel", "AT&T"}},
        ],
    },

    {
        "name": "Reynosa to Megacentro",
        "color": "#87CEEB",          # Azul cielo
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"TAMREY1273", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-022", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-075", "NFO-025"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-025", "NFO-009"}, "fiber": "ruta_1", "fiber_provider":  {"Marcatel",}},
            {"sites": {"NFO-009", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-004", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"Unknown",}},
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Reynosa to Tlaquepaque",
        "color": "#DC143C",          # Rojo carmesí
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"TAMREY1273", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-022", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-075", "NFO-025"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-025", "NFO-009"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-009", "NFO-040"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-040", "NFO-032"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-032", "MSOGDL02"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"MSOGDL02", "MSOGDL01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Reynosa to Apodaca",
        "color": "#800080",          # Morado
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"TAMREY1273", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-022", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-075", "MSOMTY02"}, "fiber": "ruta_1", "fiber_provider": {"Unknown",}},
            {"sites": {"MSOMTY02", "MSOMTY03"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY03", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    # ── ORIGEN: CD JUÁREZ ─────────────────────────────────────────────────────

    {
        "name": "Cd Juarez to Apodaca",
        "color": "#FF8C00",          # Naranja
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOJRZ01", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Axtel",}},
            {"sites": {"NFO-027", "NFO-044"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-044", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel"}},
            {"sites": {"NFO-076", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cd Juarez to Megacentro",
        "color": "#FF00FF",          # Magenta
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOJRZ01", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Axtel",}},
            {"sites": {"NFO-027", "NFO-006"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-006", "NFO-032"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-032", "NFO-040"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-040", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel",}},
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cd Juarez to Tlaquepaque",
        "color": "#6B3A2A",          # Marrón oscuro (diferenciado de Café #8B4513)
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOJRZ01", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Axtel",}},
            {"sites": {"NFO-027", "NFO-006"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-006", "MSOGDL02"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"MSOGDL02", "MSOGDL01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cd Juarez to Toluca",
        "color": "",          # Selecciona un color que no se use
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOJRZ01", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Axtel",}},
            {"sites": {"NFO-027", "NFO-006"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-006", "NFO-009"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-009", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-004", "MSOTOL01"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
        ],
    },


    # ── INTERCONEXIÓN MSO ─────────────────────────────────────────────────────

    {
        "name": "Megacentro to Toluca",
        "color": "#808080",          # Gris
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOMEX01", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMEX04", "MSOTOL01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel"}},
        ],
    },

    {
        "name": "Toluca to Tlaquepaque",
        "color": "#008B8B",          # Teal (diferenciado de Gris/Plata)
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOTOL01", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-004", "NFO-009"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-009", "NFO-040"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"NFO-040", "NFO-032"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-032", "MSOGDL02"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"MSOGDL02", "MSOGDL01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Tlaquepaque to Apodaca",
        "color": "#ADFF2F",          # Verde limón
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOGDL01", "MSOGDL02"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOGDL02", "NFO-006"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-006", "NFO-027"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-027", "NFO-044"}, "fiber": "ruta_1", "fiber_provider": {"Bestel",}},
            {"sites": {"NFO-044", "NFO-076"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel",}},
            {"sites": {"NFO-076", "MSOMTY02"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY02", "MSOMTY03"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY03", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Apodaca to Megacentro",               
        "color": "#FFD700",          # Amarillo
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"MSOMTY01", "MSOMTY02"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY02", "NFO-075"}, "fiber": "ruta_1", "fiber_provider": {"Unknown",}},
            {"sites": {"NFO-075", "NFO-022"}, "fiber": "ruta_1", "fiber_provider": {"Marcatel",}},
            {"sites": {"NFO-022", "NFO-053"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Axtel"}},
            {"sites": {"NFO-053", "MSOPUE01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Maxcom"}},
            {"sites": {"MSOPUE01", "NFO-010"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-010", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
        ],
    },

    # ── ORIGEN: KIO NETWORKS QUERÉTARO ───────────────────────────────────────

    {
        "name": "KIO Networks Qro to Megacentro Plano 1",
        "color": "#4B0082",          # Índigo
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "KIO Networks Qro to Megacentro Plano 2",   # Rutas 1+1
        "segments": [
            {"sites": {"KIO-QRO", "NFO-040"}, "fiber": "ruta_1", "fiber_provider": {"Quattrocom",}},
            {"sites": {"NFO-040", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"AT&T", "Bestel"}},
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "KIO Networks Qro to Megacentro Plano 2",
        "color": "#40E0D0",          # Turquesa 
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "KIO Networks Qro to Megacentro Plano 1",   # Rutas 1+1
        "segments": [
            {"sites": {"KIO-QRO", "NFO-009"}, "fiber": "ruta_1", "fiber_provider": {"Quattrocom",}},
            {"sites": {"NFO-009", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"NFO-004", "MSOMEX04"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
            {"sites": {"MSOMEX04", "MSOMEX01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    # ── ORIGEN: CIRION ────────────────────────────────────────────────────────

    {
        "name": "Cirion Zurich to Megacentro",
        "color": "#EE82EE",          # Violeta
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "Cirion Zurich to Toluca",
        "segments": [
            {"sites": {"CIRION-ZURICH", "MSOMEX01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cirion Zurich to Toluca",
        "color": "#3CB371",          # Verde medio (diferenciado de Verde #228B22 y Verde limón)
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"CIRION-ZURICH", "MSOMEX01"}, "fiber": "ruta_2", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMEX01", "NFO-004"}, "fiber": "ruta_1", "fiber_provider": {"Unknown",}},
            {"sites": {"NFO-004", "MSOTOL01"}, "fiber": "ruta_1", "fiber_provider": {"Totalplay",}},
        ],
    },

    {
        "name": "Cirion Humboldt to Apodaca Plano 1",
        "color": "#B22222",          # Rojo intenso (diferenciado de Rojo carmesí #DC143C)
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "Cirion Humboldt to Apodaca Plano 2",
        "segments": [           
            {"sites": {"CIRION-HUMBOLDT", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cirion Humboldt to Apodaca Plano 2",
        "color": "#B87333",          # Cobre
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": "Cirion Humboldt to Apodaca Plano 1",
        "segments": [
            {"sites": {"CIRION-HUMBOLDT", "MSOMTY02"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
            {"sites": {"MSOMTY02", "MSOMTY01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },

    {
        "name": "Cirion Mirlo to Tlaquepaque Plano 1",
        "color": "#FF2400",          # Escarlata
        "num_lambdas": 1,
        "capacity_per_lambda": 100,
        "protection_route": None,
        "segments": [
            {"sites": {"CIRION-MIRLO", "MSOGDL01"}, "fiber": "ruta_1", "fiber_provider": {"AT&T",}},
        ],
    },
]
```

---

## Reglas de Negocio

1. **Eliminación de sitio:** Verificar que ningún segmento activo referencie ese sitio. Si tiene segmentos, retornar error 409 con lista de lambdas afectadas.
2. **Colores únicos:** Al crear o editar una lambda, validar que el color hex no esté en uso por otra lambda activa.
3. **Segmentos bidireccionales:** Un segmento `A↔B` es equivalente a `B↔A`. La BD almacena orden canónico (alfabético por ID) para evitar duplicados lógicos.
4. **Capacidad:** `capacidad_total_segmento = num_lambdas × capacity_per_lambda`. Máximo **96 lambdas por fibra** en sistema C-band de 96 canales. Alertar en dashboard cuando un segmento supere el 80% (≥77 lambdas).
5. **Fibras independientes:** `ruta_1` y `ruta_2` entre los mismos sitios son físicamente independientes (dos fibras distintas del proveedor). Se cuentan y visualizan por separado.
6. **Sitios de terceros:** Visualización diferenciada (ícono distinto, borde punteado). No se pueden eliminar si tienen segmentos activos, igual que sitios propios.
7. **Simulación:** Solo lectura — no modifica el estado de la BD. Retorna resultados en memoria.
8. **Protección 1+1:** El campo `protection_route` referencia la lambda de respaldo. La simulación debe detectar si una falla de segmento afecta simultáneamente la ruta principal **y** su protección (pérdida total de servicio).
9. **Proveedores de fibra:** El campo `fiber_provider` es informativo y permite filtrar/agrupar segmentos por proveedor en reportes y dashboards.
10. **QUATTROCOM:** Registrado como proveedor de fibra (no como sitio). No crear Site ID para él.

---

## Módulos Frontend

### 1. Visualización de Topología

Implementada en `frontend/topology.js` con D3.js v7. Dos modos accesibles via toggle:

| Modo | Descripción |
|---|---|
| **Grafo lógico** | D3 force-directed. Nodos arrastrables, posición libre |
| **Mapa geográfico** | Nodos sobre contorno real de México via `d3.geoMercator()` |

#### Líneas paralelas por lambda (ambos modos)

* Cada lambda se dibuja como **su propia línea coloreada** (color `lambda.color`) en cada segmento que utiliza
* Cuando varias lambdas comparten un segmento, sus líneas se desplazan **perpendicularmente** con separación de 4 px entre sí — los segmentos más cargados se ven como un haz de colores
* Algoritmo de offset: `offset = (index - (total-1)/2) * LINE_SPACING`, vector perpendicular `(-dy/len, dx/len)`
* **Hover sobre una línea lambda** → tooltip con nombre, capacidad y ruta de protección 1+1
* **Hover sobre área entre líneas** (hit area transparente de 18 px) → tooltip del enlace completo (todos los segmentos y lambdas)
* Segmentos sin ninguna lambda → línea tenue `rgba(45,139,255,0.12)` de referencia

#### Selección múltiple de lambdas

* Panel lateral derecho lista todas las lambdas con su color
* **Clic** en una lambda la agrega o quita del conjunto de seleccionadas (`Set`)
* Lambdas seleccionadas → opacidad 100%, grosor 3.5 px
* Lambdas no seleccionadas → opacidad 5%, grosor 0.8 px
* Botón **✕ Quitar selección** limpia todo el conjunto
* El título del panel muestra `"X seleccionada(s)"` cuando hay selección activa
* Funciona igual en Grafo Lógico y Mapa Geográfico

#### Mapa Geográfico

* Contorno del territorio mexicano cargado desde `frontend/mexico.geojson` (Natural Earth 110m, 174 puntos, sin dependencia CDN)
* Proyección `d3.geoMercator().fitExtent(...)` ajustada al tamaño real del SVG via `getBoundingClientRect()` + `requestAnimationFrame` (solución a `clientWidth=0` en SVG)
* Los 32 sitios tienen coordenadas reales en `seed.py` (MSOMEX05 tiene coordenadas aproximadas, pendiente de verificar)
* Sitios sin `lat`/`lon` → panel lateral "Sin ubicar"
* Mapa zoomable y paneable (D3 zoom); botón "Centrar México"

**Implementación de la proyección:**
```javascript
// Carga local, sin CDN externo
const data = await d3.json('./mexico.geojson');
mexicoGeoData = data.features[0];

// Dimensiones fiables del SVG
await new Promise(r => requestAnimationFrame(r));
const bbox = svgEl.getBoundingClientRect();
const W = Math.round(bbox.width) || 900;
const H = Math.round(bbox.height) || 600;

const projection = d3.geoMercator()
  .fitExtent([[pad, pad], [W - pad, H - pad]], mexicoFeature);
const toPixel = (lat, lon) => projection([lon, lat]);
```

#### Nodos

* `own` → círculo (r=14), borde `--accent-blue`
* `third_party` → rectángulo, borde punteado `--accent-purple`
* Hover → tooltip con Site ID, tipo, región, ciudad y puntos de color de lambdas que pasan
* Toggle Nombre / Site ID en la barra de herramientas

### 2. CRUD de Sitios y Lambdas

* Tabla de sitios con filtro por tipo, región, búsqueda por nombre/ID
* Formulario modal para agregar/editar sitio: ID, nombre, tipo, región, ciudad, lat, lon
* Validación al eliminar: advertencia con lista de lambdas afectadas
* Tabla de lambdas con color visual en cada fila, filtro por nombre/origen/destino
* Formulario modal para agregar/editar lambda: nombre, color (color picker hex), segmentos, ruta de protección
* Editor de segmentos: select sitio A / sitio B, fibra (ruta_1 / ruta_2), proveedor, num_lambdas, capacity_per_lambda

### 3. Dashboards

* **KPIs superiores:** total sitios propios, sitios terceros, lambdas activas, capacidad total (Tbps), total segmentos únicos
* Tabla de segmentos más utilizados (por número de lambdas que los atraviesan, con % vs 96 canales)
* Gráfica de barras: capacidad por segmento (Gbps)
* Gráfica de barras: lambdas por segmento
* **Gráfica de pastel o barras:** distribución de segmentos por proveedor de fibra
* Tabla de lambdas con mayor solapamiento de segmentos (puntos de falla compartida)
* **Alerta visual** cuando algún segmento supere el 80% de capacidad (≥77 lambdas)

### 4. Capa IP/ISP (`frontend/isp_layer.js`)

* Grafo de ruteadores y nubes de proveedores ISP (D3 force), draggable, posiciones en `localStorage`
* **Matriz de tráfico ISP:** filas = (proveedor, sitio_ingreso, PGW), columnas = sitios MSO egreso; valores en Gbps reales; semáforo de capacidad
* **Panel Prioridades ISP:** tabla por (sitio_egreso, PGW) con badges de prioridad 1/2/3 y botones ▲/▼ para intercambiar niveles (swap en BD vía `POST /isp-priorities/reorder`)
* **Panel Análisis de Fallas:** botón "Generar Reporte Completo" → `GET /simulation/report`; muestra adecuación de prioridades (12 combinaciones), ranking de lambdas críticas (14), ranking de proveedores ISP críticos (6); exportación CSV
* Métricas ISIS por interfaz lambda; LAG de interfaces ISP

### 5. Simulador de Fallas (`frontend/simulation.js`)

* Cuatro modos de falla (toggle): **Por segmento(s)** · **Por proveedor** · **Falla ISP** · **Falla Ruteador**
* Modo segmentos: selección de 1-3 segmentos simultáneos (falla doble/triple)
* Modo proveedor: simula caída de todos los segmentos de un proveedor de fibra
* Modo ISP: simula caída de un proveedor ISP en un sitio de ingreso; muestra redistribución proporcional, déficit y rerouteo ISIS alternativo; botón "Analizar todas las fallas ISP"
* **Modo ruteador** (nuevo): select de ruteador → `POST /simulation/router`; muestra flujos ISP afectados (Gbps), lambdas DWDM que pasan por el sitio, prioridades BGP de fallback por PGW, y opciones ISIS alternativas
* Resultado: KPIs de impacto, tablas de flujos/lambdas afectados, análisis de protección 1+1, rerouteo ISIS

### 6. Reportes

* Vista con opciones de exportación: PDF, Excel, CSV
* Reporte general: total enlaces, lambdas, capacidad, proveedores de fibra
* Reporte de segmentos: uso por segmento, capacidad, lambdas, proveedor
* Reporte de proveedores: segmentos y capacidad por proveedor de fibra
* Reporte de simulación: impacto de fallas simuladas, incluyendo análisis de protección

---

## API REST — Endpoints Implementados

```
# ── Sitios ────────────────────────────────────────────────────────────────────
GET    /api/v1/sites                        → Lista todos los sitios
POST   /api/v1/sites                        → Crear sitio
PUT    /api/v1/sites/{site_id}              → Actualizar sitio
DELETE /api/v1/sites/{site_id}              → Eliminar sitio (valida segmentos)

# ── Lambdas ───────────────────────────────────────────────────────────────────
GET    /api/v1/lambdas                      → Lista todas las lambdas
POST   /api/v1/lambdas                      → Crear lambda
PUT    /api/v1/lambdas/{lambda_id}          → Actualizar lambda
DELETE /api/v1/lambdas/{lambda_id}          → Eliminar lambda

# ── Segmentos ─────────────────────────────────────────────────────────────────
GET    /api/v1/segments                     → Lista segmentos únicos con uso
GET    /api/v1/segments/{id}/lambdas        → Lambdas que usan un segmento

# ── Dashboard ─────────────────────────────────────────────────────────────────
GET    /api/v1/dashboard/kpis               → KPIs generales
GET    /api/v1/dashboard/heatmap            → Datos de calor por segmento
GET    /api/v1/dashboard/segments           → Uso por segmento
GET    /api/v1/dashboard/providers          → Distribución por proveedor de fibra

# ── Simulación DWDM ───────────────────────────────────────────────────────────
POST   /api/v1/simulation                   → Simular falla(s) de segmentos
POST   /api/v1/simulation/provider          → Simular falla por proveedor de fibra

# ── Capa ISP — Ruteadores ─────────────────────────────────────────────────────
GET    /api/v1/routers                      → Lista ruteadores con interfaces
POST   /api/v1/routers                      → Crear ruteador
PUT    /api/v1/routers/{id}                 → Actualizar ruteador
DELETE /api/v1/routers/{id}                 → Eliminar ruteador
POST   /api/v1/router-interfaces            → Crear interfaz de ruteador
PUT    /api/v1/router-interfaces/{id}       → Actualizar interfaz
DELETE /api/v1/router-interfaces/{id}       → Eliminar interfaz

# ── Capa ISP — Proveedores ────────────────────────────────────────────────────
GET    /api/v1/isp-providers                → Lista proveedores ISP
POST   /api/v1/isp-providers                → Crear proveedor ISP
PUT    /api/v1/isp-providers/{id}           → Actualizar proveedor ISP
DELETE /api/v1/isp-providers/{id}           → Eliminar proveedor ISP

# ── Capa ISP — Flujos de tráfico ──────────────────────────────────────────────
GET    /api/v1/traffic-flows                → Lista flujos ISP (provider, ingress, egress, pgw, traffic_gbps)
PUT    /api/v1/traffic-flows/{id}           → Actualizar traffic_gbps de un flujo

# ── Capa ISP — Prioridades ISP ────────────────────────────────────────────────
GET    /api/v1/isp-priorities               → Lista prioridades por (egress_site, pgw)
PUT    /api/v1/isp-priorities/{id}          → Actualizar priority_level
POST   /api/v1/isp-priorities/reorder       → Intercambiar priority_level entre dos registros

# ── Simulación ISP ────────────────────────────────────────────────────────────
POST   /api/v1/simulation/isp-provider      → Simular falla ISP (proveedor + sitio_ingreso)
POST   /api/v1/simulation/lambda-traffic    → Simular falla de lambdas específicas
POST   /api/v1/simulation/router            → Simular caída de ruteador
GET    /api/v1/simulation/report            → Reporte completo: adecuación prioridades, lambdas críticas, providers críticos

# ── Reportes ──────────────────────────────────────────────────────────────────
GET    /api/v1/reports/{name}               → Descarga reporte (PDF/Excel/CSV)
```

---

## Bugs Corregidos en Este Archivo

- **Overlay Capa IP — connLine invisible** (`topology.js`): La línea que conecta el badge del ruteador con el nodo DWDM no se veía. Causa: la línea estaba dentro del badge y heredaba su transform incorrectamente. Fix: mover `connLine` como hermano del badge dentro del grupo del nodo, con coordenadas `(0,0) → (offset.dx, offset.dy)` en el espacio del grupo, añadida **antes** del badge para respetar z-order.
- **Drag en grafo ISP arrastraba nodos conectados** (`isp_layer.js`): `simulation.alphaTarget(0.3).restart()` reactivaba todas las fuerzas incluso con `fx/fy` anclados. Fix: detener la simulación al iniciar el drag y actualizar posiciones directamente en el DOM (sin pasar por ticks), iterando `linkSel` manualmente.
- **Selector "Sitio de ingreso" ignoraba toggle ID/Nombre** (`simulation.js`): Las opciones del `<select>` de sitio se generaban una sola vez. Fix: función `repopulateSiteSel()` que regenera las opciones leyendo `_simLabel` en cada cambio de proveedor o de toggle.
- **`interfaces_count * 100` en simulación ISP** (`simulation.js`): Al cambiar `TrafficFlow.interfaces_count` por `traffic_gbps`, el handler del selector de sitio ISP y la tabla de flujos afectados seguían usando el campo eliminado. Fix: usar `f.traffic_gbps || 0` directamente en ambos lugares.
- **`renderRouterResults` usaba estructura de respuesta incorrecta**: La función esperaba `traffic_gbps_affected`, `isis_rerouting`, `affected_lambdas` como objetos con `service_status`. El backend retorna `affected_gbps`, `isis_options`, `affected_lambdas` como lista de strings. Fix: reescribir la función para adaptarse a los campos reales del endpoint.

---

## Pendientes / Decisiones Futuras

- [x] Ingresar coordenadas lat/lon de cada sitio — **COMPLETADO** en `seed.py` (32 sitios con coordenadas reales)
- [x] Visualizar contorno de México en mapa geográfico — **COMPLETADO** con `mexico.geojson` local + `d3.geoMercator`
- [x] Overlay Capa IP en topología (grafo lógico y mapa geográfico) — **COMPLETADO**: badges de ruteadores con línea de conexión al nodo DWDM; elipses de proveedores ISP con relleno sólido, arrastrable independientemente del ruteador; posiciones guardadas en `localStorage` (`isp-badge-offsets`, `isp-cloud-offsets`)
- [x] Guardado de posiciones en topologías lógicas — **COMPLETADO**: grafo DWDM (`dwdm-graph-positions`), grafo ISP (`isp-graph-positions`); botones "💾 Guardar posiciones" y "↺ Restablecer layout"
- [x] CRUD de Ruteadores y Proveedores ISP — **COMPLETADO**: endpoints en `backend/app/api/isp.py`; pestaña "🖧 Ruteadores" y "🌐 Proveedores ISP" en sección "Gestión de Red"
- [x] Simulación ISP — selector de sitio de ingreso — **COMPLETADO**: muestra nombre o ID según toggle; se actualiza al cambiar proveedor o toggle
- [x] Agregar sitios MSOMEX05 (MSO Tultitlan KIO) y MSOMER01 (MSO Merida) — **COMPLETADO** en `seed.py`
- [x] Agregar Axtel como proveedor ISP — **COMPLETADO** (color `#C2410C`; brand `axtel` en interfaces)
- [x] Tabla de prioridades ISP por PGW — **COMPLETADO**: modelo `ISPPriority`, 36 registros, endpoint GET/PUT/reorder, panel editable en Capa IP/ISP con badges 1/2/3
- [x] Tráfico ISP real en Gbps por PGW — **COMPLETADO**: `TrafficFlow.traffic_gbps` + `TrafficFlow.pgw`; 49 flujos; matriz actualizada con columna PGW y valores reales
- [x] Eliminar sección "Utilización Histórica" — **COMPLETADO**: modelo `LambdaUtilization` eliminado, endpoints y UI removidos
- [x] Simulación de falla de ruteador — **COMPLETADO**: modo "Falla Ruteador" en `simulation.js`; endpoint `POST /simulation/router`; muestra flujos ISP, lambdas, fallback BGP e ISIS rerouteo
- [x] Reporte de análisis completo — **COMPLETADO**: `GET /simulation/report`; adecuación de prioridades, ranking lambdas críticas, ranking providers; exportación CSV
- [ ] Coordenadas de MSOMEX05 (lat=16.9, lon=-100.1) son aproximadas — verificar y corregir desde UI "Gestión de Red"
- [ ] Documentar proveedores de fibra exactos por segmento (campo `fiber_provider` ya disponible en estructura)
- [ ] Registrar amplificadores ópticos (OLAs/EDFAs) intermedios cuando se tenga la información
- [ ] Definir rutas de protección 1+1 para todas las lambdas (`protection_route` ya disponible; actualmente solo KIO y Cirion las tienen definidas)
- [ ] Definir política de alertas cuando un segmento supere el 80% (≥77 lambdas de 96 posibles)
- [ ] Lambda "Cd Juarez to Toluca" — color pendiente de asignar (campo `color` vacío en `seed.py`)
