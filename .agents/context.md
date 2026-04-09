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

### 📅 09-04-2026 — Optimización de Cotización Manual, Precios Custom y Correcciones UI
- **Archivos creados/modificados**:
  - `app/admin/quotes/new/CreateQuoteManualClient.tsx` — Implementación de búsqueda/autofill de clientes existentes (`service_role`), inputs de precios personalizados por ítem y soporte para `className` en componente `Field`.
  - `lib/services/quoteService.ts` — Soporte para persistencia de `customPrice` en ítems de cotización manual.
  - `lib/wizardLogic.ts` — Lógica de cálculo actualizada para respetar precios manuales sobre los de catálogo.
  - `components/quote/QuoteView.tsx` — Fix de UI: placeholder "Selecciona comuna..." para evitar la selección automática de "Alhué" por defecto del navegador.
  - `lib/serverData.ts` — Nueva función `fetchAllClients` para alimentar el buscador del admin.
- **Resumen**: Se cerró el ciclo de la "Cotización Manual" permitiendo ahora: búsqueda rápida de clientes (bypass de RLS), modificación de precios individuales por barril (independiente del catálogo), y mejor UX al finalizar (link público + botones de compartir). Se resolvieron errores de tipo en la compilación de Vercel y un bug visual crítico donde el navegador forzaba la primera comuna alfabética en cotizaciones con comuna nula.

### 📅 09-04-2026 — Refactorización y Finalización del Módulo de Cotización Manual
- **Resumen**: Refactorización total del módulo manual: lógica centralizada en `wizardLogic.ts`, sistema de overrides (envío, instalación, descuento), y UI reactiva 2x2. Soporte para rangos de retiro y validaciones robustas.

### 📅 07-04-2026 — Análisis profundo y documentación
- **Resumen**: Reescritura de `rules.md` y `README.md` con arquitectura detallada, esquema DB e integraciones. Creación del sistema de contexto AI.

### 📅 07-04-2026 — Optimización Mobile UI
- **Resumen**: Corrección de overflow horizontal en Gastos/Medios de Pago vía modales, responsividad de métricas y formateo de fechas en el dashboard.

### 📅 06-04-2026 — Modernización Dashboard Admin
- **Resumen**: Migración completa a Tailwind CSS v4 + Lucide. Refactorización de Gastos (100% responsive) y consolidación de métricas BI.

---

## 🐛 Issues Conocidos / Pendientes

- [ ] `lib/emails.ts` (HTML legacy) coexiste con React Email — pendiente migración completa.
- [ ] Centralizar la lógica de `shipping_cost` reactivo en el admin (actualmente se maneja vía overrides manuales o sugerencia base).

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

*Última actualización: 09-04-2026 (Fin de Sesión)*
