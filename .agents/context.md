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

### 27-07-2026 (Sesión 20)
- **Módulo Recetario en admin** (`/admin/recetario`):
  - Tablas `ingredients`, `recipes`, `recipe_items` (RLS, solo service_role) + seed desde `calculadora.html` (23 recetas, 34 insumos; Maracuyá Spritz espumante 2250 ml).
  - Tabs: Insumos (CRUD + precio/formato), Recetas (BOM + costeo/margen vs `product_prices`), Producción (manual o desde cotizaciones `confirmed`: semana/7 días/mes).
  - Lista de compras en formatos **sin redondear** (ej. 1,5 botellas); WhatsApp + imprimir. Sin historial.
  - Nav sidebar + redirect `/calculadora.html` → `/admin/recetario`.
  - **Archivos**: `app/admin/recetario/*`, `app/actions/admin/recetarioActions.ts`, `lib/services/productionService.ts`, `lib/types.ts`, `AdminSidebar.tsx`, `vercel.json`, `public/calculadora.html`, `.agents/*`.

### 20-07-2026 (Sesión 19)
- **Fecha mínima wizards (+2 días)**: evento (`EventWizardConfig`) y desechables (`DirectWizardCheckoutModal`) usan `getMinDateString(2)` — si hoy es 20, desde el 22.
- **Formato display WhatsApp (`WHATSAPP_LABEL`)**: `+56 9 XXXX XXXX` (ej. `+56 9 2967 2978`) desde los últimos 8 dígitos de `WHATSAPP_NUMBER`.
- **Archivos**: `components/wizard/events/EventWizardConfig.tsx`, `components/wizard/direct/DirectWizardCheckoutModal.tsx`, `lib/config.ts`, `.agents/context.md`.

---
*Ultima actualizacion: 29-07-2026 (Sesión 23)*
