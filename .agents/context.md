# Contexto de Negocio - Cocktails on Tap

## Reglas Criticas de Calendario (Google Calendar)

### 1. Reserva de Evento
- **Con Hora**: El evento debe tener duracion 0 (hora de inicio y fin identicas).
- **Sin Hora**: Se marca como "Todo el dia". La fecha de fin en Google API debe ser el dia siguiente (exclusiva).

### 2. Retiro de Evento
- **Mismo dia que el evento**: Debe quedar siempre como **Todo el dia**.
- **Dia siguiente**:
  - Si el cliente ingresa un rango (ej: "12:00 a 14:00"), se usa ese rango exacto.
  - Si no hay rango, queda como duracion 0 en la hora de inicio.
  - Si no hay hora, queda como "Todo el dia".

### 3. Sincronizacion
- La base de datos es prioridad. Si Google o Resend fallan, el error se guarda en `comments` de la cotizacion para auditoria, sin bloquear al usuario.

## Flujos de Venta
- **Evento**: Draft -> Confirmado (via link unico).
- **Venta Directa (Desechables)**: Confirmado directo (sin draft).

## Ultimos Cambios

### 28-05-2026 (Sesión 4)
- **Corrección Lógica de Rendimientos (Litros Totales)**: Se solucionó el bug que sumaba los productos de la categoría "Otros" (hielo, vasos, decoraciones) al volumen total de litros en el pedido.
  - Se modificó `lib/wizardLogic.ts` (la función central `calculateSummaryData`) para excluir explícitamente a la categoría "Otros" del cálculo de `totalLiters`.
  - Se aplicó la misma exclusión en las vistas públicas de cotización (`EventQuoteView.tsx` y `DirectQuoteView.tsx`) que recalculaban los litros en tiempo real, garantizando que tanto la interfaz visual como los correos de Resend muestren el volumen correcto de litros y el rendimiento en cócteles.
- **Wizard Venta Directa**: Se modificó `DirectWizardCheckoutModal.tsx` cambiando el placeholder "Celular" por "WhatsApp", y moviendo el selector de "Comuna" justo después del campo de "Fecha de Entrega" para mejor flujo lógico en desktop.

### 28-05-2026 (Sesión 3)
- **Unificación de Pantallas de Éxito**: Se refactorizaron `DirectQuoteView.tsx` y `EventQuoteView.tsx` para eliminar la dependencia de los componentes gigantes `DirectWizardSuccess.tsx` y `EventWizardSuccess.tsx`. 
  - La pantalla temprana (Early Return) de "Éxito" se reutilizó tanto para cotizaciones/pedidos recién creados (`?new=true`) como para confirmaciones (`?confirmed=true`), logrando un estilo premium unificado.
  - Se configuró el título dinámico para que muestre "¡Pedido/Cotización recibido(a)!" o "¡Pedido/Reserva confirmada!" según el estado.
  - En Eventos, la vista `?new=true` muestra la tarjeta premium "¿Listo para hacer que suceda? 🥂", mientras que la vista `?confirmed=true` muestra la tarjeta verde de "Monto a depositar".
  - Se mantuvo la funcionalidad de "Ver Pedido/Reserva" usando `router.push` en lugar de `replace`, permitiendo que el historial de navegación funcione correctamente al presionar "Atrás".
  - Se sincronizó el estado local `showSuccessScreen` con la URL usando un `useEffect` para garantizar que la pantalla de éxito se vuelva a renderizar al navegar por el historial.

