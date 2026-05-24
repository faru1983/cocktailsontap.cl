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

### 24-05-2026 (Sesion 2)
- **Imágenes de Fondo en `/cotizar`**:
  - **Fondo de Eventos con IA**: Se generó una nueva imagen de fondo premium para el Servicio de Eventos (`public/assets/service_events.webp`) a partir de la imagen original. Se reemplazó el fondo exterior diurno por una escena elegante de boda/fiesta nocturna con guirnaldas de luces LED cálidas y bokeh de invitados, preservando la mesa y dispensadores del primer plano.
  - **Optimización de Compra Directa**: Se procesó la imagen del barril desechable (`public/assets/direct_purchase.webp`) convirtiéndola a WebP y comprimiendo su peso a ~22 KB, garantizando que el diseño del barril, colores, y logos permanezcan 100% inalterados.
  - **Diseño de Tarjetas en Gateway**: Se rediseñó el componente `components/wizard/CotizarGateway.tsx` para usar las nuevas imágenes de fondo, incorporando un efecto de zoom suave al hacer hover (`group-hover:scale-105 transition-transform duration-500`) y un overlay blanco semi-transparente (`bg-white/90 group-hover:bg-white/84`) para conservar la estética clara, limpia y el contraste nativo de la tipografía del sitio (`text-brand-text`). Los botones y badges mantienen los colores de marca originales (`text-primary`, `bg-primary/5` y `text-blue-600`, `bg-blue-50`), logrando una integración perfecta y premium.
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
*Ultima actualizacion: 24-05-2026 (Sesion 1)*
