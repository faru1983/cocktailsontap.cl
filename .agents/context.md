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
- **Drag & Drop Nativo**: Implementado sin librerías externas en `ProductsClient.tsx` para productos, categorías, unidades y precios/formatos.
- **Gestión Relacional de Unidades**: Soporte completo para unidades de medida (`measurement_units`) con abreviaciones y gestión de orden.
- **Cerebro Central (Variables)**: Sistema Dinámico de Resolución de Variables (`SettingsService`) para plantillas de Google Calendar y Contacts, soportando `{{total_liters}}`, `{{payments_summary}}`, `{{pickup_time}}`, etc.
- **Logística de Compra Directa**: Costos de envío diferenciados en la tabla `comunas` y uso del calendario dedicado `GOOGLE_CALENDAR_DESECHABLE_ID`.
- **Iconografía Admin**: Catálogo configurable en `lib/icons.tsx` para la representación visual de temas de evento.
- **Selector de Galería**: Integración de picker de imágenes en el flujo de edición de productos para reutilizar assets de Supabase Storage.

---

## 🔄 Últimos Cambios (Historial de Sesiones)

### 📅 14-04-2026 — Desacople Arquitectónico de Flujos (Evento vs. Compra Directa)
- **Archivos creados/modificados**:
  - `app/cotizar/page.tsx` — Enrutador actualizado para usar el nuevo `CotizarGateway`.
  - `components/wizard/CotizarGateway.tsx` — Nuevo componente de entrada (Paso 0) que permite al usuario escoger el tipo de servicio antes de inicializar ningún estado.
  - `components/wizard/WizardShell.tsx` y `components/wizard/WizardStep*.tsx` — Se revirtieron a su estado original (solo eventos), removiendo 100% las condicionales y mutaciones `isDirect`.
  - `components/wizard/direct/*` — Se finalizó la suite exclusiva para "Venta Directa" con su propio orquestador (`DirectWizardShell`), selector de productos limitados a 5L, formulario de despacho sin hora específica, y resumen simplificado, logrando aislamiento total de lógica.
  - `hooks/useWizard.ts` — Adaptado para recibir `initialServiceType` e inicializar el estado del flujo seleccionado apropiadamente.
- **Resumen**: Se completó el desacople propuesto para el módulo de reserva. Ahora la cotización de eventos (consultiva/reserva) corre por un Shell totalmente separado del flujo de compra directa (transaccional de barriles desechables). Esto resolvió el problema de escalabilidad del código y eliminó múltiples componentes altamente acoplados con condicionales visuales, garantizando que futuras modificaciones a la venta directa no impacten negativamente las reservas de muro/portátil.

### 📅 14-04-2026 — Integración Compra Directa (Barril Desechable) Part 1
- **Archivos creados/modificados**:
  - `components/wizard/*` — Paso 0 agregado para bifurcar Flujo (Evento vs Compra Directa). Paso 1, 3 y 6 adaptados para manejar el nuevo tipo de despacho (`isDirect`) y reestructurar formularios. Se bloqueó la fecha pre-existente o presente para envíos de desechables.
  - `components/quote/*` — Modulo `QuoteView` adaptado para que el pago de compras directas sea 100% upfront con un contrato de reserva específico para el Delivery de desechables.
  - `app/actions/createQuote.ts`, `app/actions/confirmQuote.ts` — Lógica adaptada para sincronización de correos y eventos de calendario usando un ID nuevo `GOOGLE_CALENDAR_DESECHABLE_ID`.
  - `components/emails/DirectSaleEmail.tsx`, `components/emails/ConfirmationEmail.tsx` — Textos de emails cambiados a "Compra/Pedido Confirmado" con flujo distinto (no se requiere pagar 50% extra sino el total previamente).
- **Resumen**: Se completó la primera iteración de la venta de barriles desechables (5L) bajo una figura de compra directa (sin retorno ni instalación). El flujo enruta las lógicas de precios de `quote`, manda emails específicos adaptados, e impacta el Dashboard con estados en calendarios logísticos correspondientes.

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

