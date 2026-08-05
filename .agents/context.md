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



### 04-08-2026 (Sesión 45) — Hotfix: no forzar business_messaging en Lead/Contact

- Causa: al mandar `ctwa_clid` forzábamos `action_source: business_messaging`. Meta **rechaza** Lead/Contact con ese origen (solo acepta Purchase/LeadSubmitted) → CAPI 400 y Contact deja de aparecer en Events Manager.
- Fix: volver a `action_source: chat` (whatsapp) / website / phone_call. Se mantiene `custom_data.ctwa_clid` cuando exista.
- Nota: la campaña WA Lookalike sigue ACTIVE y generando conversaciones; el dataset en “0 ad sets” es porque Contact Lookalike está PAUSED y WA optimiza CONVERSATIONS (no el pixel).
- **Redeploy web** obligatorio para que prod deje de rechazar eventos.



### 04-08-2026 (Sesión 44) — CTWA clid → CRM/CAPI

- Bot (`whatsapp-cot`): `logic/meta-ctwa.js` extrae `externalAdReply.ctwaClid` (y señales opacas FB_Ads/ctwa_ad). Se guarda en sesión; `POST /contacts` manda `ctwaClid`. Backfill `ctwa_attribution` si el clid llega tras el Lead curious (resend Baileys).
- Web CAPI: con `ctwa_clid` usa `action_source: business_messaging` + `messaging_channel: whatsapp`.
- Tests: extractor + body contacts en `test-cot-api-mocked.mjs`. `npm run verify` OK.
- **Deploy**: bot + web (CAPI) para que Meta empiece a recibir clids en Contact/Lead WA.



### 04-08-2026 (Sesión 43) — Auditoría Meta Ads + Pixel/CAPI (CLI)

- **Activa**: `WA Eventos | Leads Lookalike` (`120249116759320069`) — ACTIVE, presupuesto **$50/día** USD, opt CONVERSATIONS→WhatsApp. Hoy ~$23 gastados, **14 conversaciones** (~$1.66 CPA), 11 `fb_pixel_lead` atribuidos. Creativos: Carlos > Seba > Carlos2 > Adry.
- **Pausada**: `Contact CAPI Eventos | Lookalike` (`120249116861310069`) — sigue PAUSED ($20/día).
- **Pixel `1739547250109039` (Datos Web COT)**: instalado en prod (chunk JS + host gate `cocktailsontap.cl`). Últimos 7d: PageView 1380 / Lead 26 / Contact 9 / Purchase 2. Últimas 48h: PV 323 / Lead 24 / Contact 9 / Purchase 2.
- **CAPI**: token OK (test POST `events_received:1` con `TEST92040` solo local). CRM hoy: 14 Lead curious + 5 Contact engaged + 1 Lead quoted. `META_CAPI_TEST_EVENT_CODE` está en `.env.local` — **no debe estar en Vercel prod**.
- **Gap atribución**: 0 `ctwa_clid`/`fbc`/`fbp` en touchpoints 14d; el bot aún no pasa referral CTWA al `POST /contacts`. Matching actual = teléfono hasheado + external_id.



### 03-08-2026 (Sesión 42) — Meta Ads WA Conversations + Contact Lookalike

- Borradas CAPI archivadas y el primer intento Website-Lead (ubicación sitio web bloqueada).
- **Pausada 1 (usar primero)**: `WA Eventos | Leads Lookalike` — OUTCOME_LEADS + **WHATSAPP** + CONVERSATIONS, $20/día, lookalike 1% eventos.
- **Pausada 2 (después)**: `Contact CAPI Eventos | Lookalike` — optimiza evento **Contact** (sitio web/CAPI; Meta no permite Contact+WhatsApp a la vez). Mismos creativos WA.
- Snapshot: `~/.meta-ads-cli/campaigns_recreated_wa_fix.json`.



### 03-08-2026 (Sesión 41) — Etiquetas WA default en engaged / quoted

- Bot (`whatsapp-cot`): al pasar a **engaged** aplica etiqueta Business **Cliente potencial** (`id=4`); al cerrar cotización evento o venta barril aplica **Nuevo pedido** (`id=6`).
- IDs descubiertos con `scripts/try-chat-label.mjs --watch` (labels.association). `ensure=false`: solo `addChatLabel`, sin `addLabel` (no pisa defaults de WA).
- SOS sigue con `Asistencia` (ensure=true). Cotizacion Barriles/Eventos quedan en config como opcionales.



---

*Ultima actualizacion: 04-08-2026 (Sesión 45)*
