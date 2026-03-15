# 🍸 Cocktails on Tap Chile - Barra Móvil & Autoservicio

¡Bienvenido al repositorio oficial de **Cocktails on Tap Chile**! Esta es una aplicación web de nivel producción diseñada para ofrecer una experiencia premium en la cotización y gestión de servicios de barra móvil y estaciones de autoservicio de coctelería.

El proyecto está construido con un enfoque en **arquitectura limpia, seguridad y automatización**, siendo ideal tanto para el negocio real como para servir de referencia a la comunidad sobre integraciones modernas.

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-blue?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Resend](https://img.shields.io/badge/Emails-Resend-000000?style=flat&logo=resend)](https://resend.com/)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Contacts%20%26%20Calendar-4285F4?style=flat&logo=google)](https://developers.google.com/workspace)

---

## 🚀 Características Principales

### 💎 Experiencia de Usuario (Wizard)
- **Cotizador Premium:** Flujo interactivo optimizado para conversión, con validaciones en tiempo real y persistencia en estado de aplicación.
- **Lógica de Insumos Automática (Smart Config):** Cálculo dinámico de litros, combinaciones eficientes de barriles (5L, 10L, 20L, 30L) y sugerencias inteligentes según el número de invitados y tragos promedio detectando incompatibilidades del muro de coctelería.
- **Diseño Mobile-First:** Interfaz moderna y envolvente utilizando Tailwind CSS v4, garantizando una experiencia visual impecable.

### ⚙️ Automatización e Integraciones Nativas
- **Google APIs Directas:** Las sincronizaciones ocurren de manera transparente en el backend usando NodeJS y `googleapis`, eliminando dependencias externas de terceros como Make/Integromat:
  - **Google Contacts:** Sincronización inteligente de clientes, evitando duplicidades de direcciones físicas e emails. Mantiene una bitácora cronológica (Event Log) con historial de las URL de las cotizaciones en las notas del contacto.
  - **Google Calendar:** Creación directa de eventos en el calendario logístico de montaje y el calendario operacional de retiros al confirmarse la cotización, respetando la zona horaria (Timezone) chilena.
- **Sistema de Correos Automatizado (Resend):** Generación de plantillas HTML responsivas y dinámicas diseñadas a la medida de la marca para confirmaciones de reservas y alertas al admin, renderizadas en servidor sin afectar el cliente.
- **Base de Datos Robusta con Caché:** Supabase gestiona productos, comunas, y el historial de cotizaciones. Las lecturas clave del catálogo (como insumos o comunas y sus envíos gratis dinámicos) están optimizadas con la funcionalidad `unstable_cache` de Next.js para revalidar datos en tiempo real mediante servidor, minimizando las llamadas a la base de datos.

### 🛡️ Seguridad y Arquitectura de Sistemas
- **Next.js Server Actions:** La arquitectura de reemplazo la gestión normal de API routes con un flujo estricto sobre funciones exclusivas en servidor, brindando el máximo nivel de seguridad en mutaciones de datos (Creación u confirmación de cotizaciones).
- **Validación con Zod:** Esquemas estrictos de defensa en el backend para validar todos los datos entrantes.
- **Securización de Cálculos Financieros (Zero Trust):** Nunca se confía un precio dictado por el lado del cliente (frontend). El `WizardLogic` recalcula los totales y detecta incompatibilidades directamente obteniendo los datos vírgenes y precios vigentes almacenados en ese momento desde PostgreSQL.

---

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, SSR cache).
- **Base de Datos & ORM:** [Supabase](https://supabase.com/) (PostgreSQL).
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/).
- **Emails:** [Resend](https://resend.com/).
- **Integraciones:** [Google APIs SDK](https://console.cloud.google.com/) (Contacts People API & Calendar v3).
- **Validación de Datos:** [Zod](https://zod.dev/) & [TypeScript](https://www.typescriptlang.org/).
- **Iconografía Activa:** [Lucide React](https://lucide.dev/).
- **Variables Críticas de Entorno:** Custom centralización con `lib/config.ts`.

---

## 🏗️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/faru1983/cocktailsontap.cl.git
   cd cocktailsontap.cl
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno (.env.local):**
   ```env
   # Supabase DB Environment
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...

   # Configuración de Sitio y Branding
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ADMIN_EMAIL=...
   NEXT_PUBLIC_WHATSAPP_NUMBER=...

   # Email Service Setup
   RESEND_API_KEY=...

   # Google APIs (Contacts CRM & Calendar Logistics)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   GOOGLE_CALENDAR_RESERVA_ID=...
   GOOGLE_CALENDAR_RETIRO_ID=...
   ```

4. **Ejecutar Entorno de Desarrollo Local:**
   ```bash
   npm run dev
   ```

---

## 📄 Arquitectura del Proyecto `src` 

- **`/app`**: Manejo de rutas principales de Next.js (Home y `/cotizar` en base al Router V2) y lógicas en servidor de mutaciones de datos en `actions/`.
- **`/components`**: UI de alta fidelidad, componentes de navegación, secciones del Landing Page y vistas dinámicas e interactivas del Wizard de Cotización. Se incluyen componentes de correo (`emails/`) y componentes reusables compartidos (`ui/`).
- **`/lib`**: "Cerebro" de core logic del proyecto. Contiene lógica de negocio matemática en `wizardLogic.ts`, configuraciones globales y schemas (`types.ts`).
- **`/lib/services`**: Capa de servicios que extrae la complejidad de infraestructura (ej. `QuoteService` para BD, `GoogleSyncService` para interactuar de forma nativa con Google APIs).
- **`/public/assets`**: Recursos estáticos (logos, background images e iconografías locales de marca).

> Con la arquitectura actual, la capa de infraestructura es manejada por servicios dedicados y las mutaciones por Server Actions, brindando seguridad y reusabilidad extrema. Se ha deprecado por completo el uso de endpoints `/api`.

---

## 📄 Licencia

Este proyecto es propiedad de **Cocktails on Tap Chile**. El código se comparte con fines educativos y de referencia para la comunidad. Para usos comerciales o adaptaciones y ramas, por favor contactar a los titulares.

---

Desarrollado con ❤️ para elevar el estándar de la coctelería en Chile. 🇨🇱✨