### 📅 17-04-2026 — Sincronización y Refinado de Venta Directa
- **Refinado de Emails**: Se desacopló profundamente el flujo de **Compra Directa** en `EmailShared.tsx`, ocultando métricas irrelevantes (tragos x pers., invitados, temática) y eliminando la fila de dispensador/instalación para este flujo.
- **Rendimiento Inteligente**: Se validó que el cálculo de `total_liters` solo sume productos líquidos (unidad 'L'), asegurando que ítems como hielo o decoraciones no inflen las métricas del correo.
- **Infraestructura de Tests**: Se creó la carpeta `/tests` en la raíz y se implementó `test_direct_sale_emails.ts` para disparar pruebas reales de los 4 escenarios de correo (Cliente/Admin, Borrador/Confirmado) vía `Resend`.
- **UI/UX**: Se simplificó la "Fecha Despacho" en correos directos para mostrar solo la fecha y ocultar la hora, alineándose con el modelo de negocio transaccional.

### 📅 18-04-2026 — Desacople de Vistas Públicas (EventQuoteView vs. DirectQuoteView)
- **Archivos creados/modificados**:
  - `components/quote/EventQuoteView.tsx` — Versión especializada para eventos, eliminando lógica de venta directa.
  - `components/quote/DirectQuoteView.tsx` — Nueva vista simplificada para ventas directas (100% pago, sin muro, términos específicos).
  - `app/cotizar/[token]/page.tsx` — Implementado "switcher" de componentes basado en el tipo de dispensador.
  - `app/actions/confirmQuote.ts` — Validación condicional server-side y corrección en la detección de tipo de venta.
  - `lib/types.ts` — Relajado `ConfirmQuoteSchema` para soportar ambos flujos.
  - `app/actions/confirmQuote.ts` — Se corrigió un error de importación (`fetchComunas` no existía), se optimizó la carga de datos y se agregaron fallbacks para propiedades opcionales (`guests`, `startTime`) para evitar errores de tipo en el build.
  - `app/actions/admin/adminActions.ts` — Se corrigió un error de tipo (TypeScript) en el desestructurado de `fetchAllProductData`.
  - `components/wizard/direct/DirectStep1Products.tsx` y `components/wizard/WizardStep3.tsx` — Se resolvieron problemas de tipado agregando los campos faltantes (`sizeValue`, `unitId`, `isDisposable`, `unit`) en el mapeo de `ProductPrice` hacia `ICart`.
  - `lib/services/googleSyncService.ts` — Se reemplazaron las llamadas al atributo inexistente `service_type` por la lógica correcta de negocio evaluando `dispenser === 'desechable'`.
- **Resumen**: Se eliminó el código "spaghetti" que mezclaba eventos y ventas directas en la vista pública de cotizaciones. Ahora cada flujo tiene su propio componente aislado, lo que permite reglas de negocio diferenciadas (como la obligatoriedad de incluir al menos un cóctel en ventas directas) y una experiencia de usuario mucho más limpia y coherente. Se resolvieron errores de compilación críticos tanto en las acciones de cliente como de administración para asegurar el despliegue en Vercel.

### 📅 18-04-2026 — Automatización y Flujo E-commerce (Venta Directa) Parte 2
- **Archivos creados/modificados**:
  - `components/wizard/direct/DirectWizardSuccess.tsx` — Nueva pantalla de éxito dedicada al flujo e-commerce que instruye al usuario a transferir el 100% del pago.
  - `components/wizard/direct/DirectWizardShell.tsx` — Transición rediseñada para usar `DirectWizardSuccess`. Resolución del bug donde la advertencia de validación persistía al cambiar de paso.
  - `components/quote/DirectQuoteView.tsx` — Añadido banner explícito de "Validación de Pago Pendiente" con detalle de cobro para cotizaciones aprobadas con saldo pendiente.
  - `app/actions/createQuote.ts` — Corrección de tipado al invocar `updateContactConfirmedStatus` removiendo un parámetro depreciado.
  - `lib/wizardLogic.ts` — Corrección de la plantilla auto-generada de WhatsApp para titularla adecuadamente como *NUEVO PEDIDO DIRECTO*.
