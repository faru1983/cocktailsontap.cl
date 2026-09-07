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

### 07-09-2026 (Sesión 114) — Productos ocultos del recetario

- `products.hide_from_recipes`: extras de venta (hielo, decoración, bombillas) siguen en catálogo y no aparecen en Recetario como «sin receta».
- UI Productos: botón ojo + checkbox en ficha. Recetario filtra esos productos al crear receta.
- Ya marcados: **Hielo Cubo**, **Hielo Frappe**, **Decoracción Limón**, **Decoracción Naranja**, **Decoración Menta Fresca**, **Bombillas Largas**.
- Migración `20260907183000_product_hide_from_recipes`.

### 07-09-2026 (Sesión 113) — Insumos ocultos en producción

- `ingredients.hide_in_production`: el insumo sigue en costeo de recetas pero no aparece en Producción (lista, WhatsApp, recetas escaladas).
- UI Insumos: botón ojo (ocultar en producción) + checkbox en el modal. Recetas marcan «Solo costeo».
- Ya marcados: **Hielo Cubo/Frappe**, **Decoración Desidratada**, **Decoración Menta**, **Barril Pet 5L Talos**.
- Migración `20260907180000_ingredient_hide_in_production`.

### 07-09-2026 (Sesión 112) — Producción manual: lista corta de cócteles

- En Recetario → Producción → Manual ya no se muestra el catálogo completo con un input por receta.
- Flujo: buscar y agregar solo los cócteles necesarios; después ingresar litros en esa lista corta (quitar con X).
- Archivo: `app/admin/recetario/RecetarioClient.tsx`.

### 07-09-2026 (Sesión 111) — Exportador admin configurable

- Nueva sección `/admin/exportar`: datasets **Clientes** y **Cotizaciones**, catálogo de campos, filtros, formatos CSV/TXT/JSON (BOM UTF-8, separador `;`/`,`, fechas es-CL o ISO, montos planos o `$`).
- Presets incorporados: Meta Ads (PII crudo o SHA-256), Mailchimp, Contabilidad; presets propios en `site_settings` (`category=exports`, `key=export_preset_<slug>`).
- Archivos: `lib/services/exportService.ts`, `lib/exportSchemas.ts`, `app/actions/admin/exportActions.ts`, `app/admin/exportar/*`, ítem **Exportar** en sidebar.

### 07-09-2026 (Sesión 110) — Recetario: hielo, decoraciones y orden Barril Pet

- Migración `20260907160000_recipe_event_ice_decorations`: en las 25 recetas activas base 5L se agregó **Hielo Cubo/Frappe** 4000 g y **Decoración Desidratada** 1 u con `applies_to=event`.
- **Decoración Menta** 1 u (`event`) en los 8 mojitos y Moscow Mule.
- **Barril Pet 5L Talos** se muestra y persiste al final de la lista de insumos (`sortRecipeItemsForDisplay`, guardado en `saveRecipe`, producción y `created_at` en BD).
- UI recetas: costos/precios en tablas (margen + **Precio para el cliente** por tamaño); en PC selector combobox arriba (búsqueda + anterior/siguiente) en vez de barra lateral; móvil sigue con lista de cards.

---

*Ultima actualizacion: 07-09-2026 (Sesión 114)*
