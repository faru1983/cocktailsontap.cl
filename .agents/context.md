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
  - `POST /quotes` | `POST /direct-sales` — crear venta.
  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source` (migración 02-08-2026). Mapper aún antepone tag en comments como respaldo.

## Ultimos Cambios

### 02-08-2026 (Sesión 30)
- **DB `quotes.source`**: columna + backfill. Código escribe `web`/`admin`/`whatsapp` al crear; filtros y badges en admin.

### 01-08-2026 (Sesión 29)
- **API v1 catálogo**: `GET /api/v1/catalog` (Bearer `INTEGRATION_API_KEY`) — productos activos con `size` exactos, precios, comunas y eventTypes. Reutiliza `fetchAllProductData` (caché 5 min).
- **WhatsApp bot**: consume el catálogo con caché en RAM + aliases; el mapa UUID hardcodeado queda solo como fallback.
- **Archivos**: `app/api/v1/catalog/route.ts`, README, `.agents/rules/rules.md`; bot `cot-api.js` / `cot-catalog.js` / `cot-event-quote.js`.

### 31-07-2026 (Sesión 28)
- **Meta Ads review (MCP)**: campaña `Leads Web` (`120249000651830069`) activa, optimiza Pixel Lead (`1739547250109039`).
- **Datos**: hoy ~2020 impr / 97 clics / 45 LPV / ~$10.57 — **0 Lead**. Desde lanzamiento (30–31): ~$22.24, **1 Lead** (Adry). WhatsApp Eventos (30d): ~$82, **115 chats** (~$0.71) + 8 Meta-leads → canal probado; web aún sin test justo.
- **Decisión**: mantener web como test limpio con presupuesto bajo (no pivotar 100% a WA aún).
- **Cambios aplicados (MCP)**:
  - Presupuesto CBO `Leads Web` bajado **$20 → $8/día** (`daily_budget` 800).
  - Anuncio Seba (`120249046881730069`): creativo nuevo `1113170721173605` con destino corregido `home → /eventos`, CTA `GET_QUOTE`, copy “Cotiza en la web”. (creativo previo iba a home).
- **Victor corregido** (`120249001480050069`): creativo nuevo `1708099757127438` — destino `/eventos`, CTA `GET_QUOTE`, copy “Cotiza en la web” (antes “escríbenos”).
- **Pixel en prod**: confirmado en `cocktailsontap.cl/eventos` (`fbq` loaded, script `meta-pixel`, ID correcto). Hardening ya en `main`/origen. No requiere redeploy.

### 30-07-2026 (Sesión 27)
- **FloatingWhatsApp**: mensaje custom por página — `/eventos` (cotizar evento) y `/barriles` (barriles desechables). Prop `message` en `FloatingWhatsapp`.

### 30-07-2026 (Sesión 26)
- **API ventas v1** (base CRM multicanal): `POST /api/v1/quotes` (evento draft), `POST /api/v1/direct-sales` (desechable confirmed). Auth `INTEGRATION_API_KEY`. Dominio en `createQuoteCore`; web action es wrapper.
- **Archivos**: `lib/services/createQuoteCore.ts`, `lib/integration*.ts`, `app/api/v1/*`, `app/actions/createQuote.ts`, `.agents/*`, `README.md`, `lib/config.ts`.

### 30-07-2026 (Sesión 25)
- **PhoneInput**: al focus solo inyecta `+56` (ya no `+569`). El usuario escribe el 9 móvil. Validación Chile sigue `+569` + 8 dígitos. Sin cambios de DB.
- **Archivos**: `lib/phone.ts`, `components/ui/PhoneInput.tsx`, `lib/services/googleSyncService.ts`, `.agents/rules/rules.md`.

---
*Ultima actualizacion: 01-08-2026 (Sesión 29)*