- **Resumen**: Se consolidó definitivamente el flujo E-Commerce transaccional para Barriles Desechables. Los clientes ahora enfrentan directrices explícitas sobre el 100% de pago por adelantado, complementado con flujos inmediatos de validación (Success Screen adaptado y directrices en DirectQuoteView).

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
- **Drag & Drop Nativo**: Implementado sin librerías externas en `ProductsClient.tsx` para productos, categorías, unidades y precios/formatos.
- **Gestión Relacional de Unidades**: Soporte completo para unidades de medida (`measurement_units`) con abreviaciones y gestión de orden.
- **Cerebro Central (Variables)**: Sistema Dinámico de Resolución de Variables (`SettingsService`) para plantillas de Google Calendar y Contacts, soportando `{{total_liters}}`, `{{payments_summary}}`, `{{pickup_time}}`, etc.
- **Logística de Compra Directa**: Costos de envío diferenciados en la tabla `comunas` y uso del calendario dedicado `GOOGLE_CALENDAR_DESECHABLE_ID`.
- **Iconografía Admin**: Catálogo configurable en `lib/icons.tsx` para la representación visual de temas de evento.
- **Selector de Galería**: Integración de picker de imágenes en el flujo de edición de productos para reutilizar assets de Supabase Storage.

---

## 🔄 Últimos Cambios (Historial de Sesiones)

### 📅 14-04-2026 — Desacople Arquitectónico de Flujos (Evento vs. Compra Directa)
- **Archivos creados/modificados**:
  - `app/cotizar/page.tsx` — Enrutador actualizado para usar el nuevo `CotizarGateway`.
  - `components/wizard/CotizarGateway.tsx` — Nuevo componente de entrada (Paso 0) que permite al usuario escoger el tipo de servicio antes de inicializar ningún estado.
  - `components/wizard/WizardShell.tsx` y `components/wizard/WizardStep*.tsx` — Se revirtieron a su estado original (solo eventos), removiendo 100% las condicionales y mutaciones `isDirect`.
  - `components/wizard/direct/*` — Se finalizó la suite exclusiva para "Venta Directa" con su propio orquestador (`DirectWizardShell`), selector de productos limitados a 5L, formulario de despacho sin hora específica, y resumen simplificado, logrando aislamiento total de lógica.
  - `hooks/useWizard.ts` — Adaptado para recibir `initialServiceType` e inicializar el estado del flujo seleccionado apropiadamente.
- **Resumen**: Se completó el desacople propuesto para el módulo de reserva. Ahora la cotización de eventos (consultiva/reserva) corre por un Shell totalmente separado del flujo de compra directa (transaccional de barriles desechables). Esto resolvió el problema de escalabilidad del código y eliminó múltiples componentes altamente acoplados con condicionales visuales, garantizando que futuras modificaciones a la venta directa no impacten negativamente las reservas de muro/portátil.

### 📅 14-04-2026 — Integración Compra Directa (Barril Desechable) Part 1
- **Archivos creados/modificados**:
  - `components/wizard/*` — Paso 0 agregado para bifurcar Flujo (Evento vs Compra Directa). Paso 1, 3 y 6 adaptados para manejar el nuevo tipo de despacho (`isDirect`) y reestructurar formularios. Se bloqueó la fecha pre-existente o presente para envíos de desechables.
  - `components/quote/*` — Modulo `QuoteView` adaptado para que el pago de compras directas sea 100% upfront con un contrato de reserva específico para el Delivery de desechables.
  - `app/actions/createQuote.ts`, `app/actions/confirmQuote.ts` — Lógica adaptada para sincronización de correos y eventos de calendario usando un ID nuevo `GOOGLE_CALENDAR_DESECHABLE_ID`.
  - `components/emails/DirectSaleEmail.tsx`, `components/emails/ConfirmationEmail.tsx` — Textos de emails cambiados a "Compra/Pedido Confirmado" con flujo distinto (no se requiere pagar 50% extra sino el total previamente).
