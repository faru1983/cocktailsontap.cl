---
trigger: always_on
---

# 🧠 AI Context & Project Memory — Cocktails on Tap

Este archivo es la **fuente de verdad** para cualquier agente de IA que trabaje sobre este proyecto.
Define la arquitectura, reglas irrompibles, convenciones de código, esquema de base de datos y flujos críticos de negocio.

> **Antes de hacer cualquier cambio, lee también `.agents/context.md`** para obtener un resumen actualizado del estado del proyecto y los últimos cambios realizados.

---

## 🛠️ Reglas de Oro (MANDATORIAS — CERO EXCEPCIONES)

| # | Regla | Detalle |
|---|-------|---------|
| 1 | **Tailwind CSS v4 Only** | Prohibido crear archivos `.css` adicionales ni etiquetas `<style>`. Solo clases utilitarias de Tailwind. El archivo `globals.css` existe únicamente para el `@import "tailwindcss"` y definir el `@theme` con tokens de diseño. |
| 2 | **Server Actions First** | Toda mutación (POST/PUT/DELETE) se realiza mediante **Next.js Server Actions** ubicadas en `app/actions/`. Prohibido crear API Routes (`app/api/*`) para mutaciones. |
| 3 | **Capa de Servicios** | La lógica pesada de infraestructura (DB, Google APIs, Resend) reside en `lib/services/`. Los Server Actions solo **orquestan** llamadas a servicios, validaciones Zod y respuestas. |
| 4 | **Zero Trust Financials** | Nunca confiar en precios del frontend. Todo total se **recalcula en el servidor** consultando `product_prices` y `comunas` en Supabase antes de persistir. |
| 5 | **Configuración Centralizada** | Usar siempre las constantes de `lib/config.ts` para URLs, números de contacto y montos base. Prohibido leer `process.env` directamente en componentes client-side. Todo cambio en `.env.local` debe reflejarse en `lib/config.ts`. |
| 6 | **Proxy File Convention** | Prohibido crear `middleware.ts`. Este proyecto usa exclusivamente `proxy.ts` en la raíz para protección de rutas `/admin`. |
| 7 | **Single Contact Source** | El número de WhatsApp oficial es la única vía de soporte mencionada. Usar `WHATSAPP_URL` o `WHATSAPP_NUMBER` de `lib/config.ts`. Nunca hardcodear números. |
| 8 | **Iconografía Única** | Prohibido usar emojis o SVGs inline en la UI del dashboard administrativo. Usar exclusivamente **lucide-react** para iconos. Los emojis solo son aceptables en emails y asuntos de correo. |
| 9 | **Dos Clientes Supabase** | `lib/supabase.ts` (anon key, lectura pública con caché). `lib/supabaseServer.ts` (service_role, solo Server Actions/Components). Nunca importar el server client en código client-side. |
| 10 | **Contexto AI Actualizado** | Al finalizar cada sesión de trabajo, **actualizar `.agents/context.md`** con un resumen de los cambios realizados. Ver sección "Protocolo de Contexto AI" al final. |

---

## 📐 Arquitectura del Proyecto

### Stack Tecnológico
- **Framework**: Next.js 16 (App Router, React 19, Server Components)
- **Styling**: Tailwind CSS v4 (solo `@theme` + utilidades)
- **Tipografía**: Google Fonts — `Outfit` (variable `--font-outfit`)
- **Database**: Supabase (PostgreSQL, Storage para imágenes de productos)
- **Email**: Resend + React Email (componentes JSX en `components/emails/`)
- **Integraciones**: Google APIs SDK — People API (Contacts), Calendar API
- **Type Safety**: TypeScript + Zod (schemas en `lib/types.ts`)
- **Icons**: lucide-react (exclusivamente)
- **Analytics**: Google Analytics + Meta Pixel
- **Hosting**: Vercel (free tier optimizado)

### Estructura de Directorios

