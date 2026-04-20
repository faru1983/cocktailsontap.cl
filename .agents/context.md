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

- **Arquitectura de Rutas Específicas (/eventos y /barriles)**:
  - **Nuevas Rutas**: Creadas rutas directas `app/eventos/page.tsx` y `app/barriles/page.tsx` para accesos directos profesionales.
  - **Extensión de `CotizarGateway`**: Agregada prop `initialServiceType` para permitir el bypass de la selección manual y cargar el modo de wizard correspondiente inmediatamente.
  - **Preservación de Legado**: Las rutas `/cotizar` (gateway) y `/cotizar/[token]` (visor de cotizaciones) se mantienen intactas para asegurar compatibilidad con links existentes.

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