### 28-05-2026 (Sesión 2)
- **Rediseño Onepage del Wizard de Venta Directa (/barriles) y Mejoras de Responsividad**: Se transformó el wizard de compra directa de barriles desechables de un flujo secuencial de 3 pasos a una experiencia interactiva de una sola página (Onepage), unificando el estilo con el cotizador de eventos.
  - **Nuevo Checkout**: Se creó [DirectWizardCheckoutModal.tsx](file:///d:/Webs/cocktailsontap.cl/components/wizard/direct/DirectWizardCheckoutModal.tsx) consolidando el formulario de datos/despacho y el resumen del pedido en un único modal interactivo. El botón de confirmación adopta el estilo naranja de la marca (`bg-primary`) en lugar de colores de WhatsApp.
  - **Barra Fija Inferior (Sticky Bottom Bar)**: Se modificó [DirectWizardShell.tsx](file:///d:/Webs/cocktailsontap.cl/components/wizard/direct/DirectWizardShell.tsx) eliminando la barra de progreso secuencial superior e incorporando una barra de navegación fija al pie de página que muestra los litros, ítems y subtotal, con un botón destacado de "Comprar".
  - **Simplificación del Catálogo**: Se modificó [DirectStep1Products.tsx](file:///d:/Webs/cocktailsontap.cl/components/wizard/direct/DirectStep1Products.tsx) para remover el botón de carrito de categorías y el modal de carrito legacy.
  - **Limpieza de Código**: Se eliminaron los componentes obsoletos [DirectStep2Delivery.tsx](file:///d:/Webs/cocktailsontap.cl/components/wizard/direct/DirectStep2Delivery.tsx) and [DirectStep3Summary.tsx](file:///d:/Webs/cocktailsontap.cl/components/wizard/direct/DirectStep3Summary.tsx).
  - **Ajustes Responsivos en Móviles**: Se solucionó un problema de desbordamiento horizontal en celulares reduciendo el padding lateral estático en móviles de `p-8` a `p-4 sm:p-8` en resúmenes y pantallas de éxito, configurando la lista de datos bancarios con `flex-col sm:flex-row` para apilarse en pantallas angostas, y añadiendo `min-w-0` a los contenedores flex que muestran las URLs de seguimiento para que Next.js pueda truncar el texto correctamente sin ensanchar la pantalla.
- **Archivos Modificados/Creados**: `components/wizard/direct/DirectWizardCheckoutModal.tsx` (Nuevo), `components/wizard/direct/DirectStep1Products.tsx`, `components/wizard/direct/DirectWizardShell.tsx`, `components/wizard/direct/DirectWizardSuccess.tsx`, `components/wizard/events/EventWizardSuccess.tsx`, `components/quote/DirectQuoteView.tsx`, `components/quote/EventQuoteView.tsx`, `components/quote/QuoteSummaryProducts.tsx`, `components/quote/QuoteSummaryReservation.tsx`, `components/wizard/direct/DirectStep2Delivery.tsx` (Eliminado), `components/wizard/direct/DirectStep3Summary.tsx` (Eliminado), `.agents/context.md`.

### 28-05-2026 (Sesion 1)
- **Corrección en el Wizard de Compra Directa (/barriles) y Creación Manual**: Se solucionó un bug en la inicialización y reinicio del wizard de compra directa y en la creación manual desde el admin panel que provocaba fallos de validación o inconsistencias en la base de datos al guardar un pedido.
  - El error `state.dispenser: Invalid option: expected one of "portatil"|"muro"|"desechable"` ocurría porque `state.dispenser` se inicializaba y reiniciaba como una cadena vacía (`''`), lo cual no es un valor válido en el esquema `CreateQuoteSchema` de Zod.
  - Se modificó `hooks/useWizard.ts` para que, cuando el tipo de servicio inicial o actual sea `'direct'`, el valor de `dispenser` se establezca automáticamente en `'desechable'`, cumpliendo con la base de datos y validaciones.
  - Se modificó `app/admin/quotes/new/CreateQuoteManualClient.tsx` para que, al elegir "Venta Desechables" (direct) en la creación de cotizaciones manuales del admin:
    - El valor de `dispenser` en el estado de envío y el cálculo de instalaciones sugeridas se setee de manera consistente a `'desechable'`.
    - Se oculte visualmente el campo de sobreescritura "Valor Dispensador" por ser innecesario en ventas directas.
    - Se fuerce el valor de `installationCost` en `overrides` a `0` para evitar arrastrar montos en el submit.
    - **[07-04-2026] Venta Directa Onepage y UI Móvil**:
      - Se unificó "Dirección de Despacho" y "Programación de Despacho".
      - Se cambió "Generar Cotización" a "Generar Pedido".
      - Se integró el wizard de Venta Directa en una vista onepage similar a Eventos.
      - Se añadieron estilos responsivos en las pantallas de "Pedido Recibido", "Pedido Confirmado", reduciendo padding y tamaños de fuentes en mobile para evitar desbordes en celulares.
      - Se implementó un utilitario global `copyToClipboard` con fallback clásico para soportar copiado en contextos HTTP inseguros (como IPs locales) en todas las pantallas de éxito y vistas de cotización.
      - Se previno el error de hidratación (hydration mismatch) en SSR al renderizar dinámicamente URLs en el cliente a través de un estado `clientUrl` asignado dentro de un hook `useEffect`.
      - Se implementó persistencia del estado de confirmación en la URL (`?confirmed=true`) mediante `router.replace` al completar el pago/reserva, permitiendo que la pantalla de confirmación sobreviva a recargas.
      - Se unificó el diseño de datos bancarios dentro de los modales de confirmación para que siempre utilicen alineación en fila (`flex-row justify-between`).
      - Se modificaron los enlaces mostrados en las tarjetas de comprobante digital para que limpien dinámicamente los query parameters (`?new=true`, `?confirmed=true`) y se visualicen limpios.
    - Se modifique dinámicamente el texto del botón principal a "Generar Pedido" cuando el tipo de servicio es directo, y se mantenga "Generar Cotización" en eventos.
  - Se modificó `components/wizard/direct/DirectWizardSuccess.tsx` para agregar de forma explícita el número de WhatsApp oficial (`WHATSAPP_LABEL`) y botones directos de acción con enlaces pre-completados que abren la conversación para enviar el comprobante de transferencia y el link único del pedido.
- **Archivos Modificados**: `hooks/useWizard.ts`, `app/admin/quotes/new/CreateQuoteManualClient.tsx`, `components/wizard/direct/DirectWizardSuccess.tsx`, `components/wizard/events/EventWizardSuccess.tsx`, `components/quote/DirectQuoteView.tsx`, `components/quote/EventQuoteView.tsx`, `lib/utils.ts`, `app/cotizar/[token]/page.tsx`, `.agents/context.md`.

### 27-05-2026 (Sesion 1)
- **Reorganización Estructura Wizard**: Se reestructuró la carpeta `components/wizard` para separar semánticamente el flujo de eventos y el flujo de compra directa.
  - Se eliminaron archivos deprecados del flujo antiguo (`WizardShell.tsx`, `WizardStep1.tsx` al `6`).
  - Se movieron los componentes correspondientes a Live Quoter a la nueva subcarpeta `components/wizard/events`.
  - Se renombraron los componentes `LiveQuoter*` a `EventWizard*` (ej. `LiveQuoterShell` -> `EventWizardShell`) para igualar la convención usada en `direct/DirectWizard*`.
  - Se actualizaron las referencias cruzadas de importaciones y componentes renderizados, en particular `CotizarGateway.tsx` y `EventQuoteView.tsx`.
- **Reorganización de Componentes Globales**: Se movieron los archivos que estaban sueltos en la raíz de `components` (`Navbar.tsx`, `Footer.tsx`, `Carousel.tsx`, `FloatingCta.tsx`, `icons.tsx`) a una nueva carpeta `components/shared/` para mantener el directorio base limpio. Se actualizaron todas las referencias e importaciones en el proyecto.
- **Archivos Modificados**: `components/wizard/events/*`, `components/wizard/CotizarGateway.tsx`, `components/quote/EventQuoteView.tsx`, `components/shared/*`, `app/layout.tsx`, `app/page.tsx`, `.agents/context.md`.


### 24-05-2026 (Sesion 3)
- **Rediseño Premium en `/cotizar`**: Se mejoró radicalmente el diseño de las tarjetas de selección de servicio para resolver problemas de contraste. Se reemplazó el overlay blanco por un **diseño "Dark Glassmorphism"**. Las tarjetas ahora utilizan un gradiente oscuro (`bg-gradient-to-t from-black/95...`) con textos en blanco brillante y descripciones en `zinc-300` para legibilidad perfecta. Los íconos y botones inferiores ahora emplean fondos translúcidos con desenfoque (`bg-white/10 backdrop-blur-md`). Además, se corrigió el bug de contexto de apilamiento (`isolate`) que ocultaba las imágenes de fondo, y se agregaron micro-interacciones cinematográficas (zoom lento de la imagen y sombras dinámicas con los colores de la marca) cumpliendo plenamente con los estándares de diseño moderno del proyecto.
- **Archivos Modificados**: `components/wizard/CotizarGateway.tsx`, `.agents/context.md`.

### 24-05-2026 (Sesion 2)
- **Imágenes de Fondo en `/cotizar`**:
  - **Fondo de Eventos con IA**: Se generó una nueva imagen de fondo premium para el Servicio de Eventos (`public/assets/service_events.webp`) a partir de la imagen original. Se reemplazó el fondo exterior diurno por una escena elegante de boda/fiesta nocturna con guirnaldas de luces LED cálidas y bokeh de invitados, preservando la mesa y dispensadores del primer plano.
  - **Optimización de Compra Directa**: Se procesó la imagen del barril desechable (`public/assets/direct_purchase.webp`) convirtiéndola a WebP y comprimiendo su peso a ~22 KB, garantizando que el diseño del barril, colores, y logos permanezcan 100% inalterados.
  - **Diseño de Tarjetas en Gateway**: Se rediseñó el componente `components/wizard/CotizarGateway.tsx` para usar las nuevas imágenes de fondo. Se aplicó un overlay blanco semi-transparente estático de opacidad constante del 75% (`bg-white/75`) para conservar la estética clara y limpia del sitio.
- **Archivos Modificados**: `components/wizard/CotizarGateway.tsx`, `.agents/context.md`.


### 24-05-2026 (Sesion 1)
- **Wizard de Cotización en Vivo (Live Quoter)**:
  - **Muro y Dispensador (Mínimos)**: Se agregaron advertencias visuales sobre los mínimos de volumen requeridos para cada dispensador en `LiveQuoterConfig.tsx` (Muro: mínimo 30L; Dispensador Portátil: mínimo 10L).
  - **Volumen Sugerido**: Se simplificó y detalló la sugerencia de volumen en el paso 1 con una frase explicativa: "Para {invitados} invitados necesitas {litros}L para un promedio de {tragos} tragos por persona."
  - **Botón Cotizar**: Se configuró el botón "Cotizar" en `LiveQuoterCatalog.tsx` para estar siempre habilitado y permitir el acceso al resumen en todo momento, incluso con carrito vacío.
  - **Validación de Mínimos**: La validación de mínimos se trasladó al modal de Checkout (`LiveQuoterCheckoutModal.tsx`), impidiendo el envío si no se cumplen los requisitos del dispensador seleccionado.
  - **Rediseño Compacto de Checkout**: Se rediseñó el modal de checkout (`LiveQuoterCheckoutModal.tsx`) con un layout de 12 columnas en desktop y paddings reducidos en móviles para una visualización óptima en celulares. Se integró la información del evento (Fecha, Temática, Invitados) en un banner superior en lugar de una tarjeta completa, se añadió soporte de modo compacto a `QuoteSummaryProducts.tsx`, se configuraron los campos de Email y WhatsApp para mostrarse cada uno en su propia fila en todas las pantallas, y se eliminó por completo la función y opción de alternar el tipo de dispensador (Muro / Portátil) desde el resumen/checkout del frontend, removiendo la propiedad `onToggleDispenser` y limpiando los estilos interactivos.
  - **Fijación de Selección de Dispensador**: En `lib/wizardLogic.ts` se modificó el cálculo de `dispenserLabel` e `installationCost` para que reflejen siempre el dispensador seleccionado (ej: Muro) independientemente del total de litros. El control de requisitos mínimos ahora se gestiona exclusivamente inhabilitando el botón "Finalizar".
  - **Unificación Estética de Tarjetas y Campos**: Se estandarizó el diseño de selección activa en el Paso 1. Tanto la **Temática (OptionCard)**, el **Dispensador** y los **campos de entrada** (Fecha del evento y Temática Específica al estar llenos) ahora adoptan exactamente el mismo estilo de selección que los elementos de "Tu pack incluye": borde `border-primary`, fondo `bg-primary/5` y anillo `ring-2 ring-primary/20`. Adicionalmente, las tarjetas interactivas cuentan con un ícono de confirmación (`Check`) posicionado de forma absoluta al estar seleccionados.
  - **Cálculo de Volumen Sugerido Ajustado**: Se modificó la matemática que recomienda el volumen total en los Pasos 1 y 2. Ahora, el volumen total sugerido se calcula siempre redondeando la necesidad neta hacia arriba al múltiplo de **5L** más cercano (independiente del tipo de dispensador).
  - **Sugerencia de Barriles (Algoritmo de Distribución)**: Se rediseñó el algoritmo que determina qué combinación de barriles sugerir para el volumen calculado. El nuevo algoritmo evalúa múltiples combinaciones (uniformes, puramente codiciosas, y divididas equitativamente) priorizando las **distribuciones uniformes** (ej: 4 barriles de 10L en lugar de mezclas como 3 de 10L y 2 de 5L) y asegurando que la cantidad sugerida de barriles (variedades) coincida lo más cercano posible con los tragos elegidos por persona para maximizar la conveniencia y uniformidad.
  - **Corrección de Módulos (Imports)**: Se resolvieron los errores de importación TS/Next.js en `LiveQuoterShell.tsx` reemplazando los imports relativos de los componentes de wizard (`LiveQuoterConfig`, `LiveQuoterCatalog`, `LiveQuoterCheckoutModal`) por imports absolutos usando el alias `@/components/wizard/components/...`.
- **Archivos Modificados**: `components/wizard/LiveQuoterShell.tsx`, `components/wizard/components/LiveQuoterConfig.tsx`, `components/wizard/components/LiveQuoterCatalog.tsx`, `components/wizard/components/LiveQuoterCheckoutModal.tsx`, `components/wizard/WizardStep6.tsx`, `components/quote/QuoteSummaryProducts.tsx`, `components/quote/EventQuoteView.tsx`, `components/ui/OptionCard.tsx`, `lib/wizardLogic.ts`, `lib/config.ts`, `.agents/context.md`.

### 22-05-2026 (Sesion 1)
- **Estadisticas - Pestañas Mensual/Anual**: Se agregó soporte de pestañas en `/admin/estadisticas` para visualizar datos por `Estadística Mensual` y `Estadística Anual`.
- **Vista Anual**: La vista anual adapta el gráfico de tendencia a una visualización "mes a mes" de todo el año, oculta el selector de meses y actualiza las métricas comparativas para que midan el desempeño "vs año anterior".
- **Comunas y Listados**: Tanto en `/admin/quotes` como en `/admin/reminders`, cuando la comuna seleccionada es "Otra", ahora se muestra en las tablas y tarjetas directamente el texto ingresado por el cliente sin el prefijo "Otra". En `reminders` los nombres son clickeables y usan el ícono 🔗 para la vista pública de la cotización.
- **Email Reseñas**: Se eliminó cualquier valor hardcodeado o de fallback para `reviewLink` en el código (`app/actions/admin/adminActions.ts` y `app/admin/settings/page.tsx`). Ahora el sistema depende estrictamente del valor dinámico ingresado en el panel de configuración de Settings.
- **Estadísticas Operativas**: Se agregó una tercera pestaña en `/admin/estadisticas` llamada **Operaciones**, la cual muestra el **Histórico Completo** (ocultando el filtro mensual/anual). Muestra métricas logísticas clave como la proporción de *Tipos de Servicio* (Venta Directa vs Eventos), *Uso de Equipamiento* (Portátil vs Muro), las *Top Comunas*, y la *Rotación de Formatos* (conteo de barriles según litraje). Se actualizó `page.tsx` para hacer fetch de los campos `dispenser` y `service_type`.
- **Archivos Modificados**: `app/admin/estadisticas/page.tsx`, `app/admin/estadisticas/StatsClient.tsx`, `app/admin/reminders/RemindersClient.tsx`, `app/admin/quotes/QuotesListClient.tsx`, `app/admin/quotes/page.tsx`, `app/actions/admin/adminActions.ts`, `app/admin/settings/page.tsx`.

### 20-05-2026 (Sesion 1)
- **Google Calendar - Desactivación de Notificaciones**: Se modificó `lib/googleSync.ts` para desactivar el envío de invitaciones y notificaciones por correo electrónico al cliente (removiendo el parámetro `?sendUpdates=all` de la API de Google Calendar). Los logs de consola que hacían referencia a la variable eliminada `isReserva` se actualizaron para evitar errores de referencia.
- **Archivos Modificados**: `lib/googleSync.ts`.

### 17-05-2026 (Sesion 1)
- **Redirecciones - Vercel**: Se eliminaron las redirecciones `/agendar` y `/contratar` en `vercel.json`.
- **Redirecciones - Reseñas**: Se agregó la redirección `/reseñas` con destino a la búsqueda de opiniones en Google.
- **Archivos Modificados**: `vercel.json`.

### 14-05-2026 (Sesion 2)
- **Gastos - Iteracion Final**: `/admin/gastos` vuelve a lista mensual completa (sin paginacion al pie), manteniendo KPIs calculados con el total del mes.
- **Gastos - KPIs Ajustados**: Se ordenaron y renombraron KPIs para mostrar `Movimientos`, `Gastos Total Mes`, `Ingresos del mes` y `Utilidad del mes`.
- **Estadisticas - Header y Filtro**: `/admin/estadisticas` adopta cabecera estilo gastos, elimina tabs de rango y usa filtro unico por `Ano + Mes` con flechas y boton `Este mes`, persistido en `?month=YYYY-MM`.
- **Estadisticas V2**: Se agregaron comparativas `vs mes anterior` y `vs mismo mes del ano anterior` (porcentaje + monto base), KPIs ejecutivos, tendencia semanal y alertas del periodo.
- **Archivos Modificados**: `app/admin/gastos/page.tsx`, `app/admin/gastos/GastosClient.tsx`, `app/actions/admin/gastosActions.ts`, `app/admin/estadisticas/page.tsx`, `app/admin/estadisticas/StatsClient.tsx`.

---
*Ultima actualizacion: 28-05-2026 (Sesión 3)*
