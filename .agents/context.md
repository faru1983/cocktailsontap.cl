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
- **Cancelar** (listado masivo o detalle) o **borrar permanente**: elimina eventos de Google Calendar (reserva + retiro, o calendario desechables). Limpia `google_event_id` / `google_pickup_event_id` si el borrado OK o 404.

## Flujos de Venta

- **Evento**: Draft -> Confirmado (via link único), **o** confirmación inmediata en wizard/admin (`confirmNow`: mismos datos obligatorios que al confirmar draft → `confirmQuoteCore`).
- **Venta Directa (Desechables)**: Confirmado directo (sin draft). **Calendar desechables** solo al registrar el primer pago en admin (no al crear pedido). Estados: `confirmed` → `in_delivery` (reparto propio o carrier Blue/custom) → `completed`. Email Resend al registrar pago y al marcar en reparto.
- **Integraciones** (`/api/v1`): mismo dominio que la web; auth Bearer `INTEGRATION_API_KEY`.
  - `GET /catalog` — productos/precios/**todas** las comunas activas + regiones + Blue Express (lectura para WhatsApp).
  - `POST /contacts` — primer contacto / engagement phone-first; avanza `lifecycle_stage` + CAPI opcional.
  - `POST /quotes` | `POST /direct-sales` — crear venta (también avanza stage). `POST /quotes` con `confirmNow: true` confirma la reserva igual que wizard/admin (`confirmQuoteCore`). Sin el flag, WhatsApp sigue en draft.
  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source`.
- **Admin** = canal real (wizard manual / teléfono): misma creación vía `createQuoteCore` + CAPI.

## Identidad + ciclo de vida CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers`.
- `lifecycle_stage`: `curious` → `engaged` → `quoted` → `customer` (monotónico). `lost` solo manual en admin.
- `intent`: `event` | `direct` | `unknown`. Historial en `client_stage_events`.
- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); al elegir Eventos/Barriles parchea `intent` (`event`|`direct`) sin subir de stage; Interesado sigue en transiciones de flujo (`intent_selected`).
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin): Contact (engaged), InitiateCheckout (quoted), Purchase (customer).

## Ultimos Cambios

### 02-10-2026 (Rama feat/event-wizard-redesign) — Rediseño del Wizard de Eventos (/eventos)

- **Flujo interactivo de 5 pasos**:
  1. Invitados (chips 30, 50, 80, 100, 150, personalizado con auto-avance).
  2. Intensidad de barra (2, 3 o 4+ tragos/persona sin selección por defecto; auto-avance).
  3. Propuesta sugerida con total de tragos, litros recomendados, variedades sugeridas y presupuesto estimado calculado con catálogo en vivo; inclusiones en $0; botón central "Elegir formato de dispensador".
  4. Formato de dispensador (Portátil o Muro de Coctelería con auto-avance sin barra inferior).
  5. Catálogo de cócteles interactivo con medidor de litros sugeridos vs seleccionados y botón de cotización.
- **Modal de checkout ("Resumen de Cotización")**:
  - Incorpora Fecha del Evento y Temática directamente en el formulario (sin tarjeta contenedora redundante).
  - Deduplicación de temática "Otro" (filtrado de duplicados y opción única al final con campo condicional para especificar temática).
- **Navegación en Shell**:
  - "Reiniciar" en esquina superior derecha restablece y lleva a `/eventos`.
  - "Volver al inicio" en paso 1 lleva a `/cotizar`.
- **Ocultamiento en scroll**:
  - Menú sándwich (`Navbar.tsx`) y botón flotante de WhatsApp (`FloatingWhatsapp.tsx`) ahora se ocultan suavemente al hacer scroll hacia abajo y reaparecen al subir o al llegar al tope (aplicado exclusivamente en `/eventos` y `/barriles`). Default de WhatsApp ajustado al borde derecho.


- Todas las secciones admin con pestañas persisten en `?tab=` al recargar (mismo patrón que Recetario).
- **Nuevo**: Productos (`categories` / `units` / `gallery`) y Configuración (`events` / `system` / `comunas`).
- **Alineado**: Gastos y Recordatorios usan el mismo helper (`lib/adminTabUrl.ts`): Link + `replaceState` (sin refetch al cambiar de pestaña).
- Ya tenían URL: Recetario, Estadísticas, Clientes (`?stage=`), Cotizaciones (`?status=`).
- Archivos: `lib/adminTabUrl.ts`, `app/admin/products/*`, `app/admin/settings/*`, `app/admin/gastos/*`, `app/admin/reminders/RemindersClient.tsx`, `app/admin/recetario/RecetarioClient.tsx`.

### 08-09-2026 (Sesión 119) — Recetario: pestañas con URL persistente

- Las pestañas de `/admin/recetario` (Producción, Recetas, Insumos) ahora viven en query `?tab=`.
- Recargar o compartir deja en la misma pestaña: `/admin/recetario?tab=recetas`, `?tab=insumos`. Producción es el default (sin query).
- Cambio de pestaña usa `history.replaceState` (sin refetch de insumos/recetas). El servidor lee `searchParams.tab` al cargar.
- Archivos: `app/admin/recetario/page.tsx`, `app/admin/recetario/RecetarioClient.tsx`.

### 08-09-2026 (Sesión 118) — Subida de oferta desechables + quitar banner lanzamiento

- **Precios**: `offer_price` de los 25 barriles 5L desechables (`is_disposable = true`) subió **+$5.000**. Precio lista sin cambios. Ej: Pisco Sour $47.990 → $52.990; Mojito Tradicional $39.990 → $44.990; Margarita $71.990 → $76.990.
- **Frontend `/barriles`**: se eliminó la tarjeta “Oferta de Lanzamiento / 20% de descuento por tiempo limitado”.
- **Gateway `/cotizar`**: se quitó el badge “20% OFF Lanzamiento” (misma campaña); queda “¡Nuevo Formato!”.
- Archivos: `app/barriles/page.tsx`, `components/wizard/CotizarGateway.tsx`. Datos en `product_prices` (producción). Caché catálogo 5 min.

### 08-09-2026 (Sesión 117) — Hardening seguridad post-auditoría

- **Zero Trust**: `createQuote` público solo `{ state, confirmNow? }`; catálogo vía `fetchAllProductData()`. Admin: `createQuoteAdmin` + `validateSession()`. `confirmQuoteCore` recalcula precios desde catálogo; confirm solo desde `status=draft` con UPDATE atómico.
- **Sesión admin**: cookie HMAC firmada (no hash estático del password); `timingSafeEqual`; `requireAdmin()` en RSC; logout con path `/admin`.
- **Rate limit**: `lib/rateLimit.ts` en login, cotizar, confirmar, `/api/v1`.
- **Higiene**: Zod whitelist en `updateQuoteAdmin` / productos / status; upload MIME allowlist; CSP + HSTS en `vercel.json`; escape fórmulas TXT export.
- **Vercel Firewall (manual)**: sugerido POST login 5/min/IP; `/api/v1/*` 60/min/IP.

### 08-09-2026 (Sesión 116) — Google Contacts phone-only desde admin

- Cotización, reserva y venta directa desde admin ya sincronizaban Google Contacts, pero se abortaba si no había email.
- Ahora se sincroniza con email y/o celular: si no hay `google_contact_id`, busca por teléfono/email; si no existe, crea el contacto y guarda el ID.
- El wizard público sigue exigiendo email para cotizar/confirmar; admin puede crear clientes solo con celular.
- Archivo: `lib/services/googleSyncService.ts`.

### 25-09-2026 (Sesión 121) — Fixes Google Calendar (temática 'Otro' + horario Chile) y autofill retiro admin

- **Google Calendar: Temática 'Otro'**: Al cotizar/confirmar con temática "Otro" (o ingresada manualmente), se guardaba `event_type_other` y `event_type_id = null`. En Google Calendar figuraba en `null` / vacío porque solo se leía `quote.event_type_id`. Ahora `variables.event_type` en [googleSyncService.ts](file:///d:/Webs/cocktailsontap.cl/lib/services/googleSyncService.ts) prioriza `quote.event_type_other` cuando `event_type_id` es null o 'Otro', o el nombre de `event_types(name)`. Además, se agregó `event_types(name)` a las consultas de admin para que las plantillas de Calendar muestren el nombre de la temática.
- **Google Calendar: Horarios post cambio de hora Chile**: Los horarios de reserva y retiro se estaban enviando con el offset `-04:00` hardcodeado (`${date}T${time}:00-04:00`), lo que provocaba un desfase de 1 hora al entrar el horario de verano de Chile (`-03:00`). Ahora [googleSyncService.ts](file:///d:/Webs/cocktailsontap.cl/lib/services/googleSyncService.ts) genera `dateTime` local (`${date}T${time}:00`) sin offset hardcodeado, permitiendo a la API de Google Calendar usar el `timeZone: 'America/Santiago'`, respetando automáticamente el horario exacto configurado.
- **Admin: Autollenado de fecha y horario de retiro**: En [CreateQuoteManualClient.tsx](file:///d:/Webs/cocktailsontap.cl/app/admin/quotes/new/CreateQuoteManualClient.tsx), al seleccionar o modificar la fecha del evento, se completan automáticamente la fecha de retiro al día siguiente (`calculateMaxPickupDate`) y el horario de retiro en `12:00 a 14:00`.
- Archivos: `lib/services/googleSyncService.ts`, `lib/types.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/new/CreateQuoteManualClient.tsx`.

### 01-10-2026 (Sesión 122) — Fixes Admin: Horario de Retiro en Cotizaciones, Regiones Nacionales en Admin y Categoría Padre en Gastos

- **Admin Cotizaciones: Edición de Horario de Retiro y "Todo el Día"**:
  - Se corrigió el desborde horizontal (overflow) en PC en el campo de horario de retiro dentro de `QuoteOperationalSummary.tsx` ampliando el grid a `minmax(180px, 1fr)`, asignando `span 2` y `minWidth: 220px` al bloque de horario, e incorporando `min-w-0` a los inputs.
  - Se corrigió la persistencia al editar cuando el retiro es "Todo el día" (mismo día o sin rango horario específico). Se normaliza a `'--:--'` en frontend y en el Server Action `updateQuoteAdmin`, y se actualizó `UpdateQuoteAdminSchema` en `lib/types.ts` para aceptar `pickup_time`, `pickup_date`, `event_date` y `dispenser` con transformaciones limpias a `null` si vienen vacíos.
- **Admin Crear Cotización: Selección de todas las regiones de Chile**:
  - En `RegionComunaFields.tsx`, cuando `variant === 'admin'`, se listan todas las regiones activas del país ordenadas por `display_order`, manteniendo a la Región Metropolitana como selección predeterminada.
  - El wizard público del cliente (`/cotizar`) continúa filtrado estrictamente según la disponibilidad del servicio (`filterRegionsForService`).
- **Admin Gastos: Modificación de categoría principal en subcategorías**:
  - En `app/actions/admin/gastosActions.ts`, se actualizó `updateExpenseSubcategory` para permitir modificar `category_id`, actualizando a la vez los registros históricos en la tabla `expenses` (`WHERE subcategory_id = ...`) para mantener la integridad relacional.
  - En `app/admin/gastos/GastosClient.tsx`, se reemplazó el inline text input por un modal de edición completo que permite renombrar la subcategoría y reasignar su categoría padre mediante un selector.
- Archivos: `lib/types.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/admin/quotes/[id]/QuoteOperationalSummary.tsx`, `components/ui/RegionComunaFields.tsx`, `app/actions/admin/gastosActions.ts`, `app/admin/gastos/GastosClient.tsx`.

### 01-10-2026 (Sesión 123) — Landing: Rediseño sección cócteles a formato Carta informativa

- **Rama**: `feature/landing-carta-cocteles`.
- **Enfoque informativo**: Se transformó `components/sections/CoctelesSection.tsx` en una "Carta" elegante y minimalista a 2 columnas, eliminando la duplicidad del flujo de compra (carrito, `useCart`, `ProductCatalog`, selector de tamaños y precios) de la landing `/`.
- **Contenido y estilo**: Título "Nuestros Cócteles" para total consistencia con el navbar y enlaces del sitio. Copy enfocado en calidad artesanal, frescura de insumos y preparación sin esperas, con insignias de beneficios (100% Natural, Listos para servir, Calidad Premium).
- **Filtro de categorías**: Se excluye la categoría `Otros` de la carta, ya que corresponde a complementos/insumos de compra desechable (hielos, vasos, etc.) y no a cócteles.
- **Balanceo visual en PC**: Se estructuró la carta en dos columnas simétricas: columna izquierda para 'Cocktails' (13 variedades) y columna derecha para 'Combinados' (6 variedades) + 'Mocktails' (6 variedades), eliminando el espacio en blanco y logrando un balance 50/50 perfecto en PC.
- **Llamados a la Acción (CTA)**: Tarjeta final que invita a celebrar con dos accesos directos hacia `/eventos` y `/barriles`.
- Archivo: `components/sections/CoctelesSection.tsx`.

### 01-10-2026 (Sesión 124) — Atribución Meta Ads CAPI 360° (Click ID fbc y fbp persistente)

- **Captura Server-Side resistente a Safari ITP (`proxy.ts`)**:
  - Se amplió el matcher del proxy para interceptar visitas a páginas públicas.
  - Al recibir `?fbclid=...`, el proxy fija automáticamente la cookie HTTP oficial de primer dominio `_fbc = fb.1.<ts>.<fbclid>` (90 días, `SameSite=Lax`, Secure en prod) y fija `_fbp` si no existe.
- **Captura y Respaldo Client-Side (`lib/attribution.ts` + `MetaPixel.tsx`)**:
  - `initClientMetaAttribution`: captura `fbclid` de la URL, sincroniza cookies `_fbc` / `_fbp` y respalda en `localStorage` (`cot_meta_fbc`, `cot_meta_fbp`, `cot_meta_fbclid`).
  - Se ejecuta en el montaje de `MetaPixel.tsx` y en cada cambio de ruta.
- **Formularios y Server Actions (Eventos y Barriles)**:
  - En `DirectWizardShell.tsx` (barriles) y `EventWizardShell.tsx` (eventos), `createQuote` recibe `fbc` y `fbp`.
  - En `DirectQuoteView.tsx` y `EventQuoteView.tsx`, `confirmQuote` envía `fbc` y `fbp`.
  - En `createQuoteCore.ts` y `confirmQuoteCore.ts`, se leen cookies/parámetros, se registra el touchpoint en la tabla `client_touchpoints` con `meta_fbc` / `meta_fbp` y se pasa a `advanceClientStage`.
  - Herencia automática: confirmaciones días después rescatan el `meta_fbc` histórico de `client_touchpoints` para `Purchase` CAPI.
- **API v1 (`/api/v1/quotes` y `/api/v1/direct-sales`)**:
  - Se ampliaron `IntegrationEventQuoteSchema` e `IntegrationDirectSaleSchema` en `lib/integrationSchemas.ts` para aceptar `fbc`, `fbp` y `ctwaClid`.
  - `lib/integrationApi.ts` y los routes HTTP reenvían estos parámetros a `createQuoteCore`.
- Archivos: `lib/attribution.ts`, `proxy.ts`, `components/shared/MetaPixel.tsx`, `app/actions/createQuote.ts`, `lib/services/createQuoteCore.ts`, `lib/services/confirmQuoteCore.ts`, `lib/types.ts`, `lib/integrationSchemas.ts`, `lib/integrationApi.ts`, `app/api/v1/quotes/route.ts`, `app/api/v1/direct-sales/route.ts`, `components/wizard/direct/DirectWizardShell.tsx`, `components/wizard/events/EventWizardShell.tsx`, `components/quote/DirectQuoteView.tsx`, `components/quote/EventQuoteView.tsx`.

### 02-10-2026 (Sesión 125) — Rediseño sin fricción del Wizard de Eventos (/eventos)

- **Rama**: `feat/event-wizard-redesign`.
- **Objetivo**: Eliminar la sobrecarga cognitiva inicial del primer paso de `/eventos`, postergando fecha y temática para el checkout y ofreciendo un cálculo de propuesta y presupuesto estimado transparente e instantáneo.
- **Flujo de 5 Pasos**:
  1. **Paso 1: Invitados (`EventStepGuests.tsx`)**: Chips táctiles rápidos de un toque (`[30] [50] [80] [100] [150] [Personalizado]`) con avance automático suave o selector numérico.
  2. **Paso 2: Tragos p/p (`EventStepDrinks.tsx`)**: Tarjetas de elección guiada (Barra Complemento 2 tr/p, Recomendado Estándar 3 tr/p con badge dorada, Personalizado 4+ tr/p) con cálculo en vivo de cócteles totales.
  3. **Paso 3: Propuesta Sugerida (`EventStepProposal.tsx`)**: Cálculo automático de cobertura (cócteles totales, litros sugeridos y variedades recomendadas), presupuesto estimado ($ total y por cóctel) usando promedios reales del catálogo (`calculateEstimatedProposal`), y cuadrícula de beneficios/inclusiones a costo $0 con modal descriptivo.
  4. **Paso 4: Dispensador (`EventStepDispenser.tsx`)**: Comparativa visual entre Dispensador Portátil ($0 instalación) y Muro de Coctelería ($50.000 instalación) con imágenes, características, modal ampliado y advertencia amigable si la sugerencia es <30L.
  5. **Paso 5: Catálogo de Cócteles (`EventWizardCatalog.tsx`)**: Selección de cócteles del catálogo con barra de progreso de litros sugeridos.
  6. **Checkout Modal (`EventWizardCheckoutModal.tsx`)**: Los datos del evento removidos del paso 1 (Fecha tentativa y Temática) se integraron en el formulario final junto a Nombre, Apellido, Email, WhatsApp, Región y Comuna.
- **Lógica y Hooks (`lib/wizardLogic.ts`, `hooks/useWizard.ts`)**:
  - `calculateSmartConfig`: ahora retorna `varietiesCount` y `counts` de barriles.
  - `calculateEstimatedProposal`: nueva función para estimar presupuestos de eventos de forma dinámica con precios del catálogo.
  - `useWizard`: se adaptó la guarda de refresco para eventos y se actualizó `validateStep` para soportar las reglas de los 5 pasos y el formulario final.
- **Archivos creados/modificados**:
  - Creados: `components/wizard/events/EventStepGuests.tsx`, `components/wizard/events/EventStepDrinks.tsx`, `components/wizard/events/EventStepProposal.tsx`, `components/wizard/events/EventStepDispenser.tsx`.
  - Modificados: `components/wizard/events/EventWizardShell.tsx`, `components/wizard/events/EventWizardCatalog.tsx`, `components/wizard/events/EventWizardCheckoutModal.tsx`, `lib/wizardLogic.ts`, `hooks/useWizard.ts`.

---

*Ultima actualizacion: 02-10-2026 (Sesión 125)*
