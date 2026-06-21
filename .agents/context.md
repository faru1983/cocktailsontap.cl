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

### 21-06-2026 (Sesión 11)
- **Optimización de SEO Técnico y Datos Estructurados (JSON-LD)**:
  - Se configuró `metadataBase`, `canonical` y `twitter` (Twitter Cards) en el layout raíz de Next.js (`app/layout.tsx`).
  - Se inyectó un script JSON-LD de tipo `LocalBusiness` en el `RootLayout` (`app/layout.tsx`) utilizando los parámetros oficiales (`SITE_URL`, `LOGO_URL`, `WHATSAPP_NUMBER`) de `lib/config.ts`.
  - Se añadieron etiquetas `<h1>` semánticas y accesibles utilizando la clase `sr-only` en las páginas de entrada `/cotizar`, `/barriles` y `/eventos` para optimizar la jerarquía semántica para buscadores.
- **Archivos Modificados**: `app/layout.tsx`, `app/cotizar/page.tsx`, `app/barriles/page.tsx`, `app/eventos/page.tsx`, `.agents/context.md`.

### 21-06-2026 (Sesión 10)
- **Botón Flotante de WhatsApp en Eventos y Barriles**:
  - Se creó el componente `FloatingWhatsapp.tsx` en `components/shared/` para mostrar el botón flotante de WhatsApp de manera interactiva a los 20 segundos de cargada la página.
  - El componente tiene un botón de cerrar `(X)` que oculta el widget de forma inmediata.
  - El enlace a WhatsApp utiliza la variable preconfigurada `WHATSAPP_NUMBER` de `lib/config.ts` y envía el mensaje predefinido codificado: "Hola, estoy cotizando desde la pagina web y tengo algunas dudas.".
  - Se importó y renderizó el componente `FloatingWhatsapp` en las páginas públicas de cotización de eventos (`app/eventos/page.tsx`) y de compra directa de barriles (`app/barriles/page.tsx`).
- **Archivos Modificados/Creados**: `components/shared/FloatingWhatsapp.tsx` (Nuevo), `app/eventos/page.tsx`, `app/barriles/page.tsx`, `.agents/context.md`.

### 05-06-2026 (Sesión 9)
- **Unificación de Envíos de Correo Manual (Venta Desechable y Eventos)**:
  - Se corrigió un bug en la creación manual de cotizaciones (`/admin/quotes/new`) y en la vista de detalle de la orden (`/admin/quotes/[token]`) donde las "Ventas Desechables" (venta directa) enviaban incorrectamente la plantilla de "Cotización de Evento" y omitían enviar una copia al administrador.
  - Se eliminó la función redundante `resendOrderEmail` de `adminActions.ts`.
  - Se reemplazó su uso en `CreateQuoteManualClient.tsx` y `QuoteDetailClient.tsx` por la función principal `sendQuoteEmailAdmin`, la cual verifica correctamente si la orden es Venta Directa o Evento, seleccionando la plantilla adecuada (`ConfirmationEmail` vs `QuoteEmail`) y enviando siempre la copia de respaldo al administrador.
  - Se eliminó el botón redundante de "Reenvío Orden" en el dashboard de detalle, manteniendo únicamente el botón de "Enviar Email de Confirmación / Cotización" en la sección de Disparadores Manuales.
