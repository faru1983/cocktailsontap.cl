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

### 12-08-2026 (Sesión 66) — Banco de imágenes: listado server-side

- El modal Galería salía vacío: `storage.list` con anon no tiene política SELECT en `product-images`. Ahora lista con service_role (`listProductImages`). Loading/error visibles.

### 12-08-2026 (Sesión 65) — Producto stub desde receta

- Alta desde receta: nombre + categoría, `is_active=false`, sin precios. Catálogo/wizard no lo ven.
- No se puede pasar a Publicado sin al menos un precio activo (el recetario no inventa precios).

### 12-08-2026 (Sesión 64) — Guardar receta: error visible

- Guardar no hacía nada: `required` en la línea vacía de insumo bloqueaba el submit y el aviso nativo no se veía. Validación en JS + mensaje en el modal. "Piscola Mistral Nobel 40°" no se creó.

### 12-08-2026 (Sesión 63) — Producto oculto desde Nueva receta

- Nueva receta puede crear el cóctel en `products` con `is_active=false` (no sale en web/wizard). Luego se publica en `/admin/products`.
- El botón ya no exige un producto publicado previo.

### 12-08-2026 (Sesión 62) — Select de insumo en receta

- Modal receta: cantidad tenía `w-full` (de `inputClass`) y aplastaba el select. Filas en grid `1fr / 6.5rem / 2rem`.

### 12-08-2026 (Sesión 61) — Cron a las 09:00 Chile (invierno)

- `vercel.json` `0 13 * * *` (13:00 UTC). Invierno ≈ 09:00 Chile; verano ≈ 10:00. Constante `VERCEL_REMINDERS_CRON_UTC_HOUR` alineada.

### 12-08-2026 (Sesión 60) — Automatización: estado real, no hora falsa

- Tab Automatización muestra hora Chile del cron de Vercel (12:00 UTC → 08:00/09:00 según DST), último job (enviados/fallidos/omitidos), plantillas auto y últimos envíos `source=cron`.
- Se quitó el selector de hora. Solo queda Activar/Pausar + Enviar ahora.

### 12-08-2026 (Sesión 59) — Cron aniversarios: DST + catch-up

- Diagnóstico: Aldo Olivero y Candy Patiño (última reserva 12-09-2025 → aniversario 12-09-2026). Plantilla auto `Aniversario evento (30 dias)` envía el **13-08** (12-09 menos 30 días calendario; agosto tiene 31). El filtro Pendientes lista el mes, no “vence hoy”.
- Bug sistémico: Vercel Hobby dispara 12:00 UTC (= 08:00 Chile en invierno). `reminders_cron_hour=9` hacía no-op el único job del día. Cero envíos `source=cron` en logs.
- Fix: el slot 12:00 UTC corre aunque la hora Chile sea 8 u 9; se persiste last_run también en no-op; catch-up de 1 día si se pierde un disparo.

---

*Ultima actualizacion: 12-08-2026 (Sesión 66)*