- **Resumen**: Se completó la primera iteración de la venta de barriles desechables (5L) bajo una figura de compra directa (sin retorno ni instalación). El flujo enruta las lógicas de precios de `quote`, manda emails específicos adaptados, e impacta el Dashboard con estados en calendarios logísticos correspondientes.

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

### 📅 17-04-2026 — Sincronización y Refinado de Venta Directa
- **Refinado de Emails**: Se desacopló profundamente el flujo de **Compra Directa** en `EmailShared.tsx`, ocultando métricas irrelevantes (tragos x pers., invitados, temática) y eliminando la fila de dispensador/instalación para este flujo.
- **Rendimiento Inteligente**: Se validó que el cálculo de `total_liters` solo sume productos líquidos (unidad 'L'), asegurando que ítems como hielo o decoraciones no inflen las métricas del correo.
- **Infraestructura de Tests**: Se creó la carpeta `/tests` en la raíz y se implementó `test_direct_sale_emails.ts` para disparar pruebas reales de los 4 escenarios de correo (Cliente/Admin, Borrador/Confirmado) vía `Resend`.
- **UI/UX**: Se simplificó la "Fecha Despacho" en correos directos para mostrar solo la fecha y ocultar la hora, alineándose con el modelo de negocio transaccional.

### 📅 18-04-2026 — Desacople de Vistas Públicas (EventQuoteView vs. DirectQuoteView)
- **Archivos creados/modificados**:
  - `components/quote/EventQuoteView.tsx` — Versión especializada para eventos, eliminando lógica de venta directa.
  - `components/quote/DirectQuoteView.tsx` — Nueva vista simplificada para ventas directas (100% pago, sin muro, términos específicos).
  - `app/cotizar/[token]/page.tsx` — Implementado "switcher" de componentes basado en el tipo de dispensador.
  - `app/actions/confirmQuote.ts` — Validación condicional server-side y corrección en la detección de tipo de venta.
  - `lib/types.ts` — Relajado `ConfirmQuoteSchema` para soportar ambos flujos.
  - `app/actions/confirmQuote.ts` — Se corrigió un error de importación (`fetchComunas` no existía), se optimizó la carga de datos y se agregaron fallbacks para propiedades opcionales (`guests`, `startTime`) para evitar errores de tipo en el build.
  - `app/actions/admin/adminActions.ts` — Se corrigió un error de tipo (TypeScript) en el desestructurado de `fetchAllProductData`.
  - `components/wizard/direct/DirectStep1Products.tsx` y `components/wizard/WizardStep3.tsx` — Se resolvieron problemas de tipado agregando los campos faltantes (`sizeValue`, `unitId`, `isDisposable`, `unit`) en el mapeo de `ProductPrice` hacia `ICart`.
  - `lib/services/googleSyncService.ts` — Se reemplazaron las llamadas al atributo inexistente `service_type` por la lógica correcta de negocio evaluando `dispenser === 'desechable'`.
- **Resumen**: Se eliminó el código "spaghetti" que mezclaba eventos y ventas directas en la vista pública de cotizaciones. Ahora cada flujo tiene su propio componente aislado, lo que permite reglas de negocio diferenciadas (como la obligatoriedad de incluir al menos un cóctel en ventas directas) y una experiencia de usuario mucho más limpia y coherente. Se resolvieron errores de compilación críticos tanto en las acciones de cliente como de administración para asegurar el despliegue en Vercel.

### 📅 18-04-2026 — Automatización y Flujo E-commerce (Venta Directa) Parte 2
- **Archivos creados/modificados**:
  - `components/wizard/direct/DirectWizardSuccess.tsx` — Nueva pantalla de éxito dedicada al flujo e-commerce que instruye al usuario a transferir el 100% del pago.
  - `components/wizard/direct/DirectWizardShell.tsx` — Transición rediseñada para usar `DirectWizardSuccess`. Resolución del bug donde la advertencia de validación persistía al cambiar de paso.
  - `components/quote/DirectQuoteView.tsx` — Añadido banner explícito de "Validación de Pago Pendiente" con detalle de cobro para cotizaciones aprobadas con saldo pendiente.
  - `app/actions/createQuote.ts` — Corrección de tipado al invocar `updateContactConfirmedStatus` removiendo un parámetro depreciado.
  - `lib/wizardLogic.ts` — Corrección de la plantilla auto-generada de WhatsApp para titularla adecuadamente como *NUEVO PEDIDO DIRECTO*.
