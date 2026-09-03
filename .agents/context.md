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

### 03-09-2026 (Sesión 104) — Overrides admin en costos y fechas

- `/admin/quotes/new`: email opcional para creación manual (se elimina requisito en UI y validación local).
- `/admin/quotes/new`: fecha libre para admin en venta directa (sin `min` y sin validación `validateDirectSaleDate` en cliente/servidor cuando `isAdmin`).
- Tracking Blue Express actualizado a `https://www.blue.cl/enviar/seguimiento?n_seguimiento=...` en admin, emails y vista pública.
- `/cotizar/[token]` ahora respeta `shipping_cost = 0` guardado en DB (no lo reemplaza por tarifa dinámica), permitiendo casos como “por pagar”, cortesía o ajuste manual.

### 03-09-2026 (Sesión 103) — Admin detalle: vista unificada sin pestañas

- `/admin/quotes/[id]`: una sola ficha visual (`QuoteOperationalSummary`) reemplaza resumen + pestañas Datos/Items/Pagos/Email.
- Barra de acciones unificada: cambio de estado, eliminar, email confirmación/cotización, Calendar, redactar email (modal), review.
- Modo edición global (Editar → Guardar/Cancelar): cliente, logística, dirección, productos, costos y notas en la misma ficha; guardado secuencial `updateQuoteAdmin` + `updateQuoteItemsAdmin`.
- Cobro integra historial de pagos, registrar pago y transferencia total; WhatsApp y link público movidos al header.

### 03-09-2026 (Sesión 102) — Admin detalle: resumen operativo completo

- `QuoteOperationalSummary` rediseñado como ficha completa del pedido (estilo «Información de Contacto» del link único).
- Nuevo: bloque Cliente (nombre, email, celular + copiar/WhatsApp/mailto), tarjeta Evento/Entrega (fecha, retiro, temática), stats (invitados, equipo, volumen, barriles).
- Pedido con precio por línea (`qty × size`, total línea + unitario) y sección «Cobro»: productos, transporte, instalación, descuento, total, pagado y saldo.
- Header con chip de estado de pago; despacho y notas mantienen su lugar. Solo estilos inline (sin `<style>`), grids responsivas `auto-fit`.

### 25-08-2026 (Sesión 101) — Supabase security linter (RLS + función geo)

- Alerta `rls_disabled_in_public`: RLS en `reminder_suppressions` (`20260825200000_...`).
- Warning `function_search_path_mutable`: `prevent_geo_delete` con `SET search_path = ''`.
- INFO `rls_enabled_no_policy` (20 tablas service-only): política explícita `deny_api_access` (`USING false`); migración `20260825210000_security_linter_fixes.sql`. Advisors en cero.

### 24-08-2026 (Sesión 100) — Wizard eventos: guía de pedido (tips consumo)

- Eliminada sugerencia de mezcla de barriles (`1 barril de 20L`, etc.) en paso 1 y 2.
- Nuevo helper `getEventConsumptionGuidance`: tips barra complemento (~2 tr/p) vs principal (3+ tr/p).
- Paso 1 (`EventWizardConfig`): bloque «Guía de pedido» con litros calculados + tips de referencia (resalta según slider).
- Paso 2 (`EventWizardCatalog`): barra inferior muestra tip activo + objetivo en litros.

---

*Ultima actualizacion: 03-09-2026 (Sesión 104)*
