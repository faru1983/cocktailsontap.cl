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
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin): Contact (engaged), InitiateCheckout (quoted), Purchase (customer).

## Ultimos Cambios

### 14-08-2026 (Sesión 68) — ViewContent en landings Eventos/Barriles

- Pixel `ViewContent` en `/eventos` y `/barriles` con `service` + `content_category` (mismo criterio que checkout/compra). Una vez por línea y pestaña.
- Home `/` y `/cotizar` no se etiquetan. PageView sigue genérico. Sin CAPI (visitante anónimo).
- Archivos: `lib/fpixel.ts`, `components/shared/MetaPixel.tsx`.

### 14-08-2026 (Sesión 67) — Cotización evento: Lead → InitiateCheckout

- CAPI + Pixel: cotización draft dispara `InitiateCheckout` (`initiateCheckout_{token}`) con `service` + `content_category` (`eventos`/`Eventos` o `barriles`/`Barriles`), `value` CLP, ítems y comuna.
- El mismo par identifica Contact (si hay intent), InitiateCheckout y Purchase. PageView no se etiqueta. Interesado WA sigue en `Contact`.
- Archivos: `clientLifecycleService.ts`, `metaCapiService.ts`, `createQuoteCore.ts`, `confirmQuoteCore.ts`, `EventQuoteView.tsx`, `fpixel.ts`.

### 12-08-2026 (Sesión 66) — Banco de imágenes: listado server-side

- El modal Galería salía vacío: `storage.list` con anon no tiene política SELECT en `product-images`. Ahora lista con service_role (`listProductImages`). Loading/error visibles.

### 12-08-2026 (Sesión 65) — Producto stub desde receta

- Alta desde receta: nombre + categoría, `is_active=false`, sin precios. Catálogo/wizard no lo ven.
- No se puede pasar a Publicado sin al menos un precio activo (el recetario no inventa precios).

### 12-08-2026 (Sesión 64) — Guardar receta: error visible

- Guardar no hacía nada: `required` en la línea vacía de insumo bloqueaba el submit y el aviso nativo no se veía. Validación en JS + mensaje en el modal. "Piscola Mistral Nobel 40°" no se creó.

---

*Ultima actualizacion: 14-08-2026 (Sesión 68)*
