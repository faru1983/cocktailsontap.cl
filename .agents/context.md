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
- **Venta Directa (Desechables)**: Confirmado directo (sin draft).
- **Integraciones** (`/api/v1`): mismo dominio que la web; auth Bearer `INTEGRATION_API_KEY`.
  - `GET /catalog` — productos/precios/comunas (lectura para WhatsApp).
  - `POST /contacts` — primer contacto / engagement phone-first; avanza `lifecycle_stage` + CAPI opcional.
  - `POST /quotes` | `POST /direct-sales` — crear venta (también avanza stage). WhatsApp quotes siguen draft (sin `confirmNow`).
  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source`.
- **Admin** = canal real (wizard manual / teléfono): misma creación vía `createQuoteCore` + CAPI.

## Identidad + ciclo de vida CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers`.
- `lifecycle_stage`: `curious` → `engaged` → `quoted` → `customer` (monotónico). `lost` solo manual en admin.
- `intent`: `event` | `direct` | `unknown`. Historial en `client_stage_events`.
- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); al elegir Eventos/Barriles parchea `intent` (`event`|`direct`) sin subir de stage; Interesado sigue en transiciones de flujo (`intent_selected`).
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin): Contact (engaged), InitiateCheckout (quoted), Purchase (customer).

## Ultimos Cambios

### 14-08-2026 (Sesión 75) — Provincias RM y BE misma zona

- Comunas: `province_name` + override `shipping_carrier`/`blue_express_zone`. Admin agrupa por provincia; wizard igual (región + comuna).
- RM Santiago = propio; Cordillera/Chacabuco/Maipo/Melipilla/Talagante = Blue Express **misma zona** ($4.800 M / $5.400 L). Tarifas editables en Cobertura.
- Provincias CUT en todas las regiones (agrupación solo admin).

### 14-08-2026 (Sesión 74) — Tarifas Blue Express en Admin

- Admin → Cobertura: 4 montos (Centro/Extremo × M/L) en `site_settings.blue_express_home_rates`. Wizard y preview usan esa tabla (fallback en código).

### 14-08-2026 (Sesión 73) — Blue Express vs traslado propio

- `regions.shipping_carrier` (`own` | `blue_express`) + `blue_express_zone` (`centro` | `extremo`). RM propio; resto BE (Valparaíso/centro, extremo norte-sur).
- Barriles: 5L=1 barril; 1→M, 2–4→L, 5→L+M. Centro $7.300 / $9.200; extremo $14.500 / $17.000. Helper `lib/blueExpress.ts` + `resolveShipping`.
- Admin Cobertura: selector de transporte, preview 1/4/5 barriles. Catálogo API incluye `regions` (carrier/zona).

### 14-08-2026 (Sesión 72) — Cobertura: hereda región sin placeholder ilegible

- En comunas, si no hay override se muestra el valor de la región (o "—") como placeholder `slate-400`. El "L" y "$" suben de contraste. Tooltip explica que hereda.

---

*Ultima actualizacion: 14-08-2026 (Sesión 75)*
