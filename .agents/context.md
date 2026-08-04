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

- **Admin** = canal real (wizard manual / teléfono): misma creación vía `createQuoteCore` + CAPI.



## Identidad + ciclo de vida CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers`.

- `lifecycle_stage`: `curious` → `engaged` → `quoted` → `customer` (monotónico). `lost` solo manual en admin.

- `intent`: `event` | `direct` | `unknown`. Historial en `client_stage_events`.

- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); menú Eventos/Barriles/Humano → `intent_selected` (engaged).

- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin).


## Ultimos Cambios



### 03-08-2026 (Sesión 40) — CTWA Curioso + Engaged por estado del bot

- **Curioso**: primer mensaje (`bot_started`), incl. copy predefinido Meta.
- **Engaged** solo por **cambio de estado** (`notifyCrmOnBotStateChange`):
  - sale de `EVENTOS_RECOGIDA_DATOS` / `BARRILES_FILTRO_CANAL` → otro paso
  - o elige en menú welcome (`routerMenuShown`) → Eventos/Barriles/Humano
- Sin pushName: `Cliente +569…`.



### 03-08-2026 (Sesión 39) — Nombre WA no más "WhatsApp"

- Bot: `sanitizeWaPushName` (`~Mona 🐵` → `Mona 🐵`); sync tardío `profile_name` cuando pushName llega después.
- CRM: default placeholder `Cliente` (no `WhatsApp`); backfill si llega nombre real.
- Corregido cliente Mona (+56990618538); otros placeholder `WhatsApp` → `Cliente`.



### 03-08-2026 (Sesión 38) — CAPI centralizado en CRM + admin como canal

- `advanceClientStage` = **única puerta CAPI**: curious/engaged (Lead/Contact) + quoted/customer con `quoteToken` (Lead/Purchase + `value`).
- Admin cotización/venta manual dispara CAPI (`action_source: phone_call`); mismo tratamiento que web/WhatsApp.
- Quitado CAPI suelto de `createQuoteCore` y `confirmQuote`; wrappers `sendQuoteCreatedCapi` / `sendQuotePurchaseCapi` eliminados.
- `meta_event_sent` guarda `event_id` completo (`lead_client_*`, `lead_{token}`, `purchase_{token}`).



### 03-08-2026 (Sesión 37) — CAPI producción verificado

- `META_CAPI_ACCESS_TOKEN` en Vercel Production (valor = Events Manager CAPI token, no Ads CLI).
- Token se lee en runtime en `metaCapiService` (no const en `config.ts`).
- Verificado end-to-end: `POST /api/v1/contacts` → `metaEventSent: Lead` / `Contact`.
- Bot WA → CRM + CAPI operativo.



---

*Ultima actualizacion: 03-08-2026 (Sesión 40)*
