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
- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); al elegir Eventos/Barriles parchea `intent` (`event`|`direct`) sin subir de stage; Interesado sigue en transiciones de flujo (`intent_selected`).
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin).

## Ultimos Cambios

### 07-08-2026 (Sesión 52) — Nombre CRM al cotizar + búsqueda admin

- Caso `ceciliacampospa@gmail.com`: cotización admin “Cecilia Campos” no actualizó el perfil (quedó pushName WA “Chichi Campos”) porque `resolveOrCreateClient` solo reemplazaba nombres placeholder.
- Fix: enriquecimiento de nombre/apellido en cotización web/admin (o si viene apellido); pushName WA sigue sin pisar un nombre bueno. Perfil Cecilia corregido a Cecilia Campos.
- Búsqueda de clientes en `/admin/quotes/new`: crasheaba/fallaba con `email` null (`c.email.toLowerCase`); ahora null-safe + busca por teléfono. `fetchAllClients` excluye merged.
- Hydration en ficha cliente: `toLocaleString('es-CL')` difería server/client (espacio en `a. m.`); fechas vía `formatDateCL` / `formatDateTimeCL` (Santiago, 24h).

### 07-08-2026 (Sesión 51) — Intent CRM en Curioso (Barriles/Eventos)

- Causa: el bot enviaba Curioso (`bot_started`) sin `intent`; Barriles casi nunca llegaba a Interesado con `direct`, así el CRM quedaba “Sin definir”.
- Fix en `whatsapp-cot`: `syncCrmCurious` manda `intent` si ya hay carril; nuevo `syncCrmIntent` al elegir Barriles/Eventos (o switch de carril); router defiere Curioso hasta después de la elección en el 1er mensaje.
- Web CRM sin cambios: `POST /api/v1/contacts` ya persistía `intent` en cualquier stage.

### 07-08-2026 (Sesión 50) — Fix temática “Otro” duplicada en admin

- Causa: en `/admin/quotes/new` el select de temática mapeaba `eventTypes` (ya incluye `Otro` en DB) y además hardcodeaba `<option value="Otro">`.
- Fix: se eliminó la opción hardcodeada en `CreateQuoteManualClient.tsx`. Wizard y detalle de cotización ya usaban solo `eventTypes`.

### 06-08-2026 (Sesión 49) — Nota IVA + auditoría WhatsApp

- Nota “Valores netos. No incluyen IVA.”: `CartModal`, `QuoteSummaryProducts`, emails (`EmailShared` + `ConfirmationEmail`).
- WhatsApp: contacto de negocio vía `WHATSAPP_NUMBER`/`WHATSAPP_URL` (`NEXT_PUBLIC_WHATSAPP_NUMBER`). `useCart` y `FloatingWhatsapp` alineados a esa fuente. Único hardcode: crédito “FaRu” en Footer (número del desarrollador, no del negocio). Admin usa `wa.me` al teléfono del cliente (correcto).

### 05-08-2026 (Sesión 48) — Eliminación permanente de clientes desde admin

- Perfil `/admin/clients/[id]`: botón **Eliminar** a la izquierda de **Editar Perfil**, con confirmación irreversible y aviso de cuántas cotizaciones se borrarán.
- Nueva Server Action autenticada `deleteClientPermanent`: elimina primero eventos de etapa y dependencias/cotizaciones; luego identifiers, touchpoints, merges y cliente.
- Validación: TypeScript sin errores; ESLint del componente OK (el action conserva errores históricos ajenos al cambio).

---

*Ultima actualizacion: 07-08-2026 (Sesión 52)*
