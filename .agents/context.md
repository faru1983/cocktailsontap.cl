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
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin).

## Ultimos Cambios

### 11-08-2026 (Sesión 56) — Contrato legible en checkout confirmNow

- En `EventWizardCheckoutModal`, al marcar “Confirmar reserva ahora”: bloque scrollable “Contrato de servicio” (mismo copy que `EventQuoteView`) + checkbox de aceptación debajo.

### 11-08-2026 (Sesión 55) — Reserva confirmada al crear (wizard + admin)

- Checkbox opcional en checkout wizard eventos y cotización manual admin: `confirmNow`.
- Si activo: exige dirección/horarios/términos (web); crea draft y llama `confirmQuoteCore` (email confirmación salvo admin `skipEmail`, Calendar, CRM customer).
- Dominio: `lib/services/confirmQuoteCore.ts`; validación compartida `lib/confirmNowValidation.ts`.

### 10-08-2026 (Sesión 54) — Recordatorios automáticos + monitoreo

- `/admin/reminders`: tabs Pendientes / Plantillas / Monitoreo / Omitidos / Automatización.
- Plantillas con `trigger` + toggle `auto_enabled` (manual y auto conviven); `days_before` para draft o aniversario de última reserva (eventos/barriles).
- Cron `GET/POST /api/cron/reminders` (Bearer `CRON_SECRET`) + `vercel.json` diario Hobby; gate por enable + hora Santiago.
- Servicio `lib/services/reminderService.ts`; logs ampliados; `reminder_suppressions`; seed aniversario 20%.

### 10-08-2026 (Sesión 53) — Hydration avatar clientes (emojis WA)

- Error en `/admin/clients`: `first_name[0]` sobre pushNames con emoji → surrogate UTF-16 → hydration mismatch.
- Fix: `getAvatarInitial` + `formatDateCL` en listado.

---

*Ultima actualizacion: 11-08-2026 (Sesión 56)*
