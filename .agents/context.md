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

### 20-07-2026 (Sesión 18)
- **WhatsApp post-cotización: de auto-popup a CTA opcional**:
  - Se eliminó `window.open` automático tras `createQuote` (lo bloqueaban los browsers).
  - Nuevo CTA `<a href="wa.me?...">` en pantallas `?new=true` (evento y directo) y en error del wizard.
  - Helpers: `buildWhatsAppMessageFromQuote` + `getWhatsAppUrl`; hook expone `getWhatsAppQuoteUrl`.
  - Copy de modales actualizado (ya no promete redirección automática).
- **Archivos**: `hooks/useWizard.ts`, `lib/wizardLogic.ts`, `EventWizardShell.tsx`, `DirectWizardShell.tsx`, checkout modals, `EventQuoteView.tsx`, `DirectQuoteView.tsx`, `EventWizardSuccess.tsx`, `.agents/context.md`.

### 20-07-2026 (Sesión 17)
- **Ordenamiento por columnas en `/admin/gastos`**:
  - Encabezados de la tabla (Fecha, Familia/Sub, Medio, Monto) ordenables al click; Notas queda fijo.
  - Alterna asc/desc; columna activa en `#E2A049` con 🔼/🔽 (idéntico a cotizaciones/clientes).
  - Default: fecha descendente. Aplica también a la vista mobile (misma lista ordenada).
- **Archivos**: `app/admin/gastos/GastosClient.tsx`, `.agents/context.md`.

---
*Ultima actualizacion: 27-07-2026 (Sesión 21)*
