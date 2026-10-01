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

### 08-09-2026 (Sesión 120) — Pestañas admin con URL en todo el panel

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

---

*Ultima actualizacion: 01-10-2026 (Sesión 122)*
