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

### 📅 19-04-2026 — Flexibilización de Invitados y Sugerencia Inteligente (Sesión Actual)
- **Cambios en Lógica de Negocio**:
  - `lib/wizardLogic.ts`: Implementado nuevo algoritmo combinatorial para `calculateSmartConfig`. Ahora optimiza la mezcla de barriles (5L, 10L, 20L, 30L) buscando mínimo desperdicio y máxima variedad.
  - **Rendimiento Mixto**: El algoritmo usa 6 tragos/L para la sugerencia (optimista) pero la UI muestra 5 tragos/L (conservador) para evitar falsas expectativas.
  - **Flexibilidad Total**: Eliminada la restricción de 10 invitados mínimos. Ahora se permite cotizar eventos desde **1 invitado** (cambios en `confirmQuote.ts`, `useWizard.ts` y `WizardStep1.tsx`).
- **Mejoras UI/UX**:
  - `components/wizard/WizardStep3.tsx`: Rediseño premium de la cabecera del catálogo. Nueva tarjeta de "Sugerencia del Experto" con gradientes y burbujas animadas de rendimiento (estilo landing page).
  - **Formateo de Etiquetas**: Sugerencias ahora son descriptivas (ej: "2 Barriles de 5L + 1 de 10L").

### 📅 18-04-2026 — Refinamiento Direct Sale y Desacople de Vistas
- **Resumen**: Se consolidó el flujo E-Commerce para Barriles Desechables. Se crearon vistas separadas (`EventQuoteView` vs `DirectQuoteView`) y se corrigieron bloqueos de WhatsApp pop-ups asíncronos añadiendo botones de fallback "Abrir WhatsApp".
- **Admin**: El panel de creación manual ahora bifurca entre Evento y Compra Directa mediante un switch de UI, simplificando la carga de datos.

### 📅 17-04-2026 — Sincronización y Refinado de Venta Directa
- **Resumen**: Desacople profundo de emails en `EmailShared.tsx`. Se validó que el cálculo de litros solo sume productos líquidos (unidad 'L'). Creación de suite de tests para correos en `/tests`.

### 📅 14-04-2026 — Desacople Arquitectónico Paso 0
- **Resumen**: Implementado `CotizarGateway` (Paso 0) para que el usuario elija servicio antes de inicializar el wizard. Aislamiento total de `DirectWizardShell`.

---

## 🐛 Issues Conocidos / Pendientes

- [ ] `lib/emails.ts` (HTML legacy) coexiste con React Email — pendiente migración completa.
- [ ] Centralizar la lógica de `shipping_cost` reactivo en el admin (actualmente se maneja vía overrides manuales o sugerencia base).

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
