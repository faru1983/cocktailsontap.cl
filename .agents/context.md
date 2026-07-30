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
- **Evento**: Draft -> Confirmado (via link unico).
- **Venta Directa (Desechables)**: Confirmado directo (sin draft).

## Ultimos Cambios

### 30-07-2026 (Sesión 25)
- **PhoneInput**: al focus solo inyecta `+56` (ya no `+569`). El usuario escribe el 9 móvil. Validación Chile sigue `+569` + 8 dígitos. Sin cambios de DB.
- **Archivos**: `lib/phone.ts`, `components/ui/PhoneInput.tsx`, `lib/services/googleSyncService.ts`, `.agents/rules/rules.md`.

### 30-07-2026 (Sesión 24)
- **CSV audiencias Meta** + upload MCP a cuenta USD: Excluir compradores, seed eventos/desechables, drafts. Script `scripts/export-meta-audiences.mjs`.
- **Leads Web** excluye compradores + IG/FB. Creado **COT - Lookalike 1% eventos CL** (listo para usar después; no reemplaza el público actual).
- **Ads**: campaña `Leads Web` activa ($8/día, OUTCOME_LEADS → Lead pixel).

### 29-07-2026 (Sesión 23)
- **Meta Pixel hardening**: `MetaPixel` client — solo prod `cocktailsontap.cl` / `www`; sin `/admin`, sin `*.vercel.app`, sin localhost. PageView en navegación SPA pública.
- **Anti-refresh**: `trackOnce` + `eventID` (`lead_TOKEN` / `purchase_TOKEN`) en Event/Direct quote views.
- **Advanced Matching**: normaliza em/ph/fn/ln + `country: cl` + `ct` (comuna). Venta directa sigue como Purchase al crear (OK negocio).
- **Manual Meta**: confirmar dominio `cocktailsontap.cl`; descartar preview `…vercel.app` en Events Manager.
- **Archivos**: `lib/fpixel.ts`, `components/shared/MetaPixel.tsx`, `app/layout.tsx`, `EventQuoteView.tsx`, `DirectQuoteView.tsx`, `.agents/*`.

### 27-07-2026 (Sesión 22)
- **Recetario — columna Proveedor + edición inline**: `ingredients.supplier` (nullable) con seed desde lista de compra (mapeo de nombres; Pulpa Guayarauco → Pulpa Maracuyá; Azúcar Blanca → Jarabe de azúcar; Bebida Gaseosa → Bebida Cola; etc.). Desktop: doble clic en celdas (nombre, categoría, proveedor, formato, precio). Mobile: muestra proveedor en cards. Modal con campo proveedor + datalist.

### 27-07-2026 (Sesión 21)
- **Recetario — Whiskcola Johnnie Walker**: insumo `Whisky Johnnie Walker Negro` (750 ml, $27.990, Licor) + receta para producto `Whiskcola Johnnie Walker Black Label 40°` (misma proporción piscola: 1200 ml whisky + 3800 ml Bebida Cola / 5 L).

---
*Ultima actualizacion: 30-07-2026 (Sesión 25)*
