# 📋 Cocktails on Tap — Contexto AI Actualizado

> Este archivo se actualiza al final de cada sesión de trabajo con IA.
> **Léelo antes de hacer cualquier cambio para entender el estado actual del proyecto.**

---

## 🏗️ Resumen del Proyecto

**Cocktails on Tap Chile** es una plataforma fullstack (Next.js 16 + Supabase) para automatizar cotizaciones y gestión logística de un servicio de barra móvil de cócteles en barril.

### Componentes Clave
- **Landing Page**: Sitio público con catálogo de cócteles y CTA hacia el wizard.
- **Wizard de Cotización**: Flujo interactivo de 6 pasos para que el cliente auto-cotice su evento.
- **Sistema de Confirmación**: URL pública con token (`/cotizar/[token]`) donde el cliente confirma su reserva.
- **Panel Admin** (`/admin`): Dashboard con KPIs, gestión de cotizaciones, clientes, productos, gastos, estadísticas, y configuración dinámica.
- **Integraciones**: Google Contacts (CRM), Google Calendar (logística), Resend (emails transaccionales).

### Stack
Next.js 16 · React 19 · Tailwind CSS v4 · Supabase · Resend · Google APIs · TypeScript · Zod · lucide-react

---

## 📊 Estado Actual del Proyecto

- **Producción**: ✅ Desplegado en Vercel ([cocktailsontap.cl](https://cocktailsontap.cl))
- **Base de datos**: ✅ Supabase productivo con todas las tablas
- **Google Sync**: ✅ Contacts + Calendar funcionales
- **Emails**: ✅ React Email operativo (4 tipos de email)
- **Admin Dashboard**: ✅ Completo con módulos de cotizaciones, clientes, productos, gastos, estadísticas, logs, recordatorios y settings
- **SEO**: ✅ robots.ts + sitemap.ts + OpenGraph + GA4 + Meta Pixel

---

## 🔄 Últimos Cambios (Historial de Sesiones)

### 📅 09-04-2026 — Refactorización y Finalización del Módulo de Cotización Manual
- **Archivos creados/modificados**:
  - `app/admin/quotes/new/CreateQuoteManualClient.tsx` — Refactorización total: lógica centralizada en `wizardLogic.ts`, sistema de overrides (envío, instalación, descuento), y UI reactiva 2x2 para logística.
  - `app/actions/createQuote.ts` — Soporte para overrides de costos y descuentos manuales.
  - `lib/services/quoteService.ts` — Persistencia robusta de descuentos e integración de `overrides` en la creación de borradores.
- **Resumen**: Se completó el nuevo módulo de creación manual. Ahora es capaz de sugerir precios reactivamente (ej: $50.000 automático para Muro), permite visualización de precios en el buscador de productos, maneja rangos de horario de retiro (todo el día o horas específicas) y soporta descuentos extra. Todo el cálculo emula exactamente al wizard de cliente usando la misma "fuente de verdad" (`calculateSummaryData`), garantizando consistencia total en el CRM y emails. Se aplicaron optimizaciones de recursos (useMemo, unstable_cache) para la capa gratuita.

### 📅 07-04-2026 — Análisis profundo y documentación
- **Archivos modificados**:
  - `.agents/rules/rules.md` — Reescritura completa con arquitectura detallada, esquema DB, flujos de ejecución, integraciones, seguridad, y protocolo de contexto AI
  - `README.md` — Reescritura completa como documentación exhaustiva para desarrolladores nuevos (instalación, schema SQL, flujos de negocio, integraciones, convenciones)
  - `.agents/context.md` — **[NUEVO]** Archivo de contexto AI que se actualiza cada sesión
- **Resumen**: Análisis profundo de todo el proyecto. Se mejoró la documentación para compartir el proyecto como open source en GitHub.

### 📅 07-04-2026 — Optimización Mobile UI
- **Archivos modificados**: `GastosClient.tsx`, componentes admin varios
- **Resumen**: Corrección de overflow horizontal en botones "Agregar" de Gastos y Medios de Pago (modales), formateo de fechas sin line-break, y responsividad de valores monetarios en cards del dashboard.

### 📅 06-04-2026 — Modernización Dashboard Admin
- **Archivos modificados**: `GastosClient.tsx`, `StatsClient.tsx`, páginas admin varias
- **Resumen**: Migración completa de UI legacy a Tailwind CSS v4 + Lucide. Refactorización del módulo de Gastos (100% responsive). Consolidación de métricas BI en la página de estadísticas.

### 📅 05-04-2026 — Wizard UX + Debugging Sync
- **Archivos modificados**: Steps del wizard, admin logs, server actions
- **Resumen**: Campos de contacto obligatorios en el wizard. Debugging de sincronización Google Calendar para cotizaciones específicas. Implementación de logging robusto para diagnóstico de errores de sincronización.

---

## 🐛 Issues Conocidos / Pendientes

- [ ] `lib/emails.ts` (HTML legacy) coexiste con React Email — pendiente migración completa y eliminación del archivo legacy
- [ ] `app/api/` está vacío — directorio puede eliminarse si no se planean API routes
- [ ] El admin layout usa `style={{}}` inline en vez de clases Tailwind (decisión intencional por Server Component constraints)

---

## 📁 Archivos Clave para Referencia Rápida

| Necesitas... | Archivo |
|-------------|---------|
| Cambiar precios/costos/constantes | `lib/config.ts` |
| Agregar un campo a cotización | `lib/types.ts` + `lib/services/quoteService.ts` + DB migration |
| Modificar lógica de precios | `lib/wizardLogic.ts` → `calculateSummaryData()` |
| Cambiar cómo se sincronizan contactos | `lib/services/googleSyncService.ts` + `lib/googleSync.ts` |
| Modificar templates de email | `components/emails/QuoteEmail.tsx` o `ConfirmationEmail.tsx` |
| Agregar nueva sección al admin | `app/admin/[modulo]/page.tsx` + `AdminSidebar.tsx` |
| Cambiar protección de rutas | `proxy.ts` (NO crear middleware.ts) |
| Agregar nuevo server action admin | `app/actions/admin/adminActions.ts` |
| Modificar caché de datos | `lib/serverData.ts` |
| Configurar templates dinámicos | Tabla `site_settings` vía `/admin/settings` |

---

*Última actualización: 09-04-2026*
