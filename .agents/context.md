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

- **Evento**: Draft -> Confirmado (via link unico). Confirmacion siempre la hace el cliente.

- **Venta Directa (Desechables)**: Confirmado directo (sin draft).

- **Integraciones** (`/api/v1`): mismo dominio que la web; auth Bearer `INTEGRATION_API_KEY`.

  - `GET /catalog` — productos/precios/comunas (lectura para WhatsApp).

  - `POST /contacts` — primer contacto phone-first (sin cotización); touchpoint + CAPI opcional.

  - `POST /quotes` | `POST /direct-sales` — crear venta.

  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source`.



## Identidad CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers` (N emails/phones).

- `clients.email`/`phone` = espejo del primary; email nullable (WhatsApp sin email OK).

- Auto-merge + `client_merge_logs` si phone/email cruzan personas de forma segura; si no → `possible_duplicate`.

- Env CAPI: `META_CAPI_ACCESS_TOKEN` (+ opcional `META_CAPI_TEST_EVENT_CODE`).



## Ultimos Cambios



### 03-08-2026 (Sesión 35) — Web Pixel + CAPI

- CAPI también en cotizaciones/ventas **web** (además de WhatsApp): mismo `event_id` que Pixel (`lead_{token}` / `purchase_{token}`) para dedupe Meta.
- Confirmación de evento → CAPI Purchase; cookies `_fbc`/`_fbp` en Server Actions. Admin no dispara CAPI.
- **Pendiente ops**: token en Vercel; probar en Events Manager (TEST code); luego quitar test code en prod.


### 03-08-2026 (Sesión 34) — CRM Identity Lifecycle

- DB identifiers/touchpoints/merge_logs; clientService; `POST /api/v1/contacts`; metaCapiService; admin UI; merges Jenniffer/Juan; backups con RLS.



### 03-08-2026 (Sesión 33)

- **Meta Ads CLI**: 2 campañas **PAUSED** listas para CAPI:

  - `Leads WA Eventos | CAPI` (`120249106504230069`) — CBO **$8/día**, Pixel Lead.

  - `Leads WA Barriles | CAPI` (`120249106504370069`) — CBO **$2/día**.

- Snapshot: `C:\Users\FaRu\.meta-ads-cli\capi_campaigns_ready.json`



### 03-08-2026 (Sesión 32) — Análisis CRM / ciclo de vida (sin código)

- Análisis previo: upsert solo por email; sin CAPI. Resuelto en Sesión 34.



### 03-08-2026 (Sesión 31)

- Meta Ads review; CTA LEARN_MORE vía API con posts existentes no viable (app Dev).



---

*Ultima actualizacion: 03-08-2026 (Sesión 35)*


