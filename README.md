# 🍸 Cocktails on Tap Chile - Barra Móvil & Autoservicio

¡Bienvenido al repositorio oficial de **Cocktails on Tap Chile**! Esta es una aplicación web de nivel producción diseñada para ofrecer una experiencia premium en la cotización y gestión de servicios de barra móvil y estaciones de autoservicio de coctelería.

El proyecto está construido con un enfoque en **arquitectura limpia, seguridad y automatización**, siendo ideal tanto para el negocio real como para servir de referencia a la comunidad sobre integraciones modernas.

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-blue?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Resend](https://img.shields.io/badge/Emails-Resend-000000?style=flat&logo=resend)](https://resend.com/)
[![Zod](https://img.shields.io/badge/Validation-Zod-3068b7?style=flat&logo=zod)](https://zod.dev/)

---

## 🚀 Características Principales

### 💎 Experiencia de Usuario (Wizard)
- **Cotizador Premium:** Flujo de 6 pasos optimizado para conversión, con validaciones en tiempo real y persistencia.
- **Lógica de Insumos Automática:** Cálculo dinámico de litros, combinaciones de barriles (5L, 10L, 20L, 30L) y sugerencias según el número de invitados.
- **Diseño Mobile-First:** Interfaz moderna y envolvente utilizando Tailwind CSS v4 y animaciones fluidas.

### ⚙️ Automatización y Backend
- **Integración con Make (Integromat):** Webhooks automáticos que sincronizan:
  - **Calendario de Eventos:** Creación automática del evento de montaje/servicio.
  - **Calendario de Retiros:** Gestión logística independiente para el retiro de equipos por fecha y rango horario.
- **Sistema de Emails (Resend):** Plantillas HTML mobile-first refactorizadas para notificaciones a clientes y administración, manteniendo identidad de marca.
- **Base de Datos Robusta:** Supabase gestiona productos, categorías, comunas y el historial de cotizaciones con alta integridad.

### 🛡️ Seguridad y Robustez
- **Validación con Zod**: Esquemas estrictos para todas las entradas de datos en Server Actions, garantizando integridad y protegiendo contra inyecciones de datos corruptos.
- **Seguridad Senior (Server-Side Recalculate)**: Los totales y costos no se aceptan directamente del cliente; el servidor recalcula todo basándose en la base de datos durante la confirmación.
- **Naive DateTime Sync**: Sistema de sincronización horaria custom para Make.com que evita discrepancias entre el servidor (UTC) y Chile (GMT-3/-4) al calendarizar eventos.

---

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions).
- **Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL).
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/).
- **Emails:** [Resend](https://resend.com/).
- **Automatización:** [Make.com](https://make.com/) (Webhooks & Google Calendar).
- **Iconografía:** [Lucide React](https://lucide.dev/).
- **Validación:** [Zod](https://zod.dev/) & [TypeScript](https://www.typescriptlang.org/).
- **Configuración Centralizada:** Custom `lib/config.ts` system.

---

## 🧪 Suite de Pruebas (Test Suite)

Se incluye una carpeta de `tests/` con scripts especializados para garantizar la continuidad operativa:

- **`test-db-schema.js`**: Valida la integridad de las tablas y columnas críticas en Supabase.
- **`test-calculations.js`**: Verifica que las fórmulas de precios, envíos e instalaciones sean exactas.
- **`test-email-preview.ts`**: Sistema para enviar los 4 tipos de correos reales a la bandeja del administrador para previsualizar diseño y datos.
- **`trigger-make.js`**: Simula el envío de datos a Make para probar los escenarios de sincronización de calendarios.
- **`test-create-full-quote.js`**: Genera una cotización completa desde el backend para pruebas de flujo de datos.

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
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...

   # Configuración de Sitio
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   # Integraciones
   RESEND_API_KEY=...
   MAKE_WEBHOOK_CALENDAR_URL=...
   ADMIN_EMAIL=contacto@cocktailsontap.cl
   NEXT_PUBLIC_WHATSAPP_NUMBER=56929672978
   ```

4. **Ejecutar Desarrollo:**
   ```bash
   npm run dev
   ```

5. **Ejecutar Tests:**
   ```bash
   # Ejemplo de test de emails
   npx tsx --tsconfig tsconfig.json --env-file=.env.local tests/test-email-preview.ts
   ```

---

## 📄 Arquitectura del Proyecto

- **`/app`**: Rutas de Next.js y Server Actions (`actions/`).
- **`/components`**: UI dividida en componentes reutilizables y secciones del Wizard.
- **`/lib`**: "Cerebro" del proyecto. Lógica de negocio, configuración y helpers de datos.
- **`/tests`**: Scripts de validación y herramientas de desarrollo.
- **`/public/assets`**: Recursos estáticos (logos, imágenes).
- **`.ai-context.md`**: Memoria del proyecto para IA (se actualiza automáticamente tras cambios importantes).

---

## 📄 Licencia

Este proyecto es propiedad de **Cocktails on Tap Chile**. El código se comparte con fines educativos y de referencia para la comunidad. Para usos comerciales o adaptaciones, por favor contactar al propietario.

---

Desarrollado con ❤️ para elevar el estándar de la coctelería en Chile. 🇨🇱✨
