# 🍸 Cocktails on Tap Chile — Plataforma de Cotización y Gestión

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)](https://typescriptlang.org/)

**Cocktails on Tap Chile** es una plataforma fullstack de código abierto diseñada para un negocio de barra móvil y estaciones de coctelería autoservicio. Automatiza completamente el flujo desde la cotización hasta la reserva, integrándose directamente con Google Workspace (Contacts & Calendar) y Resend para comunicaciones transaccionales.

> **📌 Optimizado para funcionar en capas gratuitas** de Vercel y Supabase, usando técnicas avanzadas de caché y control de conexiones.

---

## 📑 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Desarrollo](#-instalación-y-desarrollo)
- [Variables de Entorno](#-variables-de-entorno)
- [API de ventas v1 (integraciones)](#-api-de-ventas-v1-integraciones)
- [Esquema de Base de Datos](#-esquema-de-base-de-datos)
- [Flujos de Negocio](#-flujos-de-negocio)
- [Sistema de Cotización (Wizard)](#-sistema-de-cotización-wizard)
- [Panel Administrativo](#-panel-administrativo)
- [Integraciones Externas](#-integraciones-externas)
- [Lógica de Negocio Crítica](#-lógica-de-negocio-crítica)
- [Sistema de Seguridad](#-sistema-de-seguridad)
- [Sistema de Emails](#-sistema-de-emails)
- [Configuración Dinámica (Cerebro Central)](#-configuración-dinámica-cerebro-central)
- [SEO y Analytics](#-seo-y-analytics)
- [Optimizaciones de Rendimiento](#-optimizaciones-de-rendimiento)
- [Despliegue en Producción](#-despliegue-en-producción)
- [Convenciones de Código](#-convenciones-de-código)
- [Licencia](#-licencia)

---

## 🚀 Características Principales

### 💎 Experiencia del Cliente
- **Wizard de Cotización Interactivo**: Flujo guiado de 6 pasos (evento → consumo → productos → dispensador → contacto → resumen).
- **Smart Config**: Algoritmo que sugiere automáticamente el tamaño de barril ideal basado en invitados y consumo estimado.
- **Envío WhatsApp**: Genera y formatea automáticamente un mensaje de cotización para WhatsApp.
- **Confirmación Online**: El cliente puede revisar, modificar y confirmar su reserva desde una URL única con token.

### ⚙️ Automatización (Zero Middlemen)
- **CRM Inteligente (Google Contacts)**: Sincronización bidireccional con deduplicación, historial cronológico en notas, y prefijo "Cócteles -" para filtrado.
- **Logística Operacional (Google Calendar)**: Creación automática de eventos en dos calendarios: Reserva (montaje) y Retiro (logística inversa).
- **Emails Transaccionales (Resend + React Email)**: Plantillas responsivas con JSX. 4 tipos: draft cliente, draft admin, confirmación cliente, confirmación admin.

### 🛡️ Seguridad y Arquitectura
- **Zero Trust Pricing**: Los totales nunca se confían del frontend; se recalculan en el servidor consultando precios vigentes en Supabase.
- **Server Actions (web) + API v1 (integraciones)**: Mutaciones del sitio vía Server Actions. Cotizar/vender desde WhatsApp, Meta u otros canales vía `POST /api/v1/*` con Bearer token (mismo dominio `createQuoteCore`).
- **Protección Admin**: `proxy.ts` protege todas las rutas `/admin/*` con autenticación SHA-256.

### 📊 Panel Administrativo
- Dashboard con KPIs financieros en tiempo real (ingresos, gastos, utilidad, proyecciones).
- Gestión completa de cotizaciones con editor maestro para ediciones post-confirmación.
- Módulo de gastos, clientes, productos, estadísticas, logs de sincronización, recordatorios y configuración dinámica.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| **Framework** | Next.js | 16.1+ | App Router, RSC, Server Actions |
| **UI** | React | 19.2+ | Server & Client Components |
| **Styling** | Tailwind CSS | v4 | Solo utilidades + `@theme` tokens |
| **Tipografía** | Google Fonts | — | Outfit (variable `--font-outfit`) |
| **Database** | Supabase | — | PostgreSQL + Storage (imágenes) |
| **Email** | Resend | 6.x | Transaccional |
| **Email Templates** | React Email | 1.x | Componentes JSX para emails |
| **Integraciones** | Google APIs SDK | 171.x | People API + Calendar API |
| **Validación** | Zod | 4.x | Schemas para Server Actions |
| **Icons** | lucide-react | 0.575+ | Iconografía del dashboard |
| **Analytics** | GA4 + Meta Pixel | — | Tracking de conversiones |
| **Hosting** | Vercel | — | Free tier optimizado |
| **Speed Insights** | @vercel/speed-insights | 2.x | Métricas de performance |

---

## 📐 Arquitectura del Proyecto

```
cocktailsontap.cl/
│
├── app/                          # 📁 Next.js App Router
│   ├── actions/                  # Server Actions (mutaciones web/admin)
│   │   ├── admin/                # Admin CRUD Actions
│   │   │   ├── adminActions.ts   # Cotizaciones (edit, delete, status, pagos, sync)
│   │   │   ├── authActions.ts    # Login/Logout
│   │   │   ├── gastosActions.ts  # CRUD Gastos + Medios de pago
│   │   │   └── productActions.ts # CRUD Productos
│   │   ├── createQuote.ts        # Wrapper → createQuoteCore
│   │   └── confirmQuote.ts       # Confirmar reserva (cliente)
│   ├── api/v1/                   # Integraciones HTTP (Bearer INTEGRATION_API_KEY)
│   │   ├── catalog/route.ts      # GET catálogo (productos, precios, comunas)
│   │   ├── quotes/route.ts       # POST cotización evento (draft)
│   │   └── direct-sales/route.ts # POST venta desechable (confirmed)
│   │
│   ├── admin/                    # Dashboard administrativo (protegido)
│   │   ├── layout.tsx            # Layout con sidebar + validación de sesión
│   │   ├── AdminSidebar.tsx      # Navegación lateral responsive
│   │   ├── page.tsx              # Dashboard principal (KPIs + eventos + últimas cotiz.)
│   │   ├── clients/              # Gestión CRM de clientes
│   │   ├── estadisticas/         # BI y estadísticas avanzadas
│   │   ├── gastos/               # Registro de gastos y medios de pago
│   │   ├── logs/                 # Logs de sincronización Google
│   │   ├── login/                # Página de login admin
│   │   ├── products/             # Catálogo de productos (CRUD con Supabase Storage)
│   │   ├── quotes/               # Lista + detalle + editor maestro de cotizaciones
│   │   │   └── [id]/             # Detalle individual con editor completo
│   │   ├── reminders/            # Sistema de recordatorios
│   │   └── settings/             # Cerebro Central (configuración dinámica)
│   │
│   ├── cotizar/                  # Wizard público de cotización
│   │   ├── page.tsx              # Página del wizard (Server Component)
│   │   ├── [token]/              # Vista/confirmación de cotización por token
│   │   ├── error.tsx             # Error boundary
│   │   └── loading.tsx           # Loading skeleton
│   │
│   ├── globals.css               # Tailwind v4 @theme tokens + @utility + @keyframes
│   ├── layout.tsx                # Root layout (font, navbar, footer, analytics)
│   ├── page.tsx                  # Landing page (Server Component)
│   ├── robots.ts                 # SEO: robots.txt dinámico
│   └── sitemap.ts                # SEO: sitemap.xml dinámico
│
├── components/                   # 📁 Componentes React
│   ├── admin/                    # UI del dashboard
│   │   ├── Modal.tsx             # Modal genérico reutilizable
│   │   └── SortSelect.tsx        # Select de ordenamiento
│   ├── catalog/                  # Catálogo de productos
│   ├── emails/                   # Plantillas React Email
│   │   ├── QuoteEmail.tsx        # Email de cotización (draft)
│   │   ├── ConfirmationEmail.tsx # Email de confirmación
│   │   └── EmailShared.tsx       # Layout y componentes compartidos
│   ├── quote/                    # Vista de cotización individual
│   ├── sections/                 # Secciones de la landing page
│   │   ├── HeroSection.tsx       # Hero principal con CTA
│   │   ├── CoctelesSection.tsx   # Catálogo visual de products
│   │   ├── DispensadoresSection.tsx  # Tipos de dispensador
│   │   ├── QueIncluyeSection.tsx # Qué incluye el servicio
│   │   ├── StepsSection.tsx      # Pasos del proceso
│   │   └── InstagramSection.tsx  # CTA de Instagram
│   ├── ui/                       # Atómicos reutilizables
│   │   ├── InfoTooltip.tsx       # Tooltip de información
│   │   ├── OptionCard.tsx        # Card seleccionable
│   │   ├── QuantitySelector.tsx  # Selector +/- de cantidad
│   │   └── SelectField.tsx       # Select estilizado
│   ├── wizard/                   # Wizard de cotización (6 pasos)
│   │   ├── WizardShell.tsx       # Contenedor principal del wizard
│   │   ├── WizardStep1.tsx       # Evento + fecha + hora + invitados
│   │   ├── WizardStep2.tsx       # Consumo estimado (Smart Config)
│   │   ├── WizardStep3.tsx       # Selección de cócteles
│   │   ├── WizardStep4.tsx       # Tipo de dispensador
│   │   ├── WizardStep5.tsx       # Datos de contacto + dirección
│   │   ├── WizardStep6.tsx       # Resumen y envío
│   │   └── WizardSuccess.tsx     # Pantalla de éxito post-cotización
│   ├── Navbar.tsx                # Barra de navegación principal
│   ├── Footer.tsx                # Footer con links y contacto
│   ├── FloatingCta.tsx           # CTA flotante (WhatsApp)
│   ├── Carousel.tsx              # Carrusel de imágenes
│   └── icons.tsx                 # Iconos custom (SVG del wizard)
│
├── hooks/                        # 📁 Custom Hooks
│   ├── useWizard.ts              # Estado completo del wizard + validación
│   └── useCart.ts                # Lógica del carrito (add/remove/quantity)
│
├── lib/                          # 📁 Lógica de negocio y utilidades
│   ├── config.ts                 # 🔑 Constantes centralizadas (URLs, costos, etc.)
│   ├── types.ts                  # 📝 Interfaces TS + Schemas Zod
│   ├── wizardLogic.ts            # 🧮 Lógica pura (cálculos, precios, Smart Config)
│   ├── serverData.ts             # ⚡ Fetch con unstable_cache (catálogo, comunas)
│   ├── emails.ts                 # 📧 Generadores HTML (plantillas legacy)
│   ├── googleSync.ts             # 🔄 Capa base Google APIs (OAuth2 + People + Calendar)
│   ├── adminAuth.ts              # 🔐 Autenticación admin (SHA-256 + cookies)
│   ├── supabase.ts               # 📖 Cliente público (anon key)
│   ├── supabaseServer.ts         # 🔒 Cliente servidor (service_role key)
│   ├── utils.ts                  # 🔧 Helpers (formatCurrency, formatPhoneNumber)
│   ├── icons.tsx                 # Iconos de dispensadores
│   └── services/                 # Capa de servicios (abstracción de infra)
│       ├── quoteService.ts       # DB transactions para cotizaciones
│       ├── googleSyncService.ts  # Orquestación Google Contacts + Calendar
│       └── settingsService.ts    # Configuración dinámica (site_settings)
│
├── public/                       # 📁 Assets estáticos
│   └── assets/                   # Imágenes (logo, barriles, etc.)
│
├── .agents/                      # 📁 Configuración para agentes de IA
│   ├── rules/rules.md            # Reglas de oro del proyecto (siempre activas)
│   └── context.md                # Contexto actualizado (última sesión)
│
├── proxy.ts                      # 🛡️ Protección de rutas /admin (reemplaza middleware.ts)
├── vercel.json                   # ⚙️ Redirects + Security Headers
├── next.config.ts                # Next.js config (remote images)
├── postcss.config.mjs            # PostCSS para Tailwind v4
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencias del proyecto
```

---

## 📋 Requisitos Previos

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (o pnpm/yarn)
- **Cuenta Supabase** (proyecto creado con PostgreSQL)
- **Cuenta Google Cloud** (APIs habilitadas: People API, Calendar API)
- **Cuenta Resend** (dominio verificado para emails)
- **Cuenta Vercel** (para deploy, opcional para desarrollo local)

---

## 🏗️ Instalación y Desarrollo

### 1. Clonar el repositorio

```bash
git clone https://github.com/faru1983/cocktailsontap.cl.git
cd cocktailsontap.cl
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env.local
```

> Ver sección [Variables de Entorno](#-variables-de-entorno) para el detalle completo.

### 4. Configurar Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. Ejecutar las migraciones SQL (ver [Esquema de Base de Datos](#-esquema-de-base-de-datos))
3. Crear un bucket `product-images` en Supabase Storage (público)
4. Copiar la URL del proyecto y las keys (anon + service_role)

### 5. Configurar Google APIs

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar **People API** y **Google Calendar API**
3. Crear credenciales OAuth 2.0 (Web application)
4. Obtener `REFRESH_TOKEN` via [OAuth Playground](https://developers.google.com/oauthplayground)
   - Scopes necesarios: `https://www.googleapis.com/auth/contacts`, `https://www.googleapis.com/auth/calendar`
5. Crear dos calendarios en Google Calendar y copiar sus IDs

### 6. Ejecutar en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## 🔑 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

### Supabase

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL de tu proyecto Supabase (ej: `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Key pública (anon) para lectura desde el cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Key de servicio para operaciones admin (bypasses RLS) |

### Google APIs (OAuth 2.0 — Server-to-Server)

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `GOOGLE_CLIENT_ID` | Secret | Client ID de la app OAuth en Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Secret | Client Secret de la app OAuth |
| `GOOGLE_REFRESH_TOKEN` | Secret | Token de refresco obtenido via OAuth Playground |
| `GOOGLE_CALENDAR_RESERVA_ID` | Secret | ID del calendario para eventos de reserva/montaje |
| `GOOGLE_CALENDAR_RETIRO_ID` | Secret | ID del calendario para eventos de retiro/logística |
| `GOOGLE_CALENDAR_DESECHABLE_ID` | Secret | ID del calendario para entregas de venta directa (barriles desechables) |

### Email (Resend)

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `RESEND_API_KEY` | Secret | API Key de tu cuenta Resend |
| `ADMIN_EMAIL` | Secret | Email que recibe alertas de nuevas cotizaciones |

### Configuración del Sitio

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Public | URL base del sitio (ej: `http://localhost:3000`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public | Número WhatsApp en formato internacional (ej: `56912345678`) |
| `ADMIN_PASSWORD` | Secret | Contraseña para acceder al panel `/admin` |
| `AUTH_SALT` | Secret | Salt para hash de sesión admin |
| `INTEGRATION_API_KEY` | Secret | Bearer token para `POST /api/v1/*` (WhatsApp bot, CRM, Meta futuro) |

> ⚠️ **Importante**: Toda variable `NEXT_PUBLIC_*` debe reflejarse también en `lib/config.ts`. Las variables sin prefijo `NEXT_PUBLIC_` nunca deben leerse desde componentes client-side.

---

## 🔌 API de ventas v1 (integraciones)

Punto de entrada HTTP para crear cotizaciones y ventas desde canales externos (WhatsApp hoy; Meta/CRM mañana). La web sigue usando Server Actions; ambos llaman a `createQuoteCore`.

**Auth:** header `Authorization: Bearer <INTEGRATION_API_KEY>`

**Confirmación de evento:** no hay endpoint. El cliente confirma en `/cotizar/{token}`.

### `GET /api/v1/catalog` — Catálogo activo (lectura)

Devuelve productos activos con tamaños/precios (etiquetas `size` exactas para los POST), comunas y tipos de evento. Misma auth Bearer. Caché server vía `fetchAllProductData` (5 min).

```json
{
  "success": true,
  "products": [
    {
      "id": "<uuid>",
      "name": "Mojito Tradicional",
      "category": "Clásicos",
      "sizes": [
        { "size": "10L", "sizeValue": 10, "unit": "L", "isDisposable": false, "price": 45000, "offerPrice": 45000 },
        { "size": "5L - Desechable", "sizeValue": 5, "unit": "L", "isDisposable": true, "price": 35000, "offerPrice": 35000 }
      ]
    }
  ],
  "comunas": [{ "name": "Providencia", "cost": 15000, "freeFrom": 30, "directSaleDeliveryCost": 8000 }],
  "eventTypes": [{ "id": "<uuid>", "name": "Matrimonio" }],
  "fetchedAt": "2026-08-01T15:00:00.000Z"
}
```

### `POST /api/v1/quotes` — Cotización evento (draft)

```json
{
  "source": "whatsapp",
  "client": {
    "firstName": "Ana",
    "lastName": "Pérez",
    "email": "ana@email.com",
    "phone": "+56912345678",
    "comuna": "Providencia",
    "address": "",
    "comments": ""
  },
  "event": { "date": "2026-09-15", "type": "", "startTime": "" },
  "consumption": { "guests": 50, "drinksPerPerson": 3 },
  "dispenser": "portatil",
  "items": [{ "productId": "<uuid>", "size": "10L", "quantity": 2 }]
}
```

### `POST /api/v1/direct-sales` — Venta desechable (confirmed)

```json
{
  "source": "whatsapp",
  "client": {
    "firstName": "Ana",
    "lastName": "Pérez",
    "email": "ana@email.com",
    "phone": "+56912345678",
    "comuna": "Providencia"
  },
  "event": { "date": "2026-09-15" },
  "items": [{ "productId": "<uuid>", "size": "5L - Desechable", "quantity": 1 }]
}
```

> El string `size` debe coincidir exactamente con la etiqueta del catálogo (ej. `10L`, `5L - Desechable`).

### Respuesta OK

```json
{
  "success": true,
  "token": "...",
  "quoteId": "...",
  "url": "https://cocktailsontap.cl/cotizar/...",
  "totalPrice": 89000,
  "status": "draft"
}
```

Errores: `401` auth, `400` validación/catálogo, `503` si falta `INTEGRATION_API_KEY`, `500` inesperado.

Campo opcional `source`: se antepone a `comments` como `[whatsapp]` para trazabilidad (sin columna DB aún).

---

## 🗄️ Esquema de Base de Datos

El proyecto utiliza PostgreSQL a través de Supabase. A continuación el esquema completo de tablas:

### `clients` — CRM de Clientes
```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  google_contact_id TEXT,          -- resourceName de Google Contacts
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `categories` — Categorías de Productos
```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0
);
```

### `products` — Catálogo de Cócteles
```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,                   -- PATH relativo a Supabase Storage
  category_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `product_prices` — Precios por Tamaño
```sql
CREATE TABLE product_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,               -- Ej: "5L", "10L", "20L", "30L"
  price INT NOT NULL,               -- Precio normal en CLP
  offer_price INT,                  -- Precio oferta (si es null, se usa price)
  UNIQUE(product_id, size)
);
```

### `comunas` — Comunas con Costos de Envío
```sql
CREATE TABLE comunas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cost INT DEFAULT 0,              -- Costo de envío en CLP
  free_from INT,                   -- Litros mínimos para envío gratis (null = nunca gratis)
  display_order INT DEFAULT 0
);
```

### `event_types` — Tipos de Evento
```sql
CREATE TABLE event_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,                       -- Nombre del icono lucide-react
  display_order INT DEFAULT 0
);
```

### `quotes` — Cotizaciones
```sql
CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE,  -- URL pública
  status TEXT DEFAULT 'draft',     -- draft | confirmed | completed | cancelled
  
  -- Cliente
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  client_lastname TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  comments TEXT,
  
  -- Evento
  event_type_id TEXT,              -- ID del event_type o nombre libre
  event_type_other TEXT,
  event_date DATE NOT NULL,
  start_time TEXT,                 -- HH:MM
  pickup_date DATE,
  pickup_time TEXT,
  
  -- Ubicación
  comuna_name TEXT,
  comuna_other TEXT,
  
  -- Consumo
  guests INT NOT NULL,
  drinks_per_person INT,
  
  -- Dispensador
  dispenser TEXT DEFAULT 'portatil',  -- portatil | muro
  
  -- Precios (congelados al crear, recalculados al confirmar)
  total_normal_price INT DEFAULT 0,
  total_offer_price INT DEFAULT 0,
  shipping_cost INT DEFAULT 0,
  installation_cost INT DEFAULT 0,
  manual_discount INT DEFAULT 0,
  total_price INT DEFAULT 0,
  total_liters INT,
  
  -- Pagos
  payments JSONB DEFAULT '[]',     -- [{date, amount, note}]
  
  -- Google Sync
  google_event_id TEXT,            -- ID del evento en Calendar Reserva
  google_pickup_event_id TEXT,     -- ID del evento en Calendar Retiro
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `quote_items` — Items de Cotización
```sql
CREATE TABLE quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),  -- nullable (producto eliminado)
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INT DEFAULT 1,
  price_at_time INT NOT NULL,          -- Precio congelado al momento de la cotización
  offer_price_at_time INT NOT NULL
);
```

### `expenses` — Gastos del Negocio
```sql
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INT NOT NULL,
  expense_date DATE NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `payment_methods` — Medios de Pago
```sql
CREATE TABLE payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

### `site_settings` — Configuración Dinámica
```sql
CREATE TABLE site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,             -- Template con variables {{variable}}
  category TEXT NOT NULL,          -- emails | calendar | contacts
  description TEXT,
  is_active BOOLEAN DEFAULT true
);
```

---

## 🔄 Flujos de Negocio

### Flujo Completo de una Cotización

```
┌─────────────────────────────────────────────────┐
│  CLIENTE (Público)                              │
│                                                 │
│  1. Accede a /cotizar                           │
│  2. Completa Wizard (6 pasos)                   │
│  3. Envía cotización                            │
│     └─→ Server Action: createQuote()            │
│         ├── Validar (Zod)                       │
│         ├── Upsert Client (CRM)                 │
│         ├── Insert Quote + Items (precios frozen)│
│         ├── Google Sync → Crear contacto        │
│         └── Resend → Email draft (cli + admin)  │
│  4. Recibe email con link /cotizar/[token]      │
│  5. Revisa y confirma                           │
│     └─→ Server Action: confirmQuote()           │
│         ├── Validar (Zod)                       │
│         ├── Recalcular precios (Zero Trust)     │
│         ├── Sync items (add/update/delete)      │
│         ├── Update quote + client               │
│         ├── Google Sync:                        │
│         │   ├── Update contacto (confirmed)     │
│         │   └── Create Calendar events × 2      │
│         └── Resend → Email confirmación × 2     │
│                                                 │
├─────────────────────────────────────────────────┤
│  ADMIN (Panel /admin)                           │
│                                                 │
│  • Ver dashboard con KPIs                       │
│  • Gestionar cotizaciones (editar, pagos, sync) │
│  • Administrar productos y precios              │
│  • Controlar gastos y ver estadísticas          │
│  • Configurar templates dinámicos               │
└─────────────────────────────────────────────────┘
```

### Estado de una Cotización (Lifecycle)

```
draft ──→ confirmed ──→ completed
  │                        ↑
  └──→ cancelled ──────────┘ (puede reactivarse)
```

---

## 🧙 Sistema de Cotización (Wizard)

El wizard es un componente client-side de 6 pasos, orquestado por el hook `useWizard.ts`:

| Paso | Componente | Datos Ingresados |
|------|-----------|------------------|
| 1 | `WizardStep1` | Tipo de evento, fecha, hora inicio, fecha retiro, hora retiro, Nº invitados |
| 2 | `WizardStep2` | Consumo estimado (tragos/persona). Muestra **Smart Config** con recomendación |
| 3 | `WizardStep3` | Selección de cócteles por categoría, tamaño y cantidad |
| 4 | `WizardStep4` | Tipo de dispensador (Portátil vs Muro de Coctelería) |
| 5 | `WizardStep5` | Datos de contacto (nombre, email, teléfono, dirección, comuna, comentarios) |
| 6 | `WizardStep6` | Resumen final con desglose de precios → Enviar cotización |

### Validación por Paso
- Cada paso tiene validación inline antes de avanzar (función `validateStep()` en `useWizard.ts`).
- Los campos obligatorios cambian según el paso (evento/fecha en paso 1, contacto en paso 5, etc.).

### Smart Config (Auto-recomendación)
Ubicado en `lib/wizardLogic.ts` → `calculateSmartConfig()`:
```
totalLitersRequired = (guests × avgDrinks) / 5
numVarieties = max(1, avgDrinks)
idealLitersPerBarrel = totalLitersRequired / numVarieties

Clasificación:
  ≤7.5L → Barril 5L
  ≤15L  → Barril 10L
  ≤25L  → Barril 20L
  >25L  → Barril 30L
```

---

## 🖥️ Panel Administrativo

### Acceso
- URL: `/admin`
- Protegido por `proxy.ts` + `adminAuth.ts`
- Login con contraseña (`ADMIN_PASSWORD`), sesión de 7 días via cookie

### Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| **Dashboard** | `/admin` | KPIs financieros, eventos próximos, últimas cotizaciones |
| **Cotizaciones** | `/admin/quotes` | Lista con filtros por estado, búsqueda, acciones masivas |
| **Detalle Cotización** | `/admin/quotes/[id]` | Editor maestro: editar datos, items, pagos, re-sync Google |
| **Clientes** | `/admin/clients` | CRM con historial de cotizaciones por cliente |
| **Productos** | `/admin/products` | CRUD de catálogo con upload de imágenes a Supabase Storage |
| **Gastos** | `/admin/gastos` | Registro de gastos, medios de pago configurables |
| **Estadísticas** | `/admin/estadisticas` | BI avanzado: ranking de productos, comunas, clientes, temporalidad |
| **Recordatorios** | `/admin/reminders` | Sistema de recordatorios para seguimiento |
| **Logs** | `/admin/logs` | Diagnóstico de errores de sincronización Google |
| **Configuración** | `/admin/settings` | Cerebro Central: templates de emails, calendario, contactos |

---

## 🔌 Integraciones Externas

### Google Contacts (People API)

**Archivo**: `lib/googleSync.ts` → `syncGoogleContact()`
**Orquestador**: `lib/services/googleSyncService.ts`

| Feature | Detalle |
|---------|---------|
| **Deduplicación** | Busca por `google_contact_id` en DB → fallback búsqueda por email/teléfono |
| **Nombres** | Prefijo "Cócteles - " para identificación en el CRM personal |
| **Notas** | Bitácora cronológica (más reciente arriba). Incluye links a cotizaciones. Si se confirma, reemplaza la entrada draft |
| **Direcciones** | Solo sincroniza si la dirección es "completa" (calle con letras + comuna) |
| **Persistencia** | Guarda `google_contact_id` en tabla `clients` para futuras operaciones |

### Google Calendar (Calendar API)

**Archivo**: `lib/googleSync.ts` → `syncGoogleEvent()`
**Orquestador**: `lib/services/googleSyncService.ts` → `scheduleCalendarEvents()`

| Feature | Detalle |
|---------|---------|
| **Dos calendarios** | `CALENDAR_RESERVA_ID` (montaje) + `CALENDAR_RETIRO_ID` (retiro) |
| **All-day vs Timed** | Si hay hora especificada, crea evento con hora; si no, All Day |
| **Rangos de retiro** | Soporta formato "12:00 a 14:00" que se parsea como rango |
| **Descripción** | Template configurable desde `site_settings` con interpolación de variables |
| **Update** | Si ya existe `google_event_id`, actualiza en vez de crear duplicado |
| **Timezone** | Siempre `America/Santiago` |

### Resend (Email Transaccional)

**Plantillas JSX**: `components/emails/QuoteEmail.tsx`, `ConfirmationEmail.tsx`, `EmailShared.tsx`
**HTML Legacy**: `lib/emails.ts` (generadores de HTML puro)

| Email | Destinatario | Contenido |
|-------|-------------|-----------|
| Draft (cotización) | Cliente | Resumen de cotización + CTA para confirmar |
| Draft (notificación) | Admin | Alerta de nueva cotización recibida |
| Confirmación | Cliente | Datos bancarios para transferencia + resumen |
| Confirmación (notif.) | Admin | Alerta de reserva confirmada |

Los subjects de los emails son configurables dinámicamente desde `site_settings`.

---

## 📋 Lógica de Negocio Crítica

### Rendimiento de Cócteles
```
1 Litro = 5 Cócteles (base: vaso de 200ml)
```

### Tamaños de Barriles Disponibles
Determinados por `product_prices` en la DB: **5L, 10L, 20L, 30L**

### Muro de Coctelería
El "Muro" es una estación de coctelería premium con grifo de pared. Reglas:

| Regla | Valor | Constante |
|-------|-------|-----------|
| Volumen mínimo | 30 Litros | `MURO_MIN_LITERS` |
| Tamaños compatibles | 10, 20, 30L | `MURO_COMPATIBLE_SIZES` |
| Costo instalación | $50.000 CLP | `MURO_INSTALLATION_COST` |

Si el pedido incluye un barril de **5L**, el Muro se deshabilita automáticamente y se fuerza "Portátil".

### Envíos Dinámicos por Comuna
Cada comuna en la DB tiene:
- `cost`: Precio de envío base
- `free_from`: Litros mínimos para envío gratis

```
Si totalLiters >= free_from → envío $0
Si comuna === "Otra"       → "Pendiente de factibilidad" ($0 temporal)
De lo contrario             → cobrar cost
```

### Cálculo de Precios (Function: `calculateSummaryData`)

```
totalOfferPrice = Σ(item.offer_price × item.quantity)
totalNormalPrice = Σ(item.price × item.quantity)
totalDiscount   = totalNormalPrice - totalOfferPrice
shippingCost    = (ver reglas de comuna arriba)
installationCost= (ver reglas del Muro arriba)
totalPrice      = totalOfferPrice + shippingCost + installationCost
```

---

## 🛡️ Sistema de Seguridad

### Protección de Rutas Admin

El archivo `proxy.ts` en la raíz actúa como middleware para Next.js 16:

```
Request → /admin/* (excepto /admin/login)
  ├── ¿Tiene cookie "admin_session"? → No → Redirect a /admin/login
  ├── ¿Hash(ADMIN_PASSWORD) === cookie? → No → Redirect a /admin/login
  └── Sí → NextResponse.next()
```

> ⚠️ **Importante**: Este proyecto usa `proxy.ts` en vez de `middleware.ts`. No crear `middleware.ts`.

### Autenticación Admin

| Aspecto | Detalle |
|---------|---------|
| **Hash** | SHA-256 con salt `cot_salt_2026` |
| **Cookie** | `admin_session`, HttpOnly, Secure, SameSite=strict |
| **Duración** | 7 días |
| **Scope** | Path `/admin` |

### Headers de Seguridad (vercel.json)

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 📧 Sistema de Emails

El proyecto tiene **dos sistemas de email** que coexisten:

### 1. React Email (Actual — Recomendado)
- **Archivos**: `components/emails/*.tsx`
- **Tecnología**: JSX con `@react-email/components`
- **Renderizado**: Server-side con `render()` en Server Actions
- **Usado por**: `createQuote.ts` y `confirmQuote.ts`

### 2. HTML Legacy
- **Archivo**: `lib/emails.ts`
- **Tecnología**: Template strings con HTML puro
- **Funciones**: `buildQuoteCreatedClientEmail()`, `buildAdminNotificationEmail()`, etc.
- **Estado**: Legacy, puede eliminarse una vez se migre completamente a React Email

---

## ⚙️ Configuración Dinámica (Cerebro Central)

Ubicado en `/admin/settings`, permite configurar templates sin tocar código:

### Cómo funciona

1. La tabla `site_settings` almacena templates con variables `{{variable}}`
2. `SettingsService.getResolvedValue(key, variables, fallback)` busca el template, interpola variables y retorna
3. Si el setting no existe o está desactivado (`is_active = false`), retorna el fallback hardcoded

### Variables Disponibles

| Variable | Descripción |
|----------|-------------|
| `{{full_name}}` | Nombre completo del cliente |
| `{{event_date}}` | Fecha del evento (DD/MM/YYYY) |
| `{{guests}}` | Número de invitados |
| `{{phone}}` | Teléfono del cliente |
| `{{email}}` | Email del cliente |
| `{{link}}` | URL de la cotización |
| `{{items_list}}` | Lista de productos formateada |
| `{{total_price}}` | Total en CLP |
| `{{shipping_cost}}` | Costo de envío |
| `{{dispenser_label}}` | "Muro" o "Portátil" |
| `{{installation_cost}}` | Costo de instalación |
| `{{payments_summary}}` | Resumen de pagos |
| `{{comments}}` | Comentarios del cliente |

### Categorías de Settings

| Categoría | Ejemplos de Keys |
|-----------|-----------------|
| `emails` | `email_quote_draft_subject`, `email_quote_confirmed_subject` |
| `calendar` | `calendar_event_summary_template`, `calendar_event_description_template` |
| `contacts` | Templates para notas de Google Contacts |

---

## 📈 SEO y Analytics

### SEO Implementado
- `robots.ts`: Genera `robots.txt` dinámico
- `sitemap.ts`: Genera `sitemap.xml` dinámico
- Metadata en `layout.tsx`: OpenGraph, título, descripción, keywords
- Heading hierarchy correcta en cada página
- HTML semántico con `<main>`, `<section>`, `<nav>`, `<footer>`

### Analytics
- **Google Analytics 4**: Tag `G-N4MLRD1LLD` (configurable)
- **Meta Pixel**: Pixel ID `1739547250109039` (configurable)
- **Vercel Speed Insights**: Métricas de rendimiento integradas

### Redirects (vercel.json)
| Ruta | Destino | Uso |
|------|---------|-----|
| `/agendar` | JotForm | Formulario legado |
| `/contratar` | JotForm | Formulario alternativo |
| `/qr` | Instagram | QR físico de eventos |
| `/google` | Google Reviews | Solicitar reseñas |

---

## ⚡ Optimizaciones de Rendimiento

### Caché con `unstable_cache`
- **`serverData.ts`**: Catálogo, categorías, comunas y tipos de evento cacheados con revalidación cada **5 minutos** (300s).
- **Cache key**: `'product-data'` → compartida entre landing page y wizard.

### Control de Errores
- **`try-catch` locales**: Google Sync y Resend nunca bloquean el flujo principal si fallan.
- **`Promise.allSettled`**: Para envío de emails en paralelo (cliente + admin).

### Optimización de Queries
- Usar `select('campo1, campo2')` en vez de `select('*')`.
- Usar `{ count: 'exact', head: true }` para contar sin traer datos.
- Estadísticas calculadas server-side en Server Components.

### Supabase
- Dos clientes separados para evitar mezcla de privilegios.
- `autoRefreshToken: false` y `persistSession: false` en el service client para reducir overhead.

---

## 🚀 Despliegue en Producción

### Vercel (Recomendado)

1. Conectar el repositorio de GitHub a Vercel.
2. Configurar las variables de entorno en el panel de Vercel.
3. El deploy es automático con cada push a `main`.

### Variables Importantes para Producción

```
NEXT_PUBLIC_SITE_URL=https://tudominio.com    # SIN barra final
NODE_ENV=production                           # Automático en Vercel
```

### Dominio Personalizado

1. Agregar dominio en Vercel → Settings → Domains.
2. Configurar DNS (CNAME a `cname.vercel-dns.com`).
3. Verificar dominio en Resend para envío de emails desde `@tudominio.com`.

---

## 📐 Convenciones de Código

### Tailwind CSS v4
- **Solo utilidades**: No crear archivos CSS ni `<style>`.
- **`globals.css`**: Solo para `@import "tailwindcss"`, `@theme` tokens y `@utility` customs.
- **Responsive**: Mobile-first con breakpoints `md:` y `lg:`.

### Server Actions
- Ubicación: `app/actions/`
- Prefijo `'use server'` obligatorio
- Validación Zod **siempre** como primer paso
- Retornan `{ success: boolean; error?: string; data?: T }`

### Capa de Servicios
- Ubicación: `lib/services/`
- Contienen la lógica de infraestructura (DB, APIs externas)
- Los Server Actions solo orquestan, no implementan lógica pesada

### TypeScript
- Interfaces en `lib/types.ts`
- Schemas Zod junto a sus interfaces correspondientes
- Import paths con alias `@/` (configurado en `tsconfig.json`)

### Componentes
- Server Components por defecto (no agregar `'use client'` innecesariamente)
- `'use client'` solo cuando se necesita interactividad (hooks, events)
- Props tipadas con TypeScript