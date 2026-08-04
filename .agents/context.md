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

  - `POST /contacts` — primer contacto / engagement phone-first; avanza `lifecycle_stage` + CAPI opcional.

  - `POST /quotes` | `POST /direct-sales` — crear venta (también avanza stage).

  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source`.



## Identidad + ciclo de vida CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers`.

- `lifecycle_stage`: `curious` → `engaged` → `quoted` → `customer` (monotónico). `lost` solo manual en admin.

- `intent`: `event` | `direct` | `unknown`. Historial en `client_stage_events`.

- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); menú Eventos/Barriles/Humano → `intent_selected` (engaged).



## Ultimos Cambios



### 03-08-2026 (Sesión 37) — CAPI producción verificado

- `META_CAPI_ACCESS_TOKEN` en Vercel Production (valor = Events Manager CAPI token, no Ads CLI).
- Token se lee en runtime en `metaCapiService` (no const en `config.ts`).
- Verificado end-to-end: `POST /api/v1/contacts` → `metaEventSent: Lead` / `Contact`.
- Bot WA → CRM + CAPI operativo.



### 03-08-2026 (Sesión 36) — CRM lifecycle stages

- Schema: `clients.lifecycle_stage/intent/notes/tags/timestamps` + `client_stage_events`; backfill desde quotes.
- `advanceClientStage` + wiring contacts / createQuoteCore / confirmQuote.
- Admin: filtros por etapa, badge, notes/tags, cambio manual (+ lost), timeline.
- Bot WA: `createContactViaApi` + sync curious/engaged en `ESPERANDO_INTENCION`.
- CAPI: Lead/Contact estables por cliente (`lead_client_{id}` / `contact_client_{id}`).



### 03-08-2026 (Sesión 35) — Web Pixel + CAPI

- CAPI también en cotizaciones/ventas **web** (además de WhatsApp): mismo `event_id` que Pixel (`lead_{token}` / `purchase_{token}`) para dedupe Meta.
- Confirmación de evento → CAPI Purchase; cookies `_fbc`/`_fbp` en Server Actions. Admin no dispara CAPI.



### 03-08-2026 (Sesión 34) — CRM Identity Lifecycle

- DB identifiers/touchpoints/merge_logs; clientService; `POST /api/v1/contacts`; metaCapiService; admin UI; merges Jenniffer/Juan; backups con RLS.



### 03-08-2026 (Sesión 33)

- **Meta Ads CLI**: 2 campañas **PAUSED** listas para CAPI:

  - `Leads WA Eventos | CAPI` (`120249106504230069`) — CBO **$8/día**, Pixel Lead.

  - `Leads WA Barriles | CAPI` (`120249106504370069`) — CBO **$2/día**.

- Snapshot: `C:\Users\FaRu\.meta-ads-cli\capi_campaigns_ready.json`



---

*Ultima actualizacion: 03-08-2026 (Sesión 37)*
