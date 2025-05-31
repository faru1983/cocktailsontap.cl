# Cocktails on Tap Chile - Página Interactiva y Sistema de Cotización

## 🚀 Resumen General

Este proyecto es una aplicación de página única (SPA) para "Cocktails on Tap Chile". Funciona como una página de aterrizaje interactiva que muestra servicios y productos, e incluye un sistema de cotización del lado del cliente. El sistema permite a los usuarios seleccionar cócteles, especificar cantidades y tamaños, ver una cotización dinámica y enviar los detalles de su evento junto con la cotización a través de WhatsApp y a un backend de Google Sheets.

---

## 🛠️ Tecnologías Principales

* **HTML5**: Estructura el contenido y el diseño de la página web.
* **CSS3**: Estiliza la aplicación, gestiona el diseño, la responsividad y las animaciones. Utiliza variables CSS para la tematización.
* **JavaScript (ES6+)**: Maneja todo el comportamiento dinámico, las interacciones del usuario, la gestión de datos y las integraciones externas.

---

## 📁 Estructura de Archivos

El núcleo del proyecto reside en tres archivos principales:

* `index.html`: El documento HTML principal que contiene la estructura de la página y las referencias a CSS, JavaScript y bibliotecas/servicios externos (Font Awesome, Google Fonts, Meta Pixel, Google Analytics).
* `estilos.css`: Contiene todas las reglas CSS, incluyendo definiciones de variables, reseteos, estilos base, estilos de componentes, animaciones y media queries para la responsividad.
* `scripts.js`: Contiene toda la lógica JavaScript para la interactividad, manipulación del DOM, manejo de datos y envíos de formularios.

---

## ✨ Características Técnicas Clave

* **Interfaz de Usuario Responsiva**: El diseño se adapta a diferentes tamaños de pantalla (escritorio, tableta, móvil) utilizando CSS Flexbox, Grid y media queries.
* **Renderizado Dinámico de Contenido**: Los testimonios y listados de productos son generados dinámicamente por JavaScript a partir de arrays de datos predefinidos.
* **Gestión de Estado del Lado del Cliente**:
    * El estado del carrito de compras (productos seleccionados, cantidades, tamaños) se gestiona en JavaScript y se persiste en `localStorage`, permitiendo que los detalles de la cotización se mantengan entre sesiones.
    * Los estados del enlace de navegación activo y de la pestaña de categoría de producto se gestionan dinámicamente.
* **Componentes Interactivos**:
    * **Navegación**: Desplazamiento suave a las secciones, resaltado del enlace activo al hacer scroll y un menú hamburguesa responsivo para móviles.
    * **Carrusel de Testimonios**: Carrusel de imagen/texto auto-avanzable y controlable manualmente con indicadores y animaciones de aparición gradual (`fadeIn`).
    * **Pestañas de Productos**: Permite a los usuarios filtrar productos por categoría ("Cocktails", "Mocktails").
    * **Sistema de Cotización**: Los usuarios pueden seleccionar tamaños de producto, ajustar cantidades y agregar artículos a un carrito persistente. El valor total de la cotización se actualiza en tiempo real.
    * **Modal de Diálogo**: Un modal muestra la cotización detallada y un formulario para los detalles del evento.
* **Manejo de Formularios y Envío de Datos**:
    * Los detalles del evento se capturan a través de un formulario dentro del modal de cotización.
    * Los datos de la cotización y del evento se formatean para su envío a WhatsApp.
    * Los datos de la cotización y del evento se envían a un backend de Google Sheets mediante una solicitud `POST` de `fetch` a una URL de Google Apps Script.
* **Arquitectura de Estilos**:
    * **Variables CSS**: Uso extensivo de propiedades personalizadas CSS para la tematización (colores, fuentes, espaciado), permitiendo actualizaciones de estilo sencillas.
    * **Animaciones y Transiciones**: Animaciones CSS sutiles y transiciones mejoran la experiencia del usuario en elementos interactivos como botones, iconos sociales, imágenes de productos y modales.

---

## ⚙️ Desglose Detallado de Funcionalidades

### `estilos.css` - Estilización y Presentación

* **Tematización y Variables**: Define una paleta de colores a nivel raíz, configuraciones de tipografía, unidades de espaciado, radios de borde y estilos de sombra utilizando variables CSS para un diseño consistente.
* **Sistema de Layout**: Emplea Flexbox y CSS Grid para estructurar las principales secciones de la página como la barra de navegación, tarjetas de servicio, cuadrículas de productos y diseños de formularios.
* **Estilo de Componentes**: Proporciona estilos específicos para todos los componentes de la interfaz de usuario:
    * **Navbar**: Posicionamiento fijo, iconos sociales animados y estilos para la transformación del menú móvil.
    * **Sección Hero**: Fondo de video a pantalla completa con una superposición.
    * **Tarjetas (Servicios, Productos)**: Diseño de tarjeta consistente con efectos hover (transformaciones, cambios de sombra). Las tarjetas de producto incluyen zoom de imagen al pasar el cursor.
    * **Carrusel**: Estilos para los elementos de testimonio, controles de navegación e indicadores. Incluye una animación `fadeIn` para los testimonios activos.
    * **Resumen del Carrito**: Posicionamiento fijo (`sticky`) para permanecer visible mientras se desplaza por los productos. Incluye una animación `cartPulse` para el icono del carrito.
    * **Modal**: Superposición a pantalla completa con un cuadro de contenido centrado que se anima al entrar (`modalFadeIn`).
    * **Formularios**: Estilización personalizada para campos de entrada, menús desplegables de selección, áreas de texto y sus estados de foco.