- **Resumen**: Se consolidó definitivamente el flujo E-Commerce transaccional para Barriles Desechables. Los clientes ahora enfrentan directrices explícitas sobre el 100% de pago por adelantado, complementado con flujos inmediatos de validación (Success Screen adaptado y directrices en DirectQuoteView).

### 📅 18-04-2026 — Refactorización Admin UI Cotización Manual (Eventos vs Directa)
- **Archivos creados/modificados**:
  - `app/admin/quotes/new/CreateQuoteManualClient.tsx` — Se agregó un orquestador principal (Switch Botones) que permite dividir explícitamente el registro de datos entre "Reserva de Eventos" y "Pedido Directo", ocultando la carga cognitiva innecesaria (como invitados, tipos de evento, o ventanas horarias de retiro que no aplican). "Desechable" fue removido de la lista de opciones para eventos.
  - `app/actions/createQuote.ts` — Se extrajo el bloque de sincronización de `GoogleSyncService` desde la protección estricta del envío de correos, permitiendo que las ventas directas creadas internamente sean registradas automáticamente en el calendario sin importar que sea una creación del tipo "skipEmail" (donde el admin luego presionaría enviar email). También se corrigieron strict TS type errors de objeto desestructurado `quote_items` para que pase la bandera a Vercel con éxito.
- **Resumen**: Cumplimentaciones del lado administrativo del dashboard. La interfaz manual ahora refleja el modelo dualizado de operaciones (Evento Consultivo vs Transaccional Directo), aislando la toma de datos mediante renders condicionales; y mejorando el flujo centralizado para sincronizar eventos al crear pedidos directos manuales sin disparar emails falsos.

### 📅 18-04-2026 — Refinamiento del Flujo E-Commerce: Post-Confirmación y UX Admin
- **Archivos creados/modificados**:
  - `components/wizard/WizardSuccess.tsx` & `components/wizard/direct/DirectWizardSuccess.tsx` — Añadido fallback botón explícito "Abrir WhatsApp" para bypassear bloqueos de pop-ups de navegadores durante respuestas asíncronas lentas.
  - `components/quote/DirectQuoteView.tsx` — Replicada y agregada la tabla de "Historial de Transacciones" para mostrar visualmente a los clientes el éxito de su confirmación de pago manual efectuada por el admin.
  - `components/emails/ConfirmationEmail.tsx` — Los correos ahora estipulan explícitamente "Validación de pago pendiente" para escenarios de Venta Directa en vez del confuso "Pedido pagado y agendado" para notificaciones al admin. La información de transferencia vuelve a mostrarse en ambos escenarios.
  - `hooks/useWizard.ts` — Resuelto el default-hardcodeo de "50 invitados" bajándolo a `0`, ya que en los flujos de Venta Directa es una métrica invisible/sucia y el flujo de Eventos ya incluye hard stops de validación propios `>= 10` sobre este número.
  - `app/admin/quotes/QuotesListClient.tsx` — Añadida condición para renderizar un distintivo "📦" explícito next al nombre del cliente en vistas Mobile y Desktop en la grilla visual de Cotizaciones Admin si `dispenser === 'desechable'`, mejorando la lectura panorámica de pipelines transaccionales.
- **Resumen**: Fase de "Corrección de Detalles 100% Final". Todos los bugs críticos de interfaz (incluyendo el fantasma de los 50 invitados) y bloqueadores de navegador (WhatsApp links caídos post asincronía) han sido resueltos. La experiencia tanto de correos como panel de pagos luce robusta.

---

*Última actualización: 18-04-2026 (Fin de Sesión)*
