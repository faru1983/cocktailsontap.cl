# 🍸 Cocktails on Tap Chile - Barra Móvil Autoservicio

¡Bienvenido al repositorio oficial de **Cocktails on Tap Chile**! Esta es una aplicación web moderna diseñada para ofrecer una experiencia premium en la cotización y gestión de servicios de barra móvil y estaciones de autoservicio de coctelería.

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-blue?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)

---

## 🚀 Características Principales

- **Cotizador Inteligente (Wizard):** Proceso paso a paso refactorizado con lógica desacoplada y robusta.
- **Arquitectura de Alto Rendimiento:** Implementación de **Server Components** y **Caché de Servidor** (5 min) para minimizar latencia y carga en base de datos.
- **Cálculo de Insumos:** Algoritmos automáticos para configuración de barriles (5L/10L) según invitados y duración.
- **SEO & Web Vitals:** Generación automática de `sitemap.xml` y `robots.txt`, optimización de metadatos y seguridad avanzada.
- **Integración con Supabase:** Gestión centralizada de productos, precios, categorías y comunas.
- **WhatsApp Bridge:** Generador de cotizaciones detalladas con formato profesional para envío directo.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js](https://nextjs.org/) (App Router) + React 19.
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) v4.
- **Iconografía:** [Lucide React](https://lucide.dev/).
- **Backend:** [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage).

---

## 🛠️ Instalación y Desarrollo Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/faru1983/cocktailsontap.cl.git
   cd cocktailsontap.cl
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Crea un archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave
   NEXT_PUBLIC_WHATSAPP_NUMBER=56929672978
   ```

4. **Scripts disponibles:**
   - `npm run dev`: Inicia el servidor de desarrollo.
   - `npm run build`: Genera el build de producción (valida tipos y rutas).

---

## 🏗️ Arquitectura y Mejores Prácticas

El proyecto sigue principios de **Clean Architecture**:
- **`lib/wizardLogic.ts`**: Lógica de negocio pura, independiente de React y fácil de testear.
- **`lib/serverData.ts`**: Capa de datos en servidor con `unstable_cache`.
- **`components/ui`**: Componentes atómicos reutilizables (ej: `SelectField`).
- **`hooks/`**: Gestión de estado de UI y efectos secundarios.

---

## 📄 Licencia

Este proyecto es privado para Cocktails on Tap Chile. Todos los derechos reservados.

---

Desarrollado con ❤️ para elevar la experiencia de coctelería en Chile. 🇨🇱
