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

### 06-08-2026 (Sesión 49) — Nota valores netos / sin IVA en carrito, resumen, emails y URL

- `CartModal` (landing): bajo el Total, texto “Valores netos. No incluyen IVA.”
- `QuoteSummaryProducts` (wizards, `/cotizar/[token]`): misma nota bajo el TOTAL.
- Emails: `PriceBreakdownSection` en `EmailShared` (Quote/Direct/Confirmation) + banner de monto en `ConfirmationEmail`.

### 05-08-2026 (Sesión 48) — Eliminación permanente de clientes desde admin

- Perfil `/admin/clients/[id]`: botón **Eliminar** a la izquierda de **Editar Perfil**, con confirmación irreversible y aviso de cuántas cotizaciones se borrarán.
- Nueva Server Action autenticada `deleteClientPermanent`: elimina primero eventos de etapa y dependencias/cotizaciones; luego identifiers, touchpoints, merges y cliente.
- Validación: TypeScript sin errores; ESLint del componente OK (el action conserva errores históricos ajenos al cambio).

### 05-08-2026 (Sesión 47) — Interesado solo con datos del flujo + snapshot CRM/CAPI

- Bot: Interesado **no** en menú welcome; solo al salir de intro Eventos/Barriles (`flow_entry_exit`).
- `POST /contacts` recibe `intent`, snapshot (invitados, comuna, etc.), `crmNote` → touchpoint + `clients.intent` + notas.
- CAPI Contact: `content_category` por intent, `num_guests`, comuna hasheada (`user_data.ct`).

### 05-08-2026 (Sesión 46) — Sin Lead CAPI en `curious`

- Decisión: Lead de primer mensaje (`curious`) inflaba conversiones de baja calidad en Meta (14 curious vs 5 engaged en CRM).
- `advanceClientStage`: CAPI lifecycle solo en `engaged` → Contact; `curious` sigue registrando CRM + touchpoint (`ctwa_clid`).
- `POST /api/v1/contacts`: `fireCapi` solo si touchpoint es engage (`intent_selected`, etc.).
- **Redeploy web** para prod; bot sin cambio de comportamiento (solo comentarios).

### 05-08-2026 (Sesión 45) — Corrección de action_source CAPI

- Causa: al mandar `ctwa_clid` forzábamos `action_source: business_messaging`. Meta **rechaza** Lead/Contact con ese origen (solo acepta Purchase/LeadSubmitted) → CAPI 400 y Contact deja de aparecer en Events Manager.
- Fix: volver a `action_source: chat` (whatsapp) / website / phone_call. Se mantiene `custom_data.ctwa_clid` cuando exista.
- Nota: la campaña WA Lookalike sigue ACTIVE y generando conversaciones; el dataset en “0 ad sets” es porque Contact Lookalike está PAUSED y WA optimiza CONVERSATIONS (no el pixel).
- **Redeploy web** obligatorio para que prod deje de rechazar eventos.

---

*Ultima actualizacion: 06-08-2026 (Sesión 49)*
