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

### 20-07-2026 (Sesión 17)
- **Ordenamiento por columnas en `/admin/gastos`**:
  - Encabezados de la tabla (Fecha, Familia/Sub, Medio, Monto) ordenables al click; Notas queda fijo.
  - Alterna asc/desc; columna activa en `#E2A049` con 🔼/🔽 (idéntico a cotizaciones/clientes).
  - Default: fecha descendente. Aplica también a la vista mobile (misma lista ordenada).
- **Archivos**: `app/admin/gastos/GastosClient.tsx`, `.agents/context.md`.

### 20-07-2026 (Sesión 16)
- **One-shot sync teléfonos → Google Contacts (E.164)**:
  - Script temporal actualizó `phoneNumbers` de 250 contactos (solo teléfono; sin tocar notas/direcciones).
  - 1ª pasada: cuota People API; 2ª pasada con backoff: **OK 75 + SKIP 175 + FAIL 0**.
  - Script eliminado tras la corrida (no queda en el repo).
- **Archivos**: solo `.agents/context.md` (script one-shot borrado).

### 20-07-2026 (Sesión 15)
- **Selector de direcciones desde historial (admin)**:
  - Nueva action `getClientAddressesFromQuotes`: lee `client_address`/`comuna_*` de quotes del cliente, deduplica por clave normalizada y ordena por más reciente.
  - En `/admin/quotes/new`, al elegir un cliente existente se listan esas direcciones; ninguna se precarga sola — hay que elegirla con un click (calle + comuna).
  - Editar a mano la dirección desmarca la selección. Sin cambios de schema ni wizard público.
- **Menú Nueva Cotización (Evento / Desechables)**:
  - En `/admin/quotes`, el botón abre un dropdown: Reserva de Evento → `?type=event`, Venta Desechables → `?type=direct`.
  - `/admin/quotes/new` lee el query param y deja lista la pestaña correspondiente.
- **Archivos**: `app/actions/admin/adminActions.ts`, `app/admin/quotes/new/CreateQuoteManualClient.tsx`, `app/admin/quotes/new/page.tsx`, `app/admin/quotes/QuotesListClient.tsx`, `.agents/context.md`.

### 20-07-2026 (Sesión 14)
- **Fix duplicado de comuna "Otra" en wizards**:
  - En `EventWizardCheckoutModal` y `DirectWizardCheckoutModal` se eliminó el `<option>` hardcodeado `Otra / No está en la lista` que coexistía con la fila `Otra` de BD.
  - Ahora hay una sola opción (`value="Otra"`) con label amigable; al elegirla sigue apareciendo el input manual (`otherComuna`).
- **Archivos**: `components/wizard/events/EventWizardCheckoutModal.tsx`, `components/wizard/direct/DirectWizardCheckoutModal.tsx`, `.agents/context.md`.

### 20-07-2026 (Sesión 13)
- **Auto-envío de email de reseña en cambio masivo de estado**:
  - `bulkUpdateQuoteStatus` ahora dispara `maybeAutoSendReview` (igual que el cambio individual) cuando el estado pasa a `completed` y `review_mode=auto`.
  - `sendReviewEmail` ya evita reenvíos con `review_email_sent`; el helper no bloquea el update si Resend falla.
  - Listado `/admin/quotes`: se selecciona `review_email_sent` y se muestra icono Star (lucide) junto al badge de estado cuando el correo ya se envió.
- **Filtro Eventos / Desechables** en `/admin/quotes`:
  - Nuevo query param `type` (`all` | `event` | `direct`) combinable con estado, búsqueda y paginación.
  - Chips secundarios: Todos / Eventos / Desechables.
- **Archivos**: `app/actions/admin/adminActions.ts`, `app/admin/quotes/page.tsx`, `app/admin/quotes/QuotesListClient.tsx`, `.agents/context.md`.

---
*Ultima actualizacion: 20-07-2026 (Sesión 17)*