```
├── app/
│   ├── actions/              # Server Actions (mutaciones)
│   │   ├── admin/            # Actions del panel admin (CRUD)
│   │   ├── createQuote.ts    # Crear cotización (draft)
│   │   └── confirmQuote.ts   # Confirmar cotización
│   ├── admin/                # Dashboard administrativo (protegido por proxy.ts)
│   │   ├── clients/          # Gestión de clientes
│   │   ├── estadisticas/     # Estadísticas y BI
│   │   ├── gastos/           # Gestión de gastos
│   │   ├── logs/             # Logs de sincronización
│   │   ├── products/         # Gestión de catálogo
│   │   ├── quotes/           # Administración de cotizaciones
│   │   ├── reminders/        # Sistema de recordatorios
│   │   └── settings/         # Configuración dinámica (Cerebro Central)
│   ├── cotizar/              # Wizard público de cotización
│   │   └── [token]/          # Vista de cotización individual (confirmación)
│   ├── globals.css           # @theme tokens de Tailwind v4
│   ├── layout.tsx            # Root layout (Outfit font, Navbar, Footer, analytics)
│   └── page.tsx              # Landing page (Server Component con caché)
├── components/
│   ├── admin/                # Componentes del dashboard (Modal, SortSelect)
│   ├── emails/               # Plantillas React Email (QuoteEmail, ConfirmationEmail)
│   ├── sections/             # Secciones de la landing page
│   ├── ui/                   # Componentes atómicos reutilizables
│   └── wizard/               # Componentes del wizard de cotización (Steps 1-6, Success)
├── hooks/
│   ├── useWizard.ts          # Estado global del wizard (useState + callbacks)
│   └── useCart.ts            # Lógica del carrito
├── lib/
│   ├── config.ts             # Constantes centralizadas (SITE_URL, WHATSAPP, MURO_*)
│   ├── types.ts              # Interfaces TypeScript + Schemas Zod
│   ├── wizardLogic.ts        # Lógica pura de negocio (cálculos, precios, rendimientos)
│   ├── serverData.ts         # Fetch con unstable_cache (catálogo, comunas, eventos)
│   ├── emails.ts             # Generadores de HTML para emails (legacy, HTML puro)
│   ├── googleSync.ts         # Capa base de Google APIs (OAuth2, People, Calendar)
│   ├── adminAuth.ts          # Autenticación admin (SHA-256, cookies)
│   ├── supabase.ts           # Cliente público (anon key)
│   ├── supabaseServer.ts     # Cliente servidor (service_role key)
│   ├── utils.ts              # Helpers (formatCurrency, formatPhoneNumber)
│   └── services/
│       ├── quoteService.ts       # Transacciones de BD para cotizaciones
│       ├── googleSyncService.ts  # Orquestación de Google Contacts/Calendar
│       └── settingsService.ts    # Configuración dinámica desde site_settings
├── proxy.ts                  # Protección de rutas /admin (reemplaza middleware.ts)
├── vercel.json               # Redirects (/agendar, /qr, /google) + Security Headers
└── public/assets/            # Imágenes estáticas (logo, barriles, etc.)
```

---

## 🗄️ Esquema de Base de Datos (Supabase)

### Tablas Principales

| Tabla | Propósito | Claves |
|-------|-----------|--------|
| `clients` | CRM de clientes | `email` (unique), `google_contact_id` |
| `quotes` | Cotizaciones (draft/confirmed/completed/cancelled) | `token` (unique, auto-gen), `client_id` FK |
| `quote_items` | Items de cada cotización con precios congelados | `quote_id` FK, `product_id` FK nullable |
| `products` | Catálogo de cócteles | `is_active`, `display_order`, `category_id` FK |
| `product_prices` | Precios por tamaño (5L, 10L, 20L, 30L) | `product_id` FK, `size`, `price`, `offer_price` |
| `categories` | Categorías de productos | `is_active`, `display_order` |
| `comunas` | Comunas con costos de envío dinámicos | `name`, `cost`, `free_from`, `display_order` |
| `event_types` | Tipos de evento (Matrimonio, Cumpleaños, etc.) | `name`, `icon`, `display_order` |
| `expenses` | Registro de gastos del negocio | `amount`, `expense_date`, `category`, `description` |
| `payment_methods` | Medios de pago configurables | `name`, `is_active` |
| `site_settings` | Configuración dinámica (plantillas, templates) | `key` (unique), `category`, `value`, `is_active` |

### Campos Críticos en `quotes`
- `token`: UUID auto-generado por Supabase, usado como URL pública `/cotizar/[token]`
- `status`: Enum `draft | confirmed | completed | cancelled`
- `dispenser`: Enum `portatil | muro`
- `total_price`: Recalculado server-side en confirmación
- `shipping_cost`: Calculado dinámicamente según `comunas.free_from`
- `installation_cost`: $50.000 solo si `muro` + ≥30L + sin barriles de 5L
- `google_event_id` / `google_pickup_event_id`: IDs de eventos de Calendar para updates
- `manual_discount`: Descuento manual aplicado desde el admin
- `payments`: JSONB array de pagos `[{date, amount, note}]`

---

## 📋 Lógica de Negocio Crítica

### Rendimiento y Conversión
- **1 Litro = 5 Cócteles** (base 200ml por vaso)
- Tamaños disponibles: **5L, 10L, 20L, 30L** (determinados por `product_prices`)

### Muro de Coctelería
- Requiere volumen total **≥ 30L** (`MURO_MIN_LITERS`)
- **Incompatible** con barriles de 5L (`MURO_COMPATIBLE_SIZES = [10, 20, 30]`)
- Costo de instalación: **$50.000 CLP** (`MURO_INSTALLATION_COST`)
- Si no cumple requisitos, se fuerza automáticamente a "Dispensador Portátil"

### Envíos Dinámicos
- Cada comuna tiene un `cost` y un umbral `free_from` (litros)
- Si `totalLiters >= free_from` → envío gratis
- Si la comuna es "Otra" → etiqueta "Pendiente de factibilidad" (precio $0 temporal)

