# SPEC_ISP.md — Requerimientos y Tareas: Capa IP/ISP

> Estado actualizado al 2026-04-16 (branch `new_feature_isp`)

---

## Contexto

La red cuenta con ruteadores marca Cisco y Juniper principalmente. Por simplicidad, se considera un ruteador por sitio.

### Variables del ruteador
- Nombre
- Marca (Cisco / Juniper / Cirion)
- Interfaces (múltiples): conectadas a lambdas (100 Gbps, con métrica ISIS) o a un proveedor ISP (100 Gbps)

### Proveedores ISP representados como elipses con color sólido
- Arelion · Gold Data · Cirion · Meta · Amazon · Akamai

### Ruteadores por sitio
| Marca | Sitios |
|---|---|
| Juniper | Cd Juárez, Nuevo Laredo, Reynosa Iusatel, KIO Networks Querétaro |
| Cisco | MSO Megacentro, MSO Apodaca, MSO Tlaquepaque, MSO Toluca |
| Cirion | Cirion Humboldt, Cirion Mirlo, Cirion Zurich |

### Capacidad ISP por sitio
| Proveedor | Sitio | Interfaces |
|---|---|---|
| Arelion | Cd Juárez | 3 × 100 Gbps (Juniper) |
| Gold Data | Nuevo Laredo | 2 × 100 Gbps (Juniper) |
| Gold Data | Reynosa Iusatel | 2 × 100 Gbps (Juniper) |
| Cirion | Cirion Humboldt | 1 × 100 Gbps por lambda |
| Cirion | Cirion Mirlo | 1 × 100 Gbps por lambda |
| Cirion | Cirion Zurich | 1 × 100 Gbps por lambda |
| Meta | KIO Querétaro | 2 × 100 Gbps (Juniper) |
| Amazon | KIO Querétaro | 2 × 100 Gbps (Juniper) |
| Akamai | KIO Querétaro | 2 × 100 Gbps (Juniper) |

---

## Tareas

### [COMPLETADO] Tarea 1 — Overlay Capa IP en Topología (grafo lógico y mapa geográfico)

- [x] Cruz de ruteadores dibujada como X inclinada
- [x] Badges de ruteadores posicionados al lado del nodo DWDM (desplazamiento configurable)
- [x] Línea punteada conectando el badge del ruteador con su nodo DWDM
- [x] Badges de ruteadores arrastrables independientemente del nodo DWDM
- [x] Elipses de proveedores ISP con relleno sólido del color del proveedor y texto blanco
- [x] Elipses de proveedores ISP arrastrables independientemente del ruteador
- [x] Posiciones de badges y elipses guardadas en `localStorage` (`isp-badge-offsets`, `isp-cloud-offsets`)

---

### [COMPLETADO] Tarea 2.1 — Grafo Lógico de Capa IP/ISP (`isp_layer.js`)

- [x] Cruz de ruteadores dibujada como X inclinada
- [x] Elipses de proveedores ISP con relleno sólido y texto blanco
- [x] Drag independiente: arrastrar un nodo no arrastra los conectados (simulación detenida en drag, DOM actualizado directamente)
- [x] Posiciones de nodos guardadas en `localStorage` (`isp-graph-positions`)
- [x] Botones "💾 Guardar posiciones" y "↺ Restablecer layout"

---

### [COMPLETADO] Tarea 2.2 — Matriz de capacidad y LAG

- [x] Matriz de capacidad: número de interfaces de 100 Gbps por proveedor y por sitio
- [x] Capacidad entre ruteadores inferida de las lambdas configuradas
- [x] Opción de LAG: agrupar interfaces múltiples en una interfaz lógica de mayor capacidad
- [x] Campo `interfaces_count` en flujos de tráfico para reflejar agrupación LAG

---

### [COMPLETADO] Tarea 3.3 — Matriz de uso y semáforo de utilización

- [x] Valores de utilización en Gbps (0 al máximo de la interfaz)
- [x] Semáforo: verde (<60%), amarillo (60–80%), rojo (>80%)
- [x] Compatible con interfaces LAG (múltiplos de 100 Gbps)

---

### [COMPLETADO] Tarea 4 — Simulación ISP: selector de sitio de ingreso

- [x] El selector de "Sitio de ingreso" en Simulación se filtra por proveedor ISP seleccionado
- [x] Respeta toggle ID/Nombre: muestra nombre del sitio o Site ID según configuración activa
- [x] Se actualiza dinámicamente al cambiar proveedor o al cambiar toggle

---

### [COMPLETADO] Tarea 5 — Importación de Excel de utilización mensual

- [x] Endpoint `POST /api/v1/upload/lambda-utilization` acepta `.xlsx`
- [x] Lee hoja `THP_Marzo26`; extrae hasta 6 meses por archivo
- [x] Detecta inconsistencias: lambdas de 200 Gbps (segunda lambda no registrada) → flag `DOUBLE_LAMBDA`
- [x] Detecta sitios desconocidos → flag `UNKNOWN_SITE`; se informa al usuario al cargar
- [x] Almacena historial por mes (upsert por `month` + `link_name`)
- [x] UI en sección Reportes para cargar el archivo mensualmente

---

### [COMPLETADO] CRUD de Ruteadores y Proveedores ISP

- [x] 8 endpoints REST en `backend/app/api/isp.py`:
  - `POST/PUT/DELETE /api/v1/routers`
  - `POST/PUT/DELETE /api/v1/router-interfaces`
  - `POST/PUT/DELETE /api/v1/isp-providers`
- [x] Frontend `api.js`: métodos `createRouter`, `updateRouter`, `deleteRouter`, `createRouterInterface`, `updateRouterInterface`, `deleteRouterInterface`, `createISPProvider`, `updateISPProvider`, `deleteISPProvider`
- [x] UI en sección "Gestión de Red" → pestaña "🖧 Ruteadores":
  - Tabla con nombre, sitio, marca, conteo de interfaces lambda/ISP
  - Modal de creación/edición con sub-tabla de interfaces
  - Eliminar interfaz existente directamente desde el modal (API call inmediata)
  - Agregar interfaces nuevas: tipo Lambda (con select de lambda y métrica ISIS) o ISP (con select de proveedor)
  - Cambio de tipo en filas nuevas actualiza dinámicamente las opciones del select
- [x] UI en sección "Gestión de Red" → pestaña "🌐 Proveedores ISP":
  - Tabla con color (swatch) y nombre
  - Modal de creación/edición con color picker sincronizado
  - Validación de dependencias en eliminación (interfaces/flujos activos → error 409)

---

## Pendientes

- [ ] Protección 1+1 en ISP: simular falla de dos proveedores simultáneos y calcular impacto agregado
- [ ] Simulación automática de fallas múltiples con reporte de escenarios más críticos
- [ ] Agregar lambda "Cd Juarez to Toluca" — color pendiente de asignar
- [ ] Interfaces a switches de Data Center (fuera de alcance actual, se agregarán en fase posterior)
- [ ] Historial de utilización: gráficas de tendencia por lambda y por proveedor a lo largo de los meses importados
