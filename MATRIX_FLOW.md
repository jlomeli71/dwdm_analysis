# MATRIX FLOW.md — Flujos 

---

Revisa la información del proyecto y este archivo, planea los cambios y pregúntame para clarificar, antes de realizar cualquier cambio.

## Contexto
En los sitios:
- MSO Tlaquepaque
- MSO Toluca
- MSO Merida
- MSO Megacentro
- MSO Apodaca
- MSO Tultitlan KIO

Se tienen aplicativos que consumen trafico de servicios de Internet. Los principales aplicativos son 2 PGW (PGW1 y PGW2), que son los que procesan los flujos de los teléfonos celulares hacia internet. 
Se definio que cada PGW mandara su trafico a un ISP diferente en operación normal, y que hay tres niveles de redundancia. 

## Acciones

Se agrega matriz de prioridades en la tabla "prioridades_isp.csv". La tabla de puede reconfigurar para mostrase en la sección de Capa IP/ISP.
El 1 corresponde al proveedor primario para cada PGW, si falla este, el trafico se enruta al proveedor 2, y si falla el proveedor 2, y el 1 no esta disponible, el trafico se enruta al proveedor 3.

Agregar esta tabla de prioridades en la seccion de Capa IP/ISP, con posibilidad de mover las prioridades.

## Reglas

La salida de Cirion - MSO Tultitlan KIO, solo pueden ser usadas para los PGWs de MSO Tultitlan KIO
La salida de Axtel - MSO Merida, solo pueden ser usadas para los PGWs de MSO Merida
La salida de Cirion - Cirion Mirlo, de preferencia solo seria usada por los PGWs de MSO Tlaquepaque, pero podría ajustarse a compartir, dependiendo de los análisis encontrados.
La salida de Cirion - Cirion Zurich, de preferencia solo seria usada por los PGWs de MSO Megacentro y Toluca, pero podría ajustarse a compartir, dependiendo de los análisis encontrados.
La salida de Cirion - Cirion Humboldt, de preferencia solo seria usada por los PGWs de MSO Megacentro y Toluca, pero podría ajustarse a compartir, dependiendo de los análisis encontrados.

Hay que considerar que los proveedores de contenido como Amazon, Meta, Akamai, tienen prioridad, y si falla uno de estos, el trafico buscara salir por el proveedor de Internet que este definido, ya sea Arelion, Gold Data, Cirion, o Axtel.

Las métricas de ISIS, estand determinadas a un valor de referencia de 1 Tbps, es decir, si hubiera una capacidad de 1 Tbps, la métrica seria 1, por lo tanto para una interface de 100 Gbps, seria de 10, y para una interface de 200 Gbps seria una métrica de 5.

Las métricas de ISIS a proveedores de Internet no tienen relevancia en los cálculos, ya que la comunicación es con el protocolo BGP.
Las métricas de ISIS son relevantes para calcular enrutamientos en fallas de lambdas entre ruteadores, ya que entre ellos se tiene el protocolo ISIS.

En la simulaciones de fallas, se debe de considerar la posibilidad de la falla de un proveedor, de un ruteador, o de un segmento de lambda.

## Acciones

Ajustemos la tabla de "Trafico de uso" a la siguiente tabla que se proporciona en el archivo "traffic_flows_isp.csv". La tabla de puede reconfigurar para mostrase en la sección de Capa IP/ISP. Los valores dados son en Gbps.
Inicialmente estos valores propuestos son para llenar la tabla con valores de default estimados, pero pueden ser ajustados y guardados para hacer las simulaciones.

De momento eliminemos la información de "Utilización Histórica", agregaremos una función para esta función de otra manera mas automatizada.

Si es necesario reorganizar la información d la sección Capa IP/ISP, lo puedes hacer.

## Simulaciones
Hacer una simulación y reporte, para determinar si mis prioridades son adecuadas, de acuerdo al trafico de uso.
Hacer simulaciones y reporte de fallas de segmentos de lambda, y determinar que fallas son las mas criticas.
Hacer simulaciones y reporte de fallas de proveedores de Internet, y determinar que fallas son las mas criticas.

## Preguntas del Agente de Claude:
1. Sitios nuevos

El CSV menciona dos sitios que no existen en el modelo actual:

MSO Tultitlan KIO
MSO Merida
¿Los agrego como sitios nuevos? Si es así, necesito:

Site ID (¿MSOTLT01, MSOMID01?)
Ciudad, región y coordenadas (lat/lon) aproximadas para el mapa

Respuesta: estos sitios los agregue manualmente en la sección de "Gestion de Red", ya debe de existir. Los datos son:
---------
 "MSOMEX05": {
        "name": "MSO Tultitlan KIO",
        "type": "Tercero",
        "region": "Centro",
        "city": "Ciudad de Mexico",
        "lat": 16.912386,
        "lon": -100.092827,
    },
    "MSOMER01": {
        "name": "MSO Merida",
        "type": "Propio",
        "region": "Golfo",
        "city": "Merida",
        "lat": 20.9071169,
        "lon": -89.712532,
 
---------
2. traffic_flows_isp.csv está incompleto

El archivo solo contiene el texto 1 Tbps. ¿Falta la tabla con los valores de tráfico por sitio/PGW/proveedor? ¿Me puedes compartir o indicar los valores estimados en Gbps (formato similar al CSV de prioridades)?

Respuesta: Efectivamente el archivo estaba mal, ya puse el correcto, en este archivo: traffic_flows_isp.csv vienen los consumos.
Las prioridades estan en el archivo: prioridades_isp.csv.

3. Modelo de PGW

¿Los PGW1 y PGW2 deben ser entidades en la base de datos, o es suficiente con tratarlos como etiquetas (texto) dentro de la tabla de prioridades? Por ejemplo: ¿necesitas asociar un PGW a interfaces específicas del ruteador, o solo interesa saber la prioridad ISP de cada PGW por sitio?

Respuesta: es suficiente con tratarlos como etiquetas (texto) dentro de la tabla de prioridades. Asigna una interface del ruteador, si y solo si, si eso simplica el analisis y simulacion.

4. ISP providers faltantes

El CSV menciona:

Axtel - MSO Merida — Axtel existe como proveedor de fibra, pero ¿deberá agregarse también como proveedor ISP (con router en MSO Merida)?
Cirion - MSO KIO Tultitlan — ¿hay un ruteador Cirion en ese sitio, similar a los otros sitios Cirion?

Si, Axtel es un proveedor también de ISP. En Merida nos conectamos a un ruteador de Axtel.
Si, Cirion es un proveedor también de ISP quese conevcta directamente al MSO Tultitlan KIO. COnsdiera que tiene su ruteador Cirion para conectarse a ese sitio.

5. "Utilización Histórica" a eliminar

¿Se refiere específicamente a la sección de importación de Excel (.xlsx) y visualización de datos históricos en la pestaña Capa IP/ISP? ¿O también al endpoint de backend /upload/lambda-utilization?

Respuesta: Si, ambos.


6. Simulaciones con reporte

¿El reporte de simulaciones debe ser exportable (PDF/CSV), o es suficiente con mostrarlo en pantalla en la sección de Capa IP/ISP?

Respuesta: Si, ambos.