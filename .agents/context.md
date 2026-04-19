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

### 📅 19-04-2026 — Seguridad, Hardening y Corrección de Imágenes (Sesión Actual)
- **Seguridad e Infraestructura**:
  - **Eliminación de Secretos**: Se removió la sal de hash hardcodeada en `lib/adminAuth.ts` y `proxy.ts`, reemplazándola por la variable de entorno `AUTH_SALT`.
  - **Hardening de Repositorio**: El proyecto ahora es seguro para ser compartido públicamente en GitHub. Se creó `.env.example` como plantilla y se actualizó `.env.local` con las nuevas configuraciones.
  - **Vercel**: Se requiere la configuración de `AUTH_SALT` en el panel de Vercel para el acceso administrativo.
- **Visualización de Productos**:
  - **Corrección de Imágenes**: Se actualizó `lib/serverData.ts` para recuperar `image_url` específico por tamaño/formato.
  - **Lógica de Fallback**: Se implementó una lógica en `ProductCard` que prioriza la imagen del tamaño (`sizeInfo.image`) y, si no existe, cae automáticamente a la imagen principal del producto (`product.image`).
  - **Consistencia Total**: Se sincronizaron los mapeos de productos en los Wizards (Evento y Directo) y las vistas de confirmación pública (`EventQuoteView`, `DirectQuoteView`) para asegurar que no aparezcan productos sin imagen.

### 📅 19-04-2026 — Flexibilización de Invitados y Sugerencia Inteligente
- **Cambios en Lógica de Negocio**:
  - `lib/wizardLogic.ts`: Implementado nuevo algoritmo combinatorial para `calculateSmartConfig`. Ahora optimiza la mezcla de barriles (5L, 10L, 20L, 30L) buscando mínimo desperdicio y máxima variedad.
  - **Flexibilidad Total**: Eliminada la restricción de 10 invitados mínimos. Ahora se permite cotizar eventos desde **1 invitado**.
- **Mejoras UI/UX**:
  - `components/wizard/WizardStep3.tsx`: Rediseño premium de la cabecera del catálogo con tarjeta de "Sugerencia del Experto" y gradientes animados.

### 📅 18-04-2026 — Refinamiento Direct Sale y Desacople de Vistas
- **Resumen**: Consolidación de flujo E-Commerce para Barriles Desechables. Desacople de vistas de confirmación y corrección de bloqueos de WhatsApp.

### 📅 17-04-2026 — Sincronización y Refinado de Venta Directa
- **Resumen**: Desacople de emails en `EmailShared.tsx`. Validación de cálculos de litros para solo sumar productos líquidos.

### 📅 14-04-2026 — Desacople Arquitectónico Paso 0
- **Resumen**: Implementado `CotizarGateway` para elección de servicio y aislamiento de `DirectWizardShell`.

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

*Última actualización: 19-04-2026*

