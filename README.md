# 🍸 Cocktails on Tap Chile - Barra Móvil & Dispensador

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015/16-blue?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)

**Cocktails on Tap Chile** es una plataforma premium diseñada para la automatización de cotizaciones y gestión logística de servicios de barra móvil y estaciones de coctelería autoservicio.

El proyecto destaca por su integración nativa (Server-to-Server) con Google Workspace y Resend, optimizando recursos para funcionar eficientemente en capas gratuitas como Vercel y Supabase.

---

## 🚀 Características Principales

### 💎 Experiencia del Usuario (Wizard)
- **Cotizador Inteligente**: Flujo interactivo que valida volumen de litros, combinaciones de barriles y compatibilidad con el "Muro de Coctelería".
- **Lógica de Rendimiento**: Cálculo automático: 1 Litro = 5 Cócteles.
- **Visuales Inmersivos**: Diseño mobile-first con Tailwind CSS v4 y estética de lujo oscuro.

### ⚙️ Automatización Directa (Zero Middlemen)
- **CRM Integration (Google Contacts)**: Sincronización inteligente de clientes con historial de cotizaciones en notas, evitando duplicados.
- **Logística Operacional (Google Calendar)**: Creación automática de eventos para montajes (Reserva) y logística inversa (Retiro).
- **Mailing Transaccional (Resend + React Email)**: Plantillas responsivas diseñadas con JSX para máxima seguridad y branding.

### 🛡️ Seguridad & Arquitectura
- **Buzón de Server Actions**: Mutaciones protegidas y tipadas con Zod.
- **Zero Trust Pricing**: Los totales se recalculan exclusivamente en el servidor consultando precios vigentes en Supabase.
- **Middleware Security**: Protección de rutas administrativas `/admin`.

---

## 🛠️ Stack Tecnológico

- **Frontend/Backend**: Next.js 15+ (App Router).
- **Styling**: Tailwind CSS v4.
- **Database**: Supabase (PostgreSQL).
- **Email**: Resend.
- **Integrations**: Google APIs SDK (People/Calendar).
- **Type Safety**: TypeScript + Zod.

---

## ⚙️ Configuración del Entorno (`.env.local`)

Para que el proyecto funcione correctamente, se deben configurar las siguientes variables:

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Key pública para el cliente.
- `SUPABASE_SERVICE_ROLE_KEY`: Key secreta para operaciones administrativas (Google Sync/Admin).

### Google APIs (OAuth 2.0)
- `GOOGLE_CLIENT_ID`: ID de cliente obtenido en Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: Secreto de cliente de Google Cloud.
- `GOOGLE_REFRESH_TOKEN`: Token de refresco obtenido via OAuth Playground (Scopes: People API, Calendar API).
- `GOOGLE_CALENDAR_RESERVA_ID`: ID del calendario para eventos de reserva (instalación).
- `GOOGLE_CALENDAR_RETIRO_ID`: ID del calendario para eventos de retiro (logística).

### Email (Resend)
- `RESEND_API_KEY`: API Key de Resend.
- `ADMIN_EMAIL`: Email que recibirá las alertas de nuevas cotizaciones.

### Site Config
- `NEXT_PUBLIC_SITE_URL`: URL base del sitio (ej. `http://localhost:3000` o `https://tu-dominio.com`).
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: Número de contacto en formato internacional (ej. `56912345678`).
- `ADMIN_PASSWORD`: Contraseña para acceder al panel `/admin`.

---

## 🏗️ Instalación & Desarrollo

1. **Clonar y entrar**:
   ```bash
   git clone https://github.com/faru1983/cocktailsontap.cl.git
   cd cocktailsontap.cl
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

---

## 📂 Estructura del Proyecto

- `/app`: Rutas, layouts y Server Actions.
- `/components`: UI Atómica (`ui/`), Secciones de Landing y Wizard, y Plantillas de Email (`emails/`).
- `/lib`: Lógica de negocio (`wizardLogic.ts`), configuraciones y Schemas.
- `/lib/services`: Capa de abstracción para servicios externos y base de datos.
- `/public`: Assets estáticos y multimedia.

---

Desarrollado con ❤️ por **Cocktails on Tap Chile**. 🇨🇱🍸
