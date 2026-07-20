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

### 20-07-2026 (Sesión 12)
- **Celulares E.164 + PhoneInput global**:
  - Nuevo `lib/phone.ts`: normalización E.164 con `+`, máscara de display (`+56 9 1234 5678`), validación Chile estricto + CO/PE/VE, `toWhatsAppDigits()`.
  - Nuevo `components/ui/PhoneInput.tsx`: focus vacío → prefijo `+56 9 `; emite E.164 al padre; placeholder `+56 9 1234 5678`.
  - Zod (`OptionalPhoneSchema` / `RequiredPhoneSchema`), `QuoteService`, admin actions y validaciones del wizard endurecidos.
  - Reemplazo de inputs de celular en wizards, vistas `/cotizar/[token]`, admin (clientes, cotizaciones, recordatorios).
  - Migración BD: 250 `clients.phone` + 283 `quotes.client_phone` normalizados de `+569-XXXXXXXX` → `+569XXXXXXXX`.
  - Regla de oro #8 en `rules.md`.
- **Archivos**: `lib/phone.ts`, `components/ui/PhoneInput.tsx`, `lib/types.ts`, `lib/utils.ts`, `lib/services/quoteService.ts`, `hooks/useWizard.ts`, wizards/quote/admin/emails, `.agents/rules/rules.md`, `.agents/context.md`.

### 21-06-2026 (Sesión 11)
- **Optimización de SEO Técnico y Datos Estructurados (JSON-LD)**:
  - Se configuró `metadataBase`, `canonical` y `twitter` (Twitter Cards) en el layout raíz de Next.js (`app/layout.tsx`).
  - Se inyectó un script JSON-LD de tipo `LocalBusiness` en el `RootLayout` (`app/layout.tsx`) utilizando los parámetros oficiales (`SITE_URL`, `LOGO_URL`, `WHATSAPP_NUMBER`) de `lib/config.ts`.
  - Se añadieron etiquetas `<h1>` semánticas y accesibles utilizando la clase `sr-only` en las páginas de entrada `/cotizar`, `/barriles` y `/eventos` para optimizar la jerarquía semántica para buscadores.
- **Archivos Modificados**: `app/layout.tsx`, `app/cotizar/page.tsx`, `app/barriles/page.tsx`, `app/eventos/page.tsx`, `.agents/context.md`.

### 21-06-2026 (Sesión 10)
- **Botón Flotante de WhatsApp en Eventos y Barriles**:
  - Se creó el componente `FloatingWhatsapp.tsx` en `components/shared/` para mostrar el botón flotante de WhatsApp de manera interactiva a los 20 segundos de cargada la página.
  - El componente tiene un botón de cerrar `(X)` que oculta el widget de forma inmediata.
  - El enlace a WhatsApp utiliza la variable preconfigurada `WHATSAPP_NUMBER` de `lib/config.ts` y envía el mensaje predefinido codificado: "Hola, estoy cotizando desde la pagina web y tengo algunas dudas.".
  - Se importó y renderizó el componente `FloatingWhatsapp` en las páginas públicas de cotización de eventos (`app/eventos/page.tsx`) y de compra directa de barriles (`app/barriles/page.tsx`).
  - Se ajustó la posición del botón en la versión móvil (`bottom-24 md:bottom-8`) para evitar superponerse con la barra de navegación fija inferior.
- **Archivos Modificados/Creados**: `components/shared/FloatingWhatsapp.tsx` (Nuevo), `app/eventos/page.tsx`, `app/barriles/page.tsx`, `.agents/context.md`.

### 05-06-2026 (Sesión 9)
- **Unificación de Envíos de Correo Manual (Venta Desechable y Eventos)**:
  - Se corrigió un bug en la creación manual de cotizaciones (`/admin/quotes/new`) y en la vista de detalle de la orden (`/admin/quotes/[token]`) donde las "Ventas Desechables" (venta directa) enviaban incorrectamente la plantilla de "Cotización de Evento" y omitían enviar una copia al administrador.
  - Se eliminó la función redundante `resendOrderEmail` de `adminActions.ts`.
  - Se reemplazó su uso en `CreateQuoteManualClient.tsx` y `QuoteDetailClient.tsx` por la función principal `sendQuoteEmailAdmin`, la cual verifica correctamente si la orden es Venta Directa o Evento, seleccionando la plantilla adecuada (`ConfirmationEmail` vs `QuoteEmail`) y enviando siempre la copia de respaldo al administrador.
  - Se eliminó el botón redundante de "Reenvío Orden" en el dashboard de detalle, manteniendo únicamente el botón de "Enviar Email de Confirmación / Cotización" en la sección de Disparadores Manuales.
- **Archivos Modificados**: `app/admin/quotes/new/CreateQuoteManualClient.tsx`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/actions/admin/adminActions.ts`, `.agents/context.md`.

### 28-05-2026 (Sesión 8)
- **Resolución de Advertencia de Seguridad en Supabase (`public_bucket_allows_listing`)**:
  - Se eliminó la política `Public Access for Everyone` con operación `SELECT` en la tabla `storage.objects` que afectaba al bucket `product-images`.
  - Esta política amplia permitía que cualquier cliente listara todos los archivos del bucket. Al ser un bucket público (`public=true`), los archivos individuales ya son accesibles mediante su URL pública sin necesidad de políticas RLS adicionales en `storage.objects`, por lo que se pudo remover la política de forma segura para corregir la vulnerabilidad sin afectar la visualización de imágenes de productos en el frontend.
- **Archivos Modificados**: `.agents/context.md` y base de datos (Supabase).

---
*Ultima actualizacion: 20-07-2026 (Sesión 12)*