- **Archivos Modificados**: `app/admin/quotes/new/CreateQuoteManualClient.tsx`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/actions/admin/adminActions.ts`, `.agents/context.md`.

### 28-05-2026 (Sesión 8)
- **Resolución de Advertencia de Seguridad en Supabase (`public_bucket_allows_listing`)**:
  - Se eliminó la política `Public Access for Everyone` con operación `SELECT` en la tabla `storage.objects` que afectaba al bucket `product-images`.
  - Esta política amplia permitía que cualquier cliente listara todos los archivos del bucket. Al ser un bucket público (`public=true`), los archivos individuales ya son accesibles mediante su URL pública sin necesidad de políticas RLS adicionales en `storage.objects`, por lo que se pudo remover la política de forma segura para corregir la vulnerabilidad sin afectar la visualización de imágenes de productos en el frontend.
- **Archivos Modificados**: `.agents/context.md` y base de datos (Supabase).

### 28-05-2026 (Sesión 7)
- **Persistencia de Precios Recalculados en Base de Datos**:
  - Se corrigió un bug en `confirmQuote.ts` donde no se guardaban las columnas `total_normal_price`, `total_offer_price`, `shipping_cost` e `installation_cost` al actualizar el estado de la cotización de `draft` a `confirmed`. Esto causaba que la vista posterior a la confirmación cargara valores obsoletos de la base de datos (por ejemplo, omitiendo el costo de instalación de $50.000 para el Muro de Coctelería).
- **Cierre de Modal de Contrato tras Confirmación Exitosa**:
  - Se solucionó un bug en `EventQuoteView.tsx` y `DirectQuoteView.tsx` donde el modal de contrato "Finalizar Reserva" / "Finalizar Pedido" quedaba con el estado `showConfirmModal = true` tras confirmar correctamente. Al presionar "Ver Reserva/Pedido" (que apaga la pantalla de éxito), el modal volvía a renderizarse de fondo. Ahora se establece explícitamente en `false`.
  - Se difirió la llamada a `router.refresh()` mediante un `setTimeout` de 150ms para evitar condiciones de carrera en Next.js con el `router.replace` de query parameters, asegurando que `?confirmed=true` se mantenga y actualice de forma limpia en el navegador.
- **Archivos Modificados**: `app/actions/confirmQuote.ts`, `components/quote/EventQuoteView.tsx`, `components/quote/DirectQuoteView.tsx`, `.agents/context.md`.

### 28-05-2026 (Sesión 6)
- **Corrección de Sintaxis JSX y Tipados**: 
  - Se eliminó un tag de cierre `</div>` redundante en `EventQuoteView.tsx` que causaba que el compilador de TypeScript fallara debido a una estructura JSX rota.
  - Se removieron los tipados explícitos `any` en `EventQuoteView.tsx` y `confirmQuote.ts` para evitar advertencias y errores de ESLint.
- **Sincronización de Totales y Costos en Reservas**:
  - Se solucionó un bug en `confirmQuote.ts` donde el correo de confirmación de Resend y los eventos de Google Calendar se enviaban con totales de precios, costos de transporte y de instalación obsoletos (del borrador original). Ahora se asignan de manera explícita los valores recalculados en el servidor a `quoteToSync`.
  - Se agregaron llamadas a `router.refresh()` en `EventQuoteView.tsx` tras confirmar la reserva y al presionar "Ver Reserva" para forzar al router del cliente a invalidar el caché e hidratarse con los datos actualizados de la base de datos.
- **Archivos Modificados**: `components/quote/EventQuoteView.tsx`, `app/actions/confirmQuote.ts`, `.agents/context.md`.

### 28-05-2026 (Sesión 5)
- **Validaciones de Litros y Selección de Dispensador en Reserva**: Se implementó el control de volumen mínimo e incompatibilidad de tamaños en el enlace único de confirmación de cliente (`/cotizar/[token]`) tanto en frontend como en backend.
  - **Validaciones Cliente (`EventQuoteView.tsx`)**: Se agregaron alertas y bloqueo de confirmación si no se cumplen los litros mínimos (`PORTATIL_MIN_LITERS = 10` o `MURO_MIN_LITERS = 30`).
  - **Selector de Dispensador Simplificado**: El dispensador se renderiza como texto simple y, si se cumplen las condiciones físicas del Muro ($\ge$ 30L y sin barriles de 5L), se muestra un botón en forma de enlace de texto para alternar entre "Dispensador Portátil" y "Muro de Coctelería" (+$50.000 CLP de instalación).
  - **Filtros en Catálogo**: Al abrir el modal de catálogo, se filtran las opciones de 5L si el dispensador es Muro, y se ocultan los barriles de tamaño "desechable" y todos los ítems de la categoría "Otros" (congruente con la lógica del wizard de eventos).
  - **Validaciones Servidor (`confirmQuote.ts`)**: Se agregaron chequeos de seguridad (Zero Trust) en el backend que bloquean la confirmación si los litros o compatibilidades son violados.
- **Archivos Modificados**: `components/quote/EventQuoteView.tsx`, `app/actions/confirmQuote.ts`, `.agents/context.md`.

### 28-05-2026 (Sesión 4)
- **Corrección Lógica de Rendimientos (Litros Totales)**: Se solucionó el bug que sumaba los productos de la categoría "Otros" (hielo, vasos, decoraciones) al volumen total de litros en el pedido.
  - Se modificó `lib/wizardLogic.ts` (la función central `calculateSummaryData`) para excluir explícitamente a la categoría "Otros" del cálculo de `totalLiters`.
  - Se aplicó la misma exclusión en las vistas públicas de cotización (`EventQuoteView.tsx` y `DirectQuoteView.tsx`) que recalculaban los litros en tiempo real, garantizando que tanto la interfaz visual como los correos de Resend muestren el volumen correcto de litros y el rendimiento en cócteles.
- **Wizard Venta Directa**: Se modificó `DirectWizardCheckoutModal.tsx` cambiando el placeholder "Celular" por "WhatsApp", y moviendo el selector de "Comuna" justo después del campo de "Fecha de Entrega" para mejor flujo lógico en desktop.


### 28-05-2026 (Sesión 3)
- **Unificación de Pantallas de Éxito**: Se refactorizaron `DirectQuoteView.tsx` and `EventQuoteView.tsx` para eliminar la dependencia de los componentes gigantes `DirectWizardSuccess.tsx` y `EventWizardSuccess.tsx`. 
  - La pantalla temprana (Early Return) de "Éxito" se reutilizó tanto para cotizaciones/pedidos recién creados (`?new=true`) como para confirmaciones (`?confirmed=true`), logrando un estilo premium unificado.
  - Se configuró el título dinámico para que muestre "¡Pedido/Cotización recibido(a)!" o "¡Pedido/Reserva confirmada!" según el estado.
  - En Eventos, la vista `?new=true` muestra la tarjeta premium "¿Listo para hacer que suceda? 🥂", mientras que la vista `?confirmed=true` muestra la tarjeta verde de "Monto a depositar".
  - Se mantuvo la funcionalidad de "Ver Pedido/Reserva" usando `router.push` en lugar de `replace`, permitiendo que el historial de navegación funcione correctamente al presionar "Atrás".
  - Se sincronizó el estado local `showSuccessScreen` con la URL usando un `useEffect` para garantizar que la pantalla de éxito se vuelva a renderizar al navegar por el historial.

### 28-05-2026 (Sesión 2)
- **Rediseño Onepage del Wizard de Venta Directa (/barriles) y Mejoras de Responsividad**: Se transformó el wizard de compra directa de barriles desechables de un flujo secuencial de 3 pasos a una experiencia interactiva de una sola página (Onepage), unificando el estilo con el cotizador de eventos.
  - **Nuevo Checkout**: Se creó `DirectWizardCheckoutModal.tsx` consolidando el formulario de datos/despacho y el resumen del pedido en un único modal interactivo. El botón de confirmación adopta el estilo naranja de la marca (`bg-primary`) en lugar de colores de WhatsApp.
  - **Barra Fija Inferior (Sticky Bottom Bar)**: Se modificó `DirectWizardShell.tsx` eliminando la barra de progreso secuencial superior e incorporando una barra de navegación fija al pie de página que muestra los litros, ítems y subtotal, con un botón destacado de "Comprar".
  - **Simplificación del Catálogo**: Se modificó `DirectStep1Products.tsx` para remover el botón de carrito de categorías y el modal de carrito legacy.
  - **Limpieza de Código**: Se eliminaron los componentes obsoletos `DirectStep2Delivery.tsx` and `DirectStep3Summary.tsx`.
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
    - **Venta Directa Onepage y UI Móvil**:
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

---
*Ultima actualizacion: 28-05-2026 (Sesión 5)*