* **Responsividad**: Implementa media queries en puntos de interrupción de `992px`, `768px` y `576px` para ajustar diseños, tamaños de fuente y visibilidad de elementos para una visualización óptima en diversos dispositivos.
    * Por ejemplo, los enlaces de navegación se colapsan en un menú hamburguesa en pantallas más pequeñas, y el número de columnas de la cuadrícula se ajusta.
* **Estilos de Utilidad**: Incluye un reseteo CSS básico y estilos base para elementos HTML comunes.
* **Comportamiento de Scroll**: Se utiliza `scroll-padding-top` para compensar el posicionamiento del scroll para los enlaces internos de la página, teniendo en cuenta la altura de la barra de navegación fija.

### `scripts.js` - Comportamiento Dinámico y Lógica

* **Manipulación del DOM y Manejo de Eventos**:
    * El script se inicializa después de que el DOM se carga completamente (`DOMContentLoaded`).
    * Selecciona varios elementos del DOM para adjuntar escuchadores de eventos y manipular contenido/estilos.
    * Maneja eventos de clic para interruptores de menú, enlaces de navegación, controles de carrusel, interacciones de productos (cantidad, tamaño, agregar al carrito), selecciones de pestañas, apertura/cierre de modales y envío de formularios.
    * Maneja eventos de scroll para actualizar el enlace de navegación activo.
* **Lógica de Navegación**:
    * Alterna clases para la visualización del menú móvil y la animación del icono.
    * Identifica la sección actual visible durante el scroll y aplica una clase 'active' al enlace de navegación correspondiente.
* **Lógica del Carrusel de Testimonios**:
    * `renderTestimonials()`: Puebla el carrusel con datos de testimonios de un array, creando elementos HTML para cada testimonio y su indicador correspondiente.
    * Gestiona el testimonio e indicador activo actual.
    * Implementa funciones `nextTestimonial` y `prevTestimonial` para la navegación manual.
    * Cuenta con una funcionalidad de auto-avance usando `setInterval`, que puede ser pausada al pasar el cursor por encima (`mouseenter`) y reiniciada (`mouseleave`, interacción con controles).
* **Catálogo de Productos y Filtrado**:
    * `renderProducts(category)`: Limpia y luego puebla la cuadrícula de productos basándose en la categoría seleccionada ('Cocktails' o 'Mocktails').
        * Cada tarjeta de producto muestra su nombre, descripción, una imagen, un menú desplegable para la selección de tamaño (que actualiza dinámicamente el precio mostrado), controles de entrada de cantidad y un botón "Agregar al Carrito".
    * Los datos del producto, incluyendo diferentes tamaños y sus respectivos precios, se almacenan en un array de objetos.
    * Los botones de las pestañas controlan la variable `currentCategory`, activando un re-renderizado de la lista de productos.
* **Lógica del Carrito de Compras y Cotización**:
    * **Array del Carrito (`cart`)**: Almacena objetos que representan los productos seleccionados, incluyendo su ID, nombre, tamaño seleccionado, precio y cantidad.
    * **`addToCart(product)`**: Agrega un producto al `cart`. Si ya existe un artículo idéntico (mismo ID y tamaño), se incrementa su cantidad; de lo contrario, se agrega un nuevo artículo. Activa una animación visual en el icono del carrito.
    * **`updateCart()`**: Recalcula y actualiza el recuento total de artículos y el monto total de la cotización que se muestran en la página (tanto en el resumen del carrito fijo como en el modal).
    * **Persistencia en `localStorage`**: El array `cart` se guarda en `localStorage` cada vez que se actualiza y se carga en la inicialización de la página, preservando la cotización del usuario entre sesiones.
    * **Control de Cantidad**: La cantidad del producto en las tarjetas y en el modal puede ajustarse, afectando el estado del carrito.
* **Gestión del Modal**:
    * **`renderCartItems()`**: Genera dinámicamente el HTML para cada artículo en el modal del carrito, mostrando detalles y proporcionando controles para ajustar la cantidad o eliminar artículos. Muestra un mensaje de "carrito vacío" si aplica.
    * El modal se muestra/oculta cambiando su estilo `display` y gestionando el `overflow` del body para prevenir el scroll del fondo.
* **Integraciones Externas**:
    * **`sendWhatsApp()`**:
        * Recopila datos de los campos del formulario de detalles del evento dentro del modal.
        * Construye una cadena de mensaje formateada que contiene todos los detalles del evento y un desglose línea por línea de los artículos cotizados (nombre, tamaño, precio total por ítem, cantidad) y el monto total.
        * Utiliza `toLocaleString('es-CL')` para formatear los precios en moneda chilena.
        * **Integración con Google Sheets**: Construye un objeto `formData` y envía una solicitud `POST` a una URL de Google Apps Script (`https://script.google.com/macros/s/.../exec`) con `formData` como JSON. Se utiliza `mode: 'no-cors'`.
        * **Redirección a WhatsApp**: Después de intentar el envío a Google Sheets, abre un enlace `wa.me` con el mensaje pre-llenado.

---