### Smart Config (Sugerencia de Barriles)
- Algoritmo en `calculateSmartConfig()` que recomienda tamaño de barril basado en:
  - Cantidad de invitados
  - Promedio de tragos por persona (determina cantidad de variedades)
- Clasificación: `≤7.5L ideal → 5L`, `≤15L → 10L`, `≤25L → 20L`, `>25L → 30L`

---

## 🚀 Flujos de Ejecución (Server Actions)

### `createQuote` — Crear Borrador
```
1. Validar esquema Zod (CreateQuoteSchema)
2. Upsert Cliente (clients) → Obtener clientId
3. Calcular precios con calculateSummaryData()
4. Insert quote + quote_items (congelar precios)
5. Google Sync → Crear/Actualizar contacto (try-catch, no bloquea)
6. Resend → Enviar emails (cliente + admin, try-catch)
7. Return { success, token }
```

### `confirmQuote` — Confirmar Reserva
```
1. Validar esquema Zod (ConfirmQuoteSchema)
2. Fetch quote por token, validar status !== 'confirmed'
3. Recalcular precios server-side (Zero Trust):
   - totalNormalPrice, totalOfferPrice, totalLiters
   - shippingCost desde comunas DB
   - installationCost según reglas del Muro
4. Sync items (delete eliminados, insert nuevos, update cantidades)
5. Update datos del cliente (phone, lastname)
6. Update quote principal con totales recalculados
7. Google Sync (blocking):
   - updateContactConfirmedStatus()
   - scheduleCalendarEvents() → Guardar event IDs
8. Resend → Emails de confirmación (cliente + admin)
9. revalidatePath → Invalidar caché de la página
```

---

## 📐 Integraciones Externas

### Google Contacts (People API)
- **De-duplicación**: Busca contacto por `google_contact_id` en DB → fallback a búsqueda por email/telefono
- **Nombres**: Prefijo "Cócteles - " para diferenciación en CRM
- **Notas**: Bitácora cronológica con links a cotizaciones. La más reciente arriba.
- **Direcciones**: Solo sincroniza si la dirección es "completa" (calle + comuna)

### Google Calendar
- **Dos calendarios**: `CALENDAR_RESERVA_ID` (montaje) y `CALENDAR_RETIRO_ID` (logística)
- **Eventos**: Pueden ser "All day" o con hora. Soporta rangos para retiro (ej: "12:00 a 14:00")
- **Descripción**: Usa template configurable desde `site_settings` con variables `{{full_name}}`, `{{items_list}}`, etc.
- **Timezone**: `America/Santiago` siempre

### Resend + React Email
- **Plantillas JSX**: `components/emails/QuoteEmail.tsx`, `ConfirmationEmail.tsx`
- **Shared Layout**: `EmailShared.tsx` con componentes reutilizables
- **Subjects dinámicos**: Configurables desde `site_settings` con SettingsService
- **From**: `contacto@cocktailsontap.cl`

### Settings Service (Cerebro Central)
- Templates de emails, calendarios y contactos configurables desde el admin
- Variables con sintaxis `{{variable}}`
- Fallback hardcoded si el setting no existe o está desactivado

---

## 🛡️ Seguridad

- **Proxy (`proxy.ts`)**: Protege todas las rutas `/admin/*` excepto `/admin/login`
- **Auth**: SHA-256 hash de `ADMIN_PASSWORD` almacenado en cookie `admin_session` (7 días)
- **Session Validation**: `lib/adminAuth.ts` → `validateSession()` verifica cookie vs hash
- **Security Headers**: `vercel.json` → `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- **Admin Layout**: Si no hay sesión válida, renderiza solo `{children}` (login form)

---

## 📌 Optimización para Capa Gratuita

- **unstable_cache**: Catálogo y comunas cacheados 5 minutos (`serverData.ts`)
- **Execution Timeout**: Todas las llamadas externas usan `try-catch` local. Si Google falla, el flujo principal continúa.
- **Supabase Connections**: Pool bajo. Preferir `select` de campos específicos sobre `select('*')`.
- **Promise.allSettled**: Para emails (no bloquear si uno falla).
- **Aggregations**: Estadísticas calculadas server-side en Server Components, no en el cliente.
- **Bandwidth**: Dashboard minimiza payload con selects mínimos.

---

## 📝 Protocolo de Contexto AI

Para mantener la eficiencia en sesiones con agentes de IA:

1. **Al inicio** de cada sesión, leer `.agents/context.md` para obtener el estado actual.
2. **Al final** de cada sesión, actualizar `.agents/context.md` con:
   - Fecha de la sesión
   - Resumen breve de los cambios realizados
   - Archivos modificados/creados
   - Issues conocidos pendientes
3. Mantener la sección "Últimos Cambios" limitada a las **últimas 5 sesiones**.

*Última actualización: 07-04-2026*