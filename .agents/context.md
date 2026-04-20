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

## 📐 Arquitectura Avanzada y Detalles de Sistema
- **Drag & Drop Nativo**: Implementado en el panel admin para productos, categorías y unidades.
- **Algoritmo SmartConfig**: Motor de optimización combinatorial que sugiere la mejor mezcla de barriles basada en invitados y consumo.
- **Dualidad de Flujos**: Separación completa de lógica entre "Reserva de Eventos" (consultiva) y "Compra Directa" (transaccional/e-commerce).
- **Cerebro Central (Variables)**: Resolución dinámica de variables para sincronización con Google Sync.
- **Logística 24h**: Soporte para fechas de retiro automáticas y ventanas horarias configurables.

---

## 🔄 Últimos Cambios (Historial de Sesiones)

### 20-04-2026 — Desactivación de Automatizaciones en Admin y Control Manual
- **Cambio Crítico**: Se desactivó el envío automático de emails y creación de eventos en Google Calendar para cotizaciones/ventas creadas desde el panel Admin.
- **Ventas Directas**: Se ajustó la lógica para que las ventas directas (`service_type: 'direct'`) solo generen el evento de entrega en el calendario, omitiendo el de retiro.
- **Base de Datos**: Se añadió la columna `service_type` a `quotes` para diferenciar entre eventos y ventas directas.
- **UI Admin**: Se implementaron "Disparadores Manuales" en la vista de detalle de cotización para enviar emails y sincronizar con Calendar bajo demanda.
- **Backend**: Refactorización de `GoogleSyncService` y `createQuote` para soportar el bypass administrativo y la lógica simplificada de calendario.

### 07-04-2026 — Estado Inicial del Contexto
- Implementación base del CRM y sistema de cotizaciones.

- **Corrección de RLS en Carga de Imágenes (Admin)**:
  - **Problema**: Error "new row violates row-level security policy" al subir imágenes de productos desde el panel admin.
  - **Causa**: Se estaba usando el cliente de Supabase `anon` desde el lado del cliente (browser), el cual no tiene permisos `INSERT` en el bucket `product-images`.
  - **Solución**: Se movió la lógica de subida y eliminación de imágenes a **Server Actions** (`uploadImage` y `deleteImage` en `app/actions/admin/productActions.ts`) que utilizan el cliente `service_role`, el cual tiene permisos totales y bypass de RLS.
  - **Refactorización**: Se actualizó `ProductsClient.tsx` para consumir estas nuevas acciones mediante `FormData` y `useTransition`.

---

## 🐛 Issues Conocidos / Pendientes

- [ ] `lib/emails.ts` (HTML legacy) coexiste con React Email — pendiente migración completa.
- [ ] Centralizar la lógica de `shipping_cost` reactivo en el admin.

---

## 📁 Archivos Clave para Referencia Rápida

| Necesitas... | Archivo |
|-------------|---------|
| Cambiar precios/constantes | `lib/config.ts` |
| Agregar un campo a cotización | `lib/types.ts` + `lib/services/quoteService.ts` |
| Lógica SmartConfig / Precios | `lib/wizardLogic.ts` |
| Sincronización Google | `lib/services/googleSyncService.ts` |
| Configurar templates dinámicos | Tabla `site_settings` vía `/admin/settings` |

*Última actualización: 20-04-2026*

