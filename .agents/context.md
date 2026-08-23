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

### 23-08-2026 (Sesión 88) — Revert días hábiles Blue Express

- Eliminada configuración de días de entrega en Blue Express (admin, API catalog, `site_settings`, tipo `Comuna`).
- Calendario venta directa unificado (`input type="date"` nativo, mínimo 2 días). Copy del campo según carrier: reparto propio vs “Fecha de entrega en Blue Express” (`getDirectSaleDateFieldCopy`). Resumen de totales: línea `Blue Express (X días hábiles)` según zona; extremo **3 a 7 días hábiles**.

### 23-08-2026 (Sesión 87) — WhatsApp flotante: menos intrusivo y arrastrable

- `FloatingWhatsapp`: posición por defecto abajo-izquierda (alineado con menú hamburguesa), más pequeño, sin botón X.
- Arrastrable con puntero; la posición se guarda en `localStorage` y se respeta en `/eventos` y `/barriles`.
- z-index 90 para no competir con la barra del carrito (z-40) ni modales.

### 23-08-2026 (Sesión 86) — Admin cotización manual + éxito sin botones manuales

- Excepción mínimo 10L en eventos: solo admin (`allowAdminMinLitersOverride` en `confirmQuoteCore` vía `isAdmin`).
- Página de éxito `/admin/quotes/new`: sin botones manuales de Calendar ni email; correos automáticos como web/API.

### 19-08-2026 (Sesión 85) — Fix enum `in_delivery` + botón único En reparto

- Causa del error: el enum `quote_status` en Supabase no incluía `in_delivery` (migración local no aplicada; SQL usaba CHECK en vez de `ALTER TYPE`).
- Migración aplicada en prod: valor enum + columnas `dispatch_*`.
- Admin detalle: un solo botón **En reparto** (modal reparto propio / Blue Express / carrier + email); ya no aparece el cambio de estado genérico duplicado.

### 18-08-2026 (Sesión 84) — Venta directa: pago, calendario y despacho

- Calendar desechables solo tras registrar pago (no al crear pedido web/WhatsApp).
- Admin: transferencia total en 1 clic, glosas predefinidas, email Resend al registrar pago.
- Estado `in_delivery` (En reparto): propio, Blue Express o carrier custom + tracking; email al cliente.
- Migración: `dispatch_*` en `quotes`. Ver `supabase/migrations/20260818120000_direct_sale_fulfillment.sql`.

### 17-08-2026 (Sesión 83) — Recetario: resumen de producción con desglose de barriles

- En `/admin/recetario` → Producción → cotizaciones, el resumen muestra `20L Mojito (4x5L)` en lugar de `Mojito: 20 L`.
- Desglose por formato solo si hay más de un barril; mezcla de tamaños como `1x10L + 2x5L`. WhatsApp alineado.

### 14-08-2026 (Sesión 82) — Eventos: pitch de litros con guía de reparto

- Tras p/p, la recomendación ya no es solo “X litros a completar”. Explica *cómo armarlo*: 2–3 sabores, más litros al favorito, desglose en barriles del formato (5/10L o 10/20/30L) y rendimiento.

### 14-08-2026 (Sesión 81) — Eventos: p/p + rendimiento antes de precios

- Tras invitados no se envía el catálogo. Se muestra la *buena referencia* (2 / 3+ p/p), el rendimiento de barriles y se pregunta cuántos cócteles por persona.
- Con la respuesta, se recomienda el volumen y el menú pasa a *Ver Precios y Cotizar* / duda. La imagen de precios sale al elegir 1.

---

*Ultima actualizacion: 23-08-2026 (Sesión 87)*
