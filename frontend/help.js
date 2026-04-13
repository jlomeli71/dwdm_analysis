/**
 * help.js — Página de documentación / guía de la aplicación
 */

export async function renderHelp(container) {
  container.innerHTML = `
<div class="help-page">

  <!-- Encabezado -->
  <div class="help-header">
    <div class="help-header-icon">⬡</div>
    <div>
      <h1 class="help-title">Guía de la Aplicación</h1>
      <p class="help-subtitle">
        La aplicación está diseñada para explorarse de forma intuitiva.
        Esta guía describe brevemente cada módulo y señala las interacciones menos evidentes.
      </p>
    </div>
  </div>

  <!-- Módulos -->
  <div class="help-grid">

    <!-- Topología -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">🗺</span>
        <div>
          <div class="help-card-title">Topología</div>
          <div class="help-card-route">#topology</div>
        </div>
      </div>
      <p class="help-card-desc">
        Visualización interactiva de la red. Muestra los sitios (nodos) y los
        segmentos de fibra (enlaces), con las lambdas activas sobre cada tramo.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--blue">Grafo lógico</span>
          Distribución libre por fuerzas. Los nodos son arrastrables.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Mapa geográfico</span>
          Nodos posicionados sobre el contorno real de México. Zoom y paneo con
          scroll y arrastre. El botón <strong>Centrar México</strong> resetea la vista.
          Las posiciones ajustadas se guardan con <strong>💾 Guardar posiciones</strong>.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Lambdas</span>
          Cada lambda es una línea de color. Segmentos compartidos muestran un haz
          de líneas paralelas. Al pasar el cursor sobre una línea aparece un tooltip
          con nombre, capacidad y ruta de protección.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Selección</span>
          El panel derecho lista todas las lambdas. Al hacer clic en una, el resto
          se atenúa para resaltar solo su trayectoria. Se pueden seleccionar varias.
        </li>
        <li>
          <span class="help-tag help-tag--purple">Sitios</span>
          Círculo azul = sitio propio (MSO / NFO). Rectángulo morado punteado = tercero
          (KIO, Cirion). El hover muestra región, ciudad y lambdas que pasan por ese nodo.
        </li>
        <li>
          <span class="help-tag help-tag--green">Exportar</span>
          Botones en la barra: <strong>PNG</strong> (captura visual),
          <strong>yEd GraphML</strong> (edición en yEd), <strong>DOT</strong>
          (Graphviz).
        </li>
      </ul>
    </div>

    <!-- Sitios & Lambdas -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">🗄</span>
        <div>
          <div class="help-card-title">Sitios &amp; Lambdas</div>
          <div class="help-card-route">#crud</div>
        </div>
      </div>
      <p class="help-card-desc">
        Gestión completa del inventario: alta, edición y baja de sitios y lambdas
        con validaciones en tiempo real.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--blue">Sitios</span>
          Filtrables por tipo (propio / tercero) y región. El ID y el nombre del
          sitio son editables de forma independiente.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Baja de sitio</span>
          El sistema valida que no existan segmentos activos antes de eliminar.
          Si los hay, muestra la lista de lambdas afectadas y bloquea la operación.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Lambdas</span>
          Filtrables por nombre, origen o destino. Cada fila muestra el color
          identificador de la lambda.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Color único</span>
          Al crear o editar una lambda, el color hex se valida contra las demás
          lambdas activas para evitar duplicados visuales.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Segmentos</span>
          El editor de segmentos permite definir par de sitios, fibra
          (<strong>ruta_1</strong> o <strong>ruta_2</strong>), proveedor y
          capacidad. <code>ruta_1</code> y <code>ruta_2</code> entre los mismos
          sitios son físicamente independientes.
        </li>
        <li>
          <span class="help-tag help-tag--green">Protección 1+1</span>
          Cada lambda puede referenciar otra lambda como ruta de respaldo.
          Se usa en la simulación de fallas para detectar pérdida total de servicio.
        </li>
      </ul>
    </div>

    <!-- Dashboard -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">📊</span>
        <div>
          <div class="help-card-title">Dashboard</div>
          <div class="help-card-route">#dashboard</div>
        </div>
      </div>
      <p class="help-card-desc">
        Visión global del estado de la red: métricas de capacidad, uso de
        segmentos y distribución por proveedor.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--blue">KPIs</span>
          Tarjetas superiores con totales: sitios propios, terceros, lambdas
          activas, capacidad total (Tbps) y segmentos únicos.
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Segmentos críticos</span>
          Tabla ordenada por número de lambdas. Muestra el porcentaje de uso
          sobre la capacidad máxima de 96 canales C-band.
        </li>
        <li>
          <span class="help-tag help-tag--orange">Alerta de capacidad</span>
          Se activa visualmente cuando un segmento supera el 80 % de uso
          (≥ 77 lambdas de 96 posibles).
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Gráficas</span>
          Barras de capacidad por segmento y lambdas por segmento; pastel de
          distribución de segmentos por proveedor de fibra.
        </li>
        <li>
          <span class="help-tag help-tag--purple">Solapamiento</span>
          Tabla de lambdas con mayor coincidencia de segmentos: identifica
          puntos de falla compartida entre rutas.
        </li>
      </ul>
    </div>

    <!-- Simulación -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">⚡</span>
        <div>
          <div class="help-card-title">Simulación de Fallas</div>
          <div class="help-card-route">#simulation</div>
        </div>
      </div>
      <p class="help-card-desc">
        Analiza el impacto de fallas en la red sin modificar la base de datos.
        Todos los resultados son en memoria.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--orange">Falla simple</span>
          Selecciona un segmento para simular su corte y ver qué lambdas quedan
          afectadas.
        </li>
        <li>
          <span class="help-tag help-tag--orange">Falla doble</span>
          Selecciona dos segmentos simultáneos para evaluar escenarios donde la
          ruta principal y la de protección fallan a la vez.
        </li>
        <li>
          <span class="help-tag help-tag--red">Falla por proveedor</span>
          Simula la caída de todos los segmentos de un proveedor de fibra
          (p. ej., todos los tramos AT&amp;T).
        </li>
        <li>
          <span class="help-tag help-tag--green">Análisis 1+1</span>
          Por cada lambda afectada indica si pierde solo la ruta principal
          (protección activa) o también su respaldo (servicio caído).
        </li>
        <li>
          <span class="help-tag help-tag--cyan">Mapa de calor</span>
          Los segmentos del grafo se colorean según su nivel de impacto en la
          simulación.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Reporte</span>
          El resultado incluye lambdas afectadas, capacidad perdida (Gbps / Tbps)
          y lista de segmentos críticos sin protección.
        </li>
      </ul>
    </div>

    <!-- Reportes -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">📄</span>
        <div>
          <div class="help-card-title">Reportes</div>
          <div class="help-card-route">#reports</div>
        </div>
      </div>
      <p class="help-card-desc">
        Exporta la información de la red en distintos formatos para documentación
        o análisis externo.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--blue">General</span>
          Resumen de enlaces, lambdas, capacidad total y proveedores de fibra.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Segmentos</span>
          Detalle por segmento: uso, capacidad, lambdas que lo atraviesan y
          proveedor de fibra.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Proveedores</span>
          Segmentos y capacidad agrupados por proveedor de fibra arrendada.
        </li>
        <li>
          <span class="help-tag help-tag--blue">Simulación</span>
          Exporta el resultado de la última simulación ejecutada, incluyendo el
          análisis de protección 1+1.
        </li>
        <li>
          <span class="help-tag help-tag--green">Formatos</span>
          Cada reporte disponible en <strong>PDF</strong>, <strong>Excel (.xlsx)</strong>
          y <strong>CSV</strong>.
        </li>
      </ul>
    </div>

    <!-- Admin BD -->
    <div class="help-card">
      <div class="help-card-header">
        <span class="help-card-icon">🗃</span>
        <div>
          <div class="help-card-title">Admin BD</div>
          <div class="help-card-route">puerto 5001 /admin</div>
        </div>
      </div>
      <p class="help-card-desc">
        Explorador directo de la base de datos. Abre en una pestaña separada y
        se conecta al backend Flask en el puerto 5001.
      </p>
      <ul class="help-list">
        <li>
          <span class="help-tag help-tag--purple">Tablas disponibles</span>
          Sitios, Lambdas, Segmentos y la tabla de relación Lambda-Segmento.
        </li>
        <li>
          <span class="help-tag help-tag--orange">Uso recomendado</span>
          Inspección y corrección puntual de datos. Para el flujo normal, usar
          el módulo <strong>Sitios &amp; Lambdas</strong> que aplica las
          validaciones de negocio.
        </li>
        <li>
          <span class="help-tag help-tag--red">Precaución</span>
          Los cambios en Admin BD son directos a la base de datos y omiten las
          validaciones de la API (colores únicos, integridad de segmentos, etc.).
        </li>
      </ul>
    </div>

  </div><!-- /help-grid -->

  <!-- Conceptos clave -->
  <div class="help-concepts">
    <h2 class="help-concepts-title">Conceptos clave</h2>
    <div class="help-concepts-grid">
      <div class="help-concept">
        <div class="help-concept-term">Lambda</div>
        <div class="help-concept-def">
          Circuito óptico de 100 Gbps sobre una longitud de onda del espectro C-band.
          Puede atravesar múltiples segmentos de fibra de distintos proveedores.
        </div>
      </div>
      <div class="help-concept">
        <div class="help-concept-term">Segmento</div>
        <div class="help-concept-def">
          Tramo de fibra física entre dos sitios. Un par de sitios puede tener
          <code>ruta_1</code> y <code>ruta_2</code>: fibras físicamente independientes
          del mismo proveedor.
        </div>
      </div>
      <div class="help-concept">
        <div class="help-concept-term">Protección 1+1</div>
        <div class="help-concept-def">
          Esquema de redundancia donde cada lambda crítica tiene una ruta de respaldo
          que no comparte segmentos físicos con la ruta principal.
        </div>
      </div>
      <div class="help-concept">
        <div class="help-concept-term">MSO / NFO</div>
        <div class="help-concept-def">
          <strong>MSO</strong> (Main Switch Office): nodo principal de conmutación.
          <strong>NFO</strong> (Nodo de Fibra Óptica): punto de empalme o
          interconexión de fibra arrendada.
        </div>
      </div>
      <div class="help-concept">
        <div class="help-concept-term">Capacidad máxima</div>
        <div class="help-concept-def">
          96 canales × 100 Gbps = <strong>9.6 Tbps</strong> por fibra. El sistema
          alerta cuando un segmento supera el 80 % de uso (≥ 77 lambdas).
        </div>
      </div>
      <div class="help-concept">
        <div class="help-concept-term">Sitio de tercero</div>
        <div class="help-concept-def">
          Punto de interconexión en instalaciones de otro operador (KIO Networks,
          Cirion). Se diferencia visualmente con borde punteado morado.
        </div>
      </div>
    </div>
  </div>

</div><!-- /help-page -->
`;
}
