# Contexto de Negocio - Cocktails on Tap

## Reglas Criticas de Calendario (Google Calendar)

### 1. Reserva de Evento

- **Con Hora**: El evento debe tener duracion 0 (hora de inicio y fin identicas).
- **Sin Hora**: Se marca como "Todo el dia". La fecha de fin en Google API debe ser el dia siguiente (exclusiva).

### 2. Retiro de Evento

- **Mismo dia que el evento**: Debe quedar siempre como **Todo el dia**.
- **Dia siguiente**:
  - Si el cliente ingresa un rango (ej: "12:00 a 14:00"), se usa ese rango exacto.
  - Si no hay rango, queda como duracion 0 en la hora de inicio.
  - Si no hay hora, queda como "Todo el dia".

### 3. Sincronizacion

- La base de datos es prioridad. Si Google o Resend fallan, el error se guarda en `comments` de la cotizacion para auditoria, sin bloquear al usuario.
- **Cancelar** (listado masivo o detalle) o **borrar permanente**: elimina eventos de Google Calendar (reserva + retiro, o calendario desechables). Limpia `google_event_id` / `google_pickup_event_id` si el borrado OK o 404.

## Flujos de Venta

- **Evento**: Draft -> Confirmado (via link único), **o** confirmación inmediata en wizard/admin (`confirmNow`: mismos datos obligatorios que al confirmar draft → `confirmQuoteCore`).
- **Venta Directa (Desechables)**: Confirmado directo (sin draft). **Calendar desechables** solo al registrar el primer pago en admin (no al crear pedido). Estados: `confirmed` → `in_delivery` (reparto propio o carrier Blue/custom) → `completed`. Email Resend al registrar pago y al marcar en reparto.
- **Integraciones** (`/api/v1`): mismo dominio que la web; auth Bearer `INTEGRATION_API_KEY`.
  - `GET /catalog` — productos/precios/**todas** las comunas activas + regiones + Blue Express (lectura para WhatsApp).
  - `POST /contacts` — primer contacto / engagement phone-first; avanza `lifecycle_stage` + CAPI opcional.
  - `POST /quotes` | `POST /direct-sales` — crear venta (también avanza stage). `POST /quotes` con `confirmNow: true` confirma la reserva igual que wizard/admin (`confirmQuoteCore`). Sin el flag, WhatsApp sigue en draft.
  - Campo opcional `source` (`web` | `admin` | `whatsapp`) → columna `quotes.source`.
- **Admin** = canal real (wizard manual / teléfono): misma creación vía `createQuoteCore` + CAPI.

## Identidad + ciclo de vida CRM

- Tabla `clients` (UUID = persona / CAPI `external_id`). Matching vía `client_identifiers`.
- `lifecycle_stage`: `curious` → `engaged` → `quoted` → `customer` (monotónico). `lost` solo manual en admin.
- `intent`: `event` | `direct` | `unknown`. Historial en `client_stage_events`.
- Bot (`whatsapp-cot`): welcome → `bot_started` (curious); al elegir Eventos/Barriles parchea `intent` (`event`|`direct`) sin subir de stage; Interesado sigue en transiciones de flujo (`intent_selected`).
- **CAPI solo desde `advanceClientStage`** (web / whatsapp / admin): Contact (engaged), InitiateCheckout (quoted), Purchase (customer).

## Ultimos Cambios

### 21-10-2026 — Actualización Regla Muro de Coctelería a 60L y Pedidos Mínimos en Ficha Informativa (Paso 3)

- **Regla de negocio `MURO_MIN_LITERS = 60`**:
  - Actualizado el umbral mínimo del Muro de Coctelería de 40L a **60 Litros** (`MURO_MIN_LITERS = 60` en [`lib/config.ts`](file:///c:/Webs/cocktailsontap.cl/lib/config.ts)).
  - La recomendación automática de dispensador en base a volumen ahora sugiere Muro a partir de 60L (antes 40L).
  - Validaciones de servidor y cliente actualizadas (Zero Trust: confirmación, catálogo, checkout y cálculo de cotización aplican 60L para Muro y 10L para Portátil).
- **Ficha informativa y tarjetas en Paso 3 ([`components/wizard/events/EventStepProposal.tsx`](file:///c:/Webs/cocktailsontap.cl/components/wizard/events/EventStepProposal.tsx))**:
  - **Tarjetas principales**: incorporado badge visible de pedido mínimo en cada formato (`Pedido mín. 10L` en Portátil, `Pedido mín. 60L` en Muro) junto al formato de barriles compatibles.
  - **Ficha informativa modal ("Ver fotos y detalles")**: agregada cuadrícula comparativa destacando explícitamente el **Pedido Mínimo** (`Desde 10L / 50 cócteles` vs `Desde 60L / 300 cócteles`), formatos compatibles y costo de instalación.
  - **Modal de inclusiones**: especificado el mínimo correspondiente para cada dispensador en la sección de autoservicio.
  - Actualizados los textos dinámicos en la landing [`components/landing/EventosAdsLanding.tsx`](file:///c:/Webs/cocktailsontap.cl/components/landing/EventosAdsLanding.tsx), `README.md` y `.agents/rules/rules.md`.

### 21-10-2026 — Fix Sincronización y Búsqueda Google Contacts (Formato Celular E.164 / Display)

- **Investigación compra directa token `18536d87b03efb743f1e91be4beaaf75` (Fernando Herrmann)**:
  - El cliente sí se registró y sincronizó automáticamente a Supabase (`clients.id = d120dd64-46b4-4b54-9670-fa84465e0778`) y a Google Contacts (`people/c8460540917755675828`) en la cuenta de Google oficial (`coctelesenbarril@gmail.com`).
  - **Causa raíz de la no visibilidad en búsquedas**: Google People API realiza indexación estricta por tokens. Al guardarse el teléfono únicamente como string compacto sin espacios (`+56998181790`) y sin `type: 'mobile'`, las búsquedas con espacios como `+56 9 9818 1790` o dígitos parciales `9818 1790` arrojaban 0 resultados (solo coincidía buscando por nombre "Fernando", "Herrmann" o el string compacto sin espacios).
  - Además, en la lista alfabética de Google Contacts figura como **`Cócteles - Fernando Herrmann`** (bajo la letra **C** y no la F ni H).
  - **Mejoras implementadas en [`lib/googleSync.ts`](file:///c:/Webs/cocktailsontap.cl/lib/googleSync.ts)**:
    1. **Guardado dual y tipado de teléfono**: ahora se envía el número formateado con espacios (`formatPhoneDisplay(data.phone)`) con `type: 'mobile'` (permitiendo búsquedas directas con espacios y en dialers móviles) y la versión compacta E.164 con `type: 'other'`.
    2. **Búsqueda robusta**: `searchContacts` consulta tanto el formato compacto como el formateado para deduplicar contra contactos existentes creados manualmente.
    3. **Notas limpias**: evita duplicar la fecha y enlace si `noteLabel` ya viene resuelto desde `site_settings`.
  - El contacto de Fernando Herrmann fue actualizado en tiempo real en Google Contacts con su dirección completa, ambos formatos de teléfono y nota limpia.

### 21-10-2026 — Auditoría Técnica Integral y Ejecución Completa (Fases 1, 2 y 3)

- **Auditoría Técnica Completa**:
  - Diagnóstico exhaustivo documentado en artefacto de auditoría con matriz completa de 28 tablas de Supabase, análisis oficial del aviso de Supabase del 30 de octubre de 2026, mitigación de 23 CVEs y plan de acción de 3 fases ejecutado al 100%.
- **Ejecución Fase 3 (Infraestructura, Aceleración Checkout, Optimización de Imágenes y Limpieza Tailwind v4)**:
  - **Aislamiento de Tablas de Respaldo en Supabase**:
    - Movidas las tablas huérfanas `_backup_clients_20260803` y `_backup_quotes_client_fk_20260803` desde el esquema `public` al esquema privado `archive` (`ALTER TABLE ... SET SCHEMA archive;`). El esquema `public` queda con 0 tablas sin clave primaria, 0 tablas huérfanas y 0 lints de seguridad en los Supabase Advisors.
  - **Seguridad en Cabeceras Vercel (CSP)**:
    - Agregado `https://*.facebook.com` a la directiva `connect-src` del Content Security Policy (CSP) en `vercel.json` junto con las cabeceras HSTS y Permissions-Policy existentes, evitando bloqueos en la entrega de eventos Meta Pixel.
  - **Aceleración de Checkout y Creación de Cotizaciones (`after()`)**:
    - En `lib/services/createQuoteCore.ts`, las tareas secundarias de red (sincronización con Google People/Calendar y despacho de correos por Resend) se desacoplaron envolviéndolas en `after()` de `next/server`. El endpoint responde al usuario en <300ms de forma no bloqueante manteniendo la ejecución segura en Vercel.
  - **Optimización y Límites en Carga de Imágenes de Catálogo**:
    - Configurado `experimental: { serverActions: { bodySizeLimit: '6mb' } }` en `next.config.ts` para admitir fotografías tomadas con smartphones sin rechazo por payload.
    - En `app/actions/admin/productActions.ts` (`uploadImage`), integrada compresión y redimensionamiento con `sharp` hacia WebP (máximo 1200x1200px, 82% calidad), reduciendo archivos a <350KB antes de subirlos a Supabase Storage y respetando holgadamente la cuota de 2MB del bucket `product-images`.
  - **Cumplimiento Estricto de la Regla de Oro #1 (Tailwind CSS v4 Only)**:
    - Eliminadas todas las etiquetas `<style>` y `<style jsx>` en las vistas de administración: `ClientsList`, `ClientDetail`, `QuotesList`, `QuoteDetail` y `CreateQuoteManual`.
    - Definidas las utilidades `@utility admin-input` y `@utility scrollbar-none` en `app/globals.css` bajo la especificación nativa de Tailwind v4. Cero etiquetas `<style>` en todo el repositorio.
  - **Corrección en Selección de Dispensador en Wizard de Eventos**:
    - Corregida la condición de carrera y desincronización de closure entre `EventStepProposal.tsx` y `EventWizardShell.tsx`. Al avanzar desde el Paso 3, `handleNextFromProposal` evaluaba `!state.dispenser` (vacío en el primer renderizado) y sobreescribía la elección manual del usuario con la recomendación algorítmica por defecto. Se implementó el paso directo del parámetro `dispenserOverride` en `onNext(id)` y `handleNextFromProposal`, garantizando que la opción seleccionada por el usuario prevalezca inmediatamente sin requerir volver atrás.
- **Ejecución Fase 2 (Integridad de Datos, Límites de 1.000 Filas, Conversiones CAPI y Validación Zod)**:
  - **Eliminación de Truncamiento en PostgREST (1.000 filas)**:
    - En Estadísticas (`app/admin/estadisticas/page.tsx`), se anidó `quote_items(...)` dentro de la consulta de `quotes` con filtro de fecha, eliminando la consulta global que truncaba items antiguos y reduciendo a 2 llamadas HTTP a Supabase.
    - En Clientes Admin (`app/admin/clients/page.tsx`), `getStageCounts()` ahora utiliza `{ count: 'exact', head: true }` por cada etapa (transferencia de 0 bytes y conteo exacto sin límites).
    - En Catálogo de Clientes (`lib/serverData.ts`), añadido tag `['clients-data']` para permitir invalidación selectiva en caché.
  - **Optimización de Conversiones Meta CAPI**:
    - Enriquecido el payload de CAPI en `sendMetaCapiEvent` y `advanceClientStage` pasando `client_ip_address` y `client_user_agent` desde `headers()` en `createQuote.ts` y `confirmQuote.ts`, maximizando el Event Match Quality (EMQ).
    - Eliminado el doble disparo CAPI (`InitiateCheckout` + `Purchase`) cuando `confirmNow = true` en `createQuoteCore.ts`.
  - **Rendimiento de Envío de Recordatorios**:
    - En `reminderService.ts` (`sendManualBatchReminders`), los envíos de correos válidos ahora se procesan en paralelo con `Promise.all`, evitando esperas secuenciales excesivas.
  - **Validación Zod y Caché en Admin**:
    - Validados los inputs de `addExpense` y `updateExpense` en `gastosActions.ts` mediante `ExpenseInputSchema`.
    - Validados `addQuotePayment` y `saveEventType` en `adminActions.ts` con esquemas Zod estrictos.
    - Añadida invalidación `revalidateTag('product-data', 'max')` en `saveEventType`, `deleteEventType` y `updateSiteSetting` para que los cambios en tarifas y configuración se reflejen inmediatamente.
- **Ejecución Fase 1 (Urgente / Seguridad & Preparación Supabase)**:
  - **Supabase Endurecimiento Grants & Pre-30 Oct**: Creada migración `supabase/migrations/20261021110000_security_and_grants_oct30.sql` aplicada exitosamente en producción que revoca accesos de escritura a `anon`/`authenticated`, restringe tablas privadas a `service_role`, ajusta RLS de catálogo a `is_active = true`, configura `ALTER DEFAULT PRIVILEGES` para `service_role` y crea los 9 índices faltantes en claves foráneas (`clients.merged_into_id`, etc.).
  - **Corrección Rules of Hooks en `Navbar.tsx`**: Movido el retorno condicional de rutas excluidas (`/admin`, `/lp`) posterior al `useEffect`, eliminando el riesgo de fallo de hidratación/renderizado en navegaciones cliente.
  - **Privacidad y UX en `/lp/eventos`**: Limpiado el campo `comments` en `EventosAdsLanding.tsx` para evitar que metadatos internos de campaña se filtren en la vista del cliente o en los correos transaccionales de cotización.
  - **Sanitización HTML y Seguridad en Correos**:
    - Creado helper `escapeHtml()` en `lib/utils.ts`.
    - Sanitizadas variables y plantillas en `lib/services/reminderService.ts` (`renderReminderEmailHtml`) y `app/actions/admin/adminActions.ts` (`sendReviewEmail`).
    - Validado esquema de protocolo (`http://` o `https://`) en `dispatch_tracking_url` en `markDirectSaleInDelivery`.
  - **Actualización de Dependencias**:
    - Actualizado `next` de `16.1.6` a `16.4.2` y `eslint-config-next` a `16.4.2` (mitigando 23 CVEs críticos/altos).
    - Actualizado `sharp` a `^0.35.5`.
    - Verificación exitosa de compilación TypeScript (`npx tsc --noEmit`) y compilación de producción (`npm run build` - 21/21 rutas OK).


### 17-10-2026 — Landing Page Comercial Meta Ads (/lp/eventos), Experimento Dual WhatsApp vs. Email y CAPI InitiateCheckout

- **Nueva Landing Comercial dedicada para Meta Ads (`app/lp/eventos/page.tsx` & `components/landing/EventosAdsLanding.tsx`)**:
  - Diseñada 100% mobile-first para tráfico frío/tibio de anuncios pagados en Instagram y Facebook con estructura de scroll narrativo (educación + acción).
  - **Aislamiento total de navegación**: Menú hamburguesa ([`Navbar.tsx`](file:///c:/Webs/cocktailsontap.cl/components/shared/Navbar.tsx)) y footer corporativo con enlaces internos ([`Footer.tsx`](file:///c:/Webs/cocktailsontap.cl/components/shared/Footer.tsx)) ocultos en `/lp/*` para eliminar fugas de clics pagados.
  - **Secciones de alta conversión**:
    1. Hero comercial con video background y 3 badges de beneficios (`Hielo y vasos a $0`, `Sin límite de horas`, `Cócteles en 5 seg`).
    2. Embed oficial del Reel de Instagram (`DY-WKXHgBXz`) + explicación de los 4 simples pasos.
    3. Tabla comparativa: Barra Tradicional / Por tu cuenta vs. Cocktails on Tap.
    4. Grilla de inclusiones sin costos sorpresa a $0 (Hielo, Vasos/Copas, Garnish, Accesorios de bar, Dispensador y Sin límite de tiempo).
    5. Formatos de barra (Dispensador Portátil vs. Muro) y vitrina de cócteles estrella.
    6. Reseñas reales de clientes en Google Maps (5.0 ★★★★★) con enlace directo a la ficha oficial.
  - **Calculadora interactiva en vivo incrustada en la página**:
    - Selección táctil de invitados (30, 50, 80, 100, 150 o personalizado) e intensidad de tragos (2, 3 o 4+ tragos p/p).
    - Cálculo instantáneo de litros y presupuesto estimado usando `calculateEstimatedProposal`.
    - **Pre-selección inteligente de Top Sellers**: Asigna automáticamente los barriles calculados a variedades populares (Pisco Sour, Aperol Spritz, Mojito, etc.), con botón desplegable para personalizar sabores en vivo si el usuario desea.
  - **Experimento Dual de CTA (WhatsApp vs. Email)**:
    - **Botón A (WhatsApp)**: Crea la cotización borrador en base de datos con su token único, registra el touchpoint con `ctaChannel: 'whatsapp'`, dispara `InitiateCheckout` en Meta CAPI + Pixel, y abre WhatsApp con el mensaje estructurado pre-llenado incluyendo el link `/cotizar/[token]`.
    - **Botón B (Email)**: Crea la cotización en base de datos, registra el touchpoint con `ctaChannel: 'email'`, dispara `InitiateCheckout` en Meta CAPI + Pixel, despacha el correo vía Resend y redirige al checkout `/cotizar/[token]?new=true` para reserva inmediata online.
- **Soporte de Atribución y Esquemas**:
  - `lib/types.ts`: `CreateQuoteSchema` ahora permite que `email` sea opcional en cotizaciones cuando se ingresa celular válido (`phone`), manteniéndolo obligatorio únicamente para reservas inmediatas (`confirmNow`).
  - `lib/services/createQuoteCore.ts` y `app/actions/createQuote.ts`: Aceptan `landingMeta: { landing: string; ctaChannel: 'whatsapp' | 'email' }`, persistiendo siempre la elección en `client_touchpoints.payload` para análisis A/B en base de datos.
  - `lib/fpixel.ts`: `metaServiceLineFromPath` ampliado para reconocer `/lp/eventos` y disparar `ViewContent` con `service: 'eventos'` y `content_category: 'Eventos'`.
  - `vercel.json`: Actualizado Content-Security-Policy (CSP) habilitando `https://www.instagram.com` en `frame-src` y `script-src` para el reproductor embebido.
- **Archivos**: `app/lp/eventos/page.tsx`, `components/landing/EventosAdsLanding.tsx`, `lib/types.ts`, `lib/services/createQuoteCore.ts`, `app/actions/createQuote.ts`, `lib/fpixel.ts`, `components/shared/Navbar.tsx`, `components/shared/Footer.tsx`, `vercel.json`.

### 16-10-2026 — Recetario / Producción: Corrección de cócteles omitidos (`size_value` nulo) y selección granular de cócteles por pedido

- **Causa raíz de cócteles omitidos en Producción ("Sin receta o no líquidos: Caipiriña / Pisco Sour")**:
  - Al editar una cotización desde `/admin/quotes/[id]` y agregar nuevos productos (`handleAddItem` en `QuoteDetailClient.tsx` + `updateQuoteItemsAdmin` en `app/actions/admin/adminActions.ts`), los ítems se guardaban en `quote_items` con `size_value = null`, `unit_id = null` e `is_disposable = false`.
  - Cuando `aggregateFromQuotes` (`lib/services/productionService.ts`) procesaba las cotizaciones confirmadas, evaluaba `Number(item.size_value) || 0` → `0`, omitiendo esos barriles del cálculo de litros y mostrándolos en la alerta de *"Sin receta o no líquidos (omitidos)"* aunque el cóctel sí tuviera receta activa (y aunque otros pedidos del mismo mes sí sumaran ese mismo cóctel).
- **Solución integral**:
  - **Backfill en BD**: Actualizadas las 544 filas históricas de `quote_items` que tenían `size_value IS NULL` cruzándolas contra `product_prices` (`size_value`, `unit_id`, `is_disposable`).
  - **Persistencia completa al editar en Admin**: `handleAddItem` (`QuoteDetailClient.tsx`) y `updateQuoteItemsAdmin` (`app/actions/admin/adminActions.ts`) ahora resuelven y persisten siempre `size_value`, `unit_id` e `is_disposable` desde el catálogo del servidor (con fallback al parseo numérico de `size`).
  - **Resiliencia en `aggregateFromQuotes` (`lib/services/productionService.ts`)**: Añadido `resolveQuoteItemSizeValue(item)` que extrae el volumen desde `item.size` (ej. `"5L"`, `"10L"`, `"5L - Desechable"`) si `size_value` llegara vacío.
- **Selección por cliente o por cóctel individual en Producción (`RecetarioClient.tsx`)**:
  - En `/admin/recetario` → Producción → "Desde pedidos", ahora se puede:
    - Marcar el checkbox del cliente para seleccionar o deseleccionar **todos** los cócteles de su pedido de una vez (igual que antes).
    - Hacer clic sobre los chips individuales de cada cóctel dentro del pedido para incluir o excluir **solo algunos cócteles específicos** de ese cliente (mostrando estado indeterminado e indicador `X de Y seleccionados` cuando la selección es parcial).
    - Usar el botón rápido **"Seleccionar todos / Deseleccionar todos"** para marcar todos los pedidos del rango con 1 clic.
- **Archivos**: `lib/services/productionService.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/actions/admin/recetarioActions.ts`, `app/admin/recetario/RecetarioClient.tsx`.

### 14-10-2026 — Páginas Únicas de Producto (`/barriles/[slug]`), SEO Rich Snippets, Cross-selling y Meta CAPI/Pixel Granular

- **Páginas de Detalle de Producto (PDP) para Barriles 5L (`/barriles/[slug]`)**:
  - Implementada la ruta dinámica Server Component `app/barriles/[slug]/page.tsx` para las 25 variedades de cócteles, combinados y mocktails.
  - Creado `lib/productDetails.ts` con slugs SEO canónicos y catálogo enriquecido de datos comerciales: notas de cata, maridaje, perfil de sabor visual (dulzor, acidez, intensidad, refrescancia 1-5), graduación alcohólica (ABV), temperatura de servicio y cristalería recomendada.
  - Generación de metadatos dinámicos (`generateMetadata`) con OpenGraph optimizado para WhatsApp y redes sociales (fotos de alta resolución, títulos y precios).
  - Schema.org JSON-LD de tipo `Product` con moneda CLP, precio oferta, disponibilidad en stock y marca para rich snippets en Google Search y Google Shopping orgánico.
- **Componente de Ficha de Producto (`components/products/ProductDetailView.tsx`)**:
  - Vista responsiva con galería visual, badges de formato (Party Keg 5L, 25 Cócteles de 200 ml), cálculo comparativo de ahorro frente a barra tradicional (\$1.800/trago vs \$6.500 en bar), e infografía educativa en 3 pasos sobre el funcionamiento del barril con grifo integrado sin devolución de equipos.
  - **Cross-selling interactivo (Perfect Serve)**: Checkboxes opcionales para sumar en 1 clic hielo (cubo/frappe), decoraciones (menta fresca, rodajas de limón o naranja deshidratada) y bombillas ecológicas de la categoría `Otros`.
  - Botones duales de llamada a la acción: "Agregar al Pedido" y "Comprar Ahora" (con redirección directa al checkout con modal auto-abierto vía `?checkout=open`), más botón de consulta rápida por WhatsApp pre-rellenado con el cóctel.
- **Optimización y Navegación en Catálogo (`ProductCard.tsx` & `DirectWizardShell.tsx`)**:
  - Eliminado el selector desplegable redundante de 5L cuando los productos tienen un solo tamaño disponible, dejando la tarjeta más limpia y compacta.
  - **Aislamiento de links por contexto (`allowDetailLink`)**: El enlace hacia la ficha de producto `/barriles/[slug]` queda **exclusivo para `/barriles`** (`DirectStep1Products.tsx`). En el wizard de eventos (`EventWizardCatalog.tsx`), `EventQuoteView.tsx` y `DirectQuoteView.tsx`, `allowDetailLink = false`, manteniendo el catálogo de eventos 100% enfocado en armar la barra sin enlaces que desvíen al usuario fuera del embudo de cotización.
  - **Corrección de Imagen Desechable**: En `ProductDetailView.tsx` y `app/barriles/[slug]/page.tsx`, la selección de imagen y precio ahora prioriza estrictamente `isDisposable === true`, garantizando que se muestre la foto real del barril Party Keg desechable (en lugar del barril Inox de arriendo) tanto en la web como en OpenGraph y Schema.org.
  - El botón "Agregar" y los selectores de cantidad `+` / `-` se mantuvieron 100% operativos en el catálogo para compras rápidas.
  - **Sincronización de Carrito**: Persistencia cruzada de selecciones en `localStorage` (`cot_direct_selections`) para compartir ítems entre la PDP y el catálogo principal, con limpieza automática al completar la compra o reiniciar el wizard.
- **Tracking Granular de Meta Pixel**:
  - Nuevas funciones `trackProductViewContent` y `trackProductAddToCart` en `lib/fpixel.ts`.
  - Disparo de `ViewContent` por producto con `content_ids` (UUID Supabase), valor, moneda y categoría al ingresar a la ficha, habilitando retargeting dinámico (DPA) y campañas de catálogo Advantage+.
  - Disparo de `AddToCart` al pulsar "Agregar" tanto en la tarjeta de catálogo como en la PDP.
- **Persistencia Dinámica en Base de Datos y Panel Admin (`pdp_metadata` JSONB)**:
  - Añadida columna `pdp_metadata JSONB DEFAULT '{}'::jsonb` a la tabla `products` (`supabase/migrations/20261014140000_product_pdp_metadata.sql`).
  - Sembrados metadatos comerciales completos para los 27 productos del catálogo (`scripts/seedPdpMetadata.ts`): subtítulo, descripción técnica, ABV, temperatura de servicio, cristalería, garnish, perfil de sabor (dulzor, acidez, intensidad, frescura 1-5), complementos recomendados específicos y cócteles relacionados.
  - Tipado en `lib/types.ts` (`PdpMetadata`, `PdpMetadataSchema`, `Product.pdp_metadata`) y mapeado con caché en `lib/serverData.ts`.
  - En `/admin/products` (`ProductsClient.tsx`), incorporada sección desplegable "Ficha E-commerce / Barriles 5L (PDP)" para editar en tiempo real subtítulos, descripciones comerciales, notas de cata, sliders de perfil de sabor (1 a 5), selección de complementos recomendados (categoría 'Otros') y selección de cócteles relacionados ("También te podría gustar"). Modal ampliado a `maxWidth="840px"`.
  - En `ProductDetailView.tsx`:
    - Conectado a `product.pdp_metadata` con fallback transparente a `ENRICHED_CATALOG`.
    - **Complementos dinámicos y cantidades múltiples**: Solo se muestran los complementos recomendados configurados para el cóctel (ej. Mojito -> Hielo Frappe, Menta, Limón, Bombillas). Reemplazado el toggle binario por selector interactivo de cantidad `[-] qty [+]` que permite pedir múltiples bolsas de hielo, paquetes de menta o cítricos y sumarlos al carrito compartido.
    - **Recomendaciones dinámicas**: "También te podría gustar" prioriza los cócteles configurados en `pdp_metadata.related_product_ids`.
- **Archivos**: `lib/types.ts`, `lib/serverData.ts`, `app/actions/admin/productActions.ts`, `app/admin/products/ProductsClient.tsx`, `components/admin/Modal.tsx`, `components/products/ProductDetailView.tsx`, `app/barriles/[slug]/page.tsx`, `supabase/migrations/20261014140000_product_pdp_metadata.sql`, `scripts/seedPdpMetadata.ts`.

### 13-10-2026 — Limpieza de Código Muerto, Eliminación de Redundancias y Unificación de Helpers

- **Eliminación de archivos huérfanos y componentes obsoletos**:
  - Eliminados componentes y hooks en desuso procedentes del antiguo wizard de 6 pasos y carritos de compra (`hooks/useCart.ts`, `components/catalog/CartModal.tsx`, `components/wizard/events/EventStepDispenser.tsx`, `components/wizard/events/EventWizardConfig.tsx`, `components/ui/OptionCard.tsx`, `components/ui/SelectField.tsx`, `components/ui/InfoTooltip.tsx`).
  - Eliminados SVGs iniciales de plantilla de Next.js (`public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`) y archivos temporales (`temp_flyer.svg`, `scripts/_mcp_args.json`).
- **Remoción de código muerto**:
  - Eliminada la función sin invocadores `syncClientToGoogle` en `app/actions/admin/adminActions.ts`.
  - Eliminado helper deprecado `formatPhoneNumber` en `lib/utils.ts` (reemplazado por `formatPhoneDisplay` de `lib/phone.ts`).
  - Eliminada la interfaz no utilizada `CartItem` en `lib/types.ts`.
- **Deduplicación y unificación de esquemas de teléfono**:
  - Esquemas Zod `OptionalPhoneSchema` y `RequiredPhoneSchema` centralizados en `lib/phone.ts`, importados y re-exportados consistentemente en `lib/types.ts` y consumidos en `lib/integrationSchemas.ts`.
- **Centralización de estados e insignias de cotización**:
  - Extraído `STATUS_CONFIG` a `components/quote/quoteStatusConfig.ts`, deduplicando los mapeos de estados, colores e iconos Lucide entre `EventQuoteView.tsx` y `DirectQuoteView.tsx`.
- **Unificación de cálculo de pagos**:
  - Reemplazadas reducciones inline de pagos (`payments.reduce`) en `EventQuoteView.tsx`, `DirectQuoteView.tsx` y `lib/services/googleSyncService.ts` por los helpers existentes `sumQuotePayments(quote)` y `getQuoteBalance(quote)`.
- **Eliminación de números mágicos**:
  - Reemplazado `/ 5` por la constante `COCKTAILS_PER_LITER` en `calculateLiveQuoterSuggestion()` (`lib/wizardLogic.ts`).
- **Limpieza de documentación y reglas**:
  - Actualizado el árbol de directorios en `.agents/rules/rules.md` eliminando referencias a archivos borrados (`useCart.ts` y `lib/emails.ts`).
- **Verificación**:
  - Typecheck completo verificado con `npx tsc --noEmit` resultando en 0 errores.

### 13-10-2026 — Endurecimiento Integral de Seguridad (BD, Storage, APIs y Over-fetching)

- **Supabase Storage protegido (`product-images`)**:
  - Restringidas las políticas de `INSERT`, `UPDATE` y `DELETE` en `storage.objects` exclusivamente al rol `service_role`. Ningún cliente público anónimo puede borrar, sobreescribir o inyectar imágenes en el bucket.
  - Limitado el bucket a cuota de **2 MB** por archivo y lista blanca de tipos MIME autorizados (`image/webp`, `image/jpeg`, `image/png`, `image/gif`).
- **PostgreSQL / RLS sellado**:
  - Reasignadas las políticas de `site_settings` y `expense_payment_methods` a `service_role`. Acceso anónimo denegado por defecto vía PostgREST, previniendo fuga de configuraciones internas, plantillas, logs de cron y métodos de pago de gastos.
  - Limpieza de política redundante en `product_prices` (mantenida solo una política limpia de lectura para `public`).
  - Creada migración rastreable en `supabase/migrations/20261013180000_security_hardening.sql`.
- **Prevención de Over-fetching en `/cotizar/[token]`**:
  - La página pública de confirmación (`app/cotizar/[token]/page.tsx`) ahora proyecta explícitamente los campos necesarios para la UI y el wizard de confirmación, excluyendo del payload RSC datos internos como `client_id` (UUID CRM), `google_event_id` y `google_pickup_event_id`.
- **Mitigación de IP Spoofing en Rate Limiting**:
  - `lib/rateLimit.ts` (`getClientIp`): Prioriza cabeceras confiables inmutables de proxy (`x-real-ip` y `x-vercel-ip`) por sobre `x-forwarded-for` para evitar que peticiones maliciosas con IPs arbitrarias en el encabezado reinicien contadores y eludan los límites.
- **Sanitización de búsquedas PostgREST**:
  - Creado `sanitizePostgrestSearch()` en `lib/utils.ts` y aplicado en los listados del admin (`app/admin/quotes/page.tsx` y `app/admin/clients/page.tsx`) para eliminar caracteres de control de PostgREST (`[,().:\"'\\%_]`), previniendo errores 400 y roturas de sintaxis en filtros `.or()`.
- **Status HTTP estándar en API v1**:
  - `lib/integrationAuth.ts`: Devuelve código HTTP `429 Too Many Requests` (antes 401) cuando se excede la tasa de peticiones en `/api/v1/*`.
- **Saneamiento de fallbacks de configuración**:
  - `lib/config.ts`: Eliminados datos bancarios personales en el string de fallback estático del código fuente, reemplazándolos por marcadores genéricos de empresa (los datos reales residen exclusivamente en `.env.local` / Vercel).
- **Parches de dependencias**:
  - Ejecutado `npm audit fix` reduciendo vulnerabilidades transitivas de paquetes de 22 a 8. Verificado typecheck estricto (`tsc --noEmit`) con 0 errores.

### 12-10-2026 — Paridad en Registro de Pagos y Email de Confirmación de Pago para Eventos (`/admin`)

- **Problema resuelto**: En el panel de administración (`/admin/quotes/[id]`), los eventos no contaban con el botón rápido de registro de total como en venta directa (estaba condicionado a `isDirectSale`), y el Server Action `addQuotePayment` solo enviaba el email de confirmación de pago si la cotización era de venta directa, dejando a los clientes de eventos sin correo de comprobante a pesar de que el toast del frontend indicaba "email enviado".
- **Botones rápidos de pago unificados (`QuoteOperationalSummary.tsx` & `QuoteDetailClient.tsx`)**:
  - Habilitado el botón de **"Transferencia total ($Saldo)"** para cualquier cotización (eventos y ventas directas) con saldo pendiente (`balance > 0`).
  - Agregado botón de acceso rápido **"Abonar 50% ($Mitad)"** exclusivo para eventos cuando no existen pagos previos (`payments.length === 0`).
  - En el modal de registro manual de pago, el placeholder del monto sugiere automáticamente el saldo pendiente.
- **Capa de Servicios y Email Dinámico (`paymentEmailService.ts` & `PaymentRegisteredEmail.tsx`)**:
  - Creado `lib/services/paymentEmailService.ts` (`sendPaymentRegisteredEmail`) que unifica el despacho de correo vía Resend tanto para eventos como para venta directa.
  - `PaymentRegisteredEmail.tsx` adapta sus copys inteligentemente:
    - Eventos: saludo *"para tu evento del {fecha}"*, mensaje de 100% *"Tu evento está pagado en su totalidad. ¡Tenemos todo agendado y listo para tu celebración!"*, o saldo de abono *"el saldo pendiente puede abonarse según lo coordinado o a más tardar el día del evento"*, y botón *"Ver detalle de tu reserva →"*.
    - Venta directa: mantiene terminología de *"pedido"*, despacho y encomienda.
    - Asuntos diferenciados para pago total y abono parcial.
  - `app/actions/admin/adminActions.ts` (`addQuotePayment`): ahora despacha el email para todo tipo de cotización con cliente que posea email, y devuelve advertencia precisa (`Sin email de cliente`) cuando no tiene correo para evitar falsos positivos en la UI.
- **Archivos**: `components/emails/PaymentRegisteredEmail.tsx`, `lib/services/paymentEmailService.ts`, `lib/services/directSaleEmailService.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/admin/quotes/[id]/QuoteOperationalSummary.tsx`.

### 12-10-2026 — Validación en Tiempo Real y Guía Visual en Modales de Checkout (`/eventos` y `/barriles`)

- **Problema resuelto**: Anteriormente, si un usuario ingresaba datos incompletos o con formato incorrecto (ej: celular sin los 9 dígitos, email inválido o comuna sin seleccionar), el botón de envío no respondía o los errores se mostraban detrás del modal (`z-50`) en la página principal, dejando al usuario sin retroalimentación clara de qué corregir.
- **Validación inline y guía visual clara**:
  - Bordes destacados en rojo (`border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-red-100`) para cada input con error.
  - Mensajes de ayuda contextuales debajo de cada campo con icono `AlertCircle` indicando exactamente qué falta (ej: *"Ingresa tu celular de 9 dígitos (ej: +56 9 1234 5678)"*, *"Ingresa un email válido"*, *"Selecciona tu comuna"*).
  - Validación inmediata al desenfocar (`onBlur`) para Email y WhatsApp, y al escribir (`onChange`) para limpiar el error una vez corregido.
  - **Auto-scroll y foco automático**: Al presionar enviar con errores, la pantalla hace scroll suave y enfoca automáticamente el primer campo con error.
  - **Banner de error visible en el footer del modal**: Alerta clara dentro del modal destacando que deben revisarse los campos en rojo, mostrando además cualquier error devuelto por el servidor (`saveError`).
  - **Paridad total entre flujos**: Implementado tanto en `EventWizardCheckoutModal` (`/eventos`) como en `DirectWizardCheckoutModal` (`/barriles`), con soporte extendido en `RegionComunaFields`.
- **Archivos**: `components/ui/RegionComunaFields.tsx`, `components/wizard/events/EventWizardCheckoutModal.tsx`, `components/wizard/events/EventWizardShell.tsx`, `components/wizard/direct/DirectWizardCheckoutModal.tsx`, `components/wizard/direct/DirectWizardShell.tsx`.

### 12-10-2026 — Reorganización de Bloques en Modal de Cotización de Eventos (`EventWizardCheckoutModal.tsx`)

- **Estructura lógica de 2 bloques**:
  - **Bloque 1: Datos Personales y Contacto**: Se trasladaron al inicio los campos de Nombre, Apellido, Email, WhatsApp y Región/Comuna, facilitando la captura de datos básica y alineando el orden con `/barriles`.
  - **Bloque 2: Detalles del Evento**: Agrupa Fecha del Evento y Temática junto con el toggle "Confirmar reserva ahora" (y su despliegue de Dirección, Horarios y Retiro) y los comentarios opcionales. Esto unifica la agenda y logística del evento en una sola sección continua.
  - **Validación en orden visual**: La validación en `handleSubmit` ahora verifica primero datos de contacto y luego datos del evento.
- **Archivos**: `components/wizard/events/EventWizardCheckoutModal.tsx`.

### 12-10-2026 — Mejora de Sticky Bottom Bar en Catálogo de Eventos (`EventWizardCatalog.tsx`)

- **Paridad de UX con `/barriles`**:
  - **Aparición condicional**: La barra fija inferior ahora solo se muestra cuando se agrega al menos un barril (`totalItems > 0`), manteniendo el catálogo despejado y limpio al ingresar al Paso 4. Animada con `animate-slide-up`.
  - **Eliminación de redundancias**: Se removió el botón "Atrás" de la barra fija (ya existe en la cabecera del wizard) y el contador `xx Inv / x Tragos`.
  - **Subtotal en tiempo real**: Se incorporó el subtotal monetario con formato de moneda (`text-primary`), visible en desktop al lado de los litros y en mobile alineado a la derecha junto al botón "Cotizar".
  - **Métricas de Litros**: Se conservó el indicador `Sugerido: currentLiters/recommendedLiters` con retroalimentación visual de colores según el cumplimiento de metas y mínimos de dispensador.
- **Archivos**: `components/wizard/events/EventWizardCatalog.tsx`.

### 11-10-2026 — Refactor UX Wizard Eventos: Flujo simplificado a 4 pasos

- **Integración de selección de dispensador en Paso 3 (`EventStepProposal.tsx`)**:
  - Se eliminó el paso independiente de selección de dispensador (anterior Paso 4), fusionándolo directamente dentro del Paso 3 (Propuesta Sugerida).
  - El wizard de eventos `/eventos` ahora cuenta con un flujo directo y fluido de **4 pasos**:
    1. Invitados (`EventStepGuests.tsx`)
    2. Tragos por persona / Intensidad de barra (`EventStepDrinks.tsx`)
    3. Propuesta Sugerida + Selección de Formato de Dispensador (`EventStepProposal.tsx`)
    4. Catálogo de Cócteles compatibles (`EventWizardCatalog.tsx`)
    - Modal: Checkout y datos de contacto / fecha (`EventWizardCheckoutModal.tsx`).
  - **Refinamiento de UX en Paso 3**:
    - **Orden de valor primero**: El bloque de "Insumos y Cristalería Incluidos ($0)" se ubicó justo después del presupuesto y antes de los dispensadores, reforzando la confianza y percepción de valor antes de la decisión de formato.
    - **Avance en 1 solo clic (sin botón continuar al fondo)**: Pinchar sobre la tarjeta del dispensador deseado (Portátil o Muro) selecciona el formato y avanza inmediatamente al catálogo de cócteles tras una micro-animación de feedback (180ms).
    - **Badge inteligente 'Recomendado para tu evento'**: Se eliminó el texto de advertencia/fricción ("Tu sugerencia es de XL, te faltan YL para el Muro...") y se reemplazó por un badge positivo que destaca la opción ideal según el volumen sugerido (<40L: Dispensador Portátil; ≥40L: Muro de Coctelería).
    - Enlace de fotos independiente: "Ver fotos y detalles" abre el modal con `stopPropagation` para no avanzar involuntariamente si el cliente solo quiere mirar.
  - Al avanzar al Paso 4, el catálogo filtra exclusivamente los tamaños compatibles (5L/10L para portátil o 20L/30L para muro).
- **Archivos**: `components/wizard/events/EventStepProposal.tsx`, `components/wizard/events/EventWizardShell.tsx`, `components/wizard/events/EventWizardCatalog.tsx`.

### 11-10-2026 — Nueva regla de negocio: Muro de Coctelería (Mínimo 40L, solo 20L y 30L)

- **Regla de negocio**:
  - **Muro de Coctelería**: solo barriles de **20L y 30L** y pedido mínimo de **40L** (`MURO_MIN_LITERS = 40`, `MURO_COMPATIBLE_SIZES = [20, 30]`).
  - **Dispensador Portátil**: continúa con barriles de **5L y 10L** y pedido mínimo de **10L** (`PORTATIL_MIN_LITERS = 10`, `PORTATIL_COMPATIBLE_SIZES = [5, 10]`).
- **Lógica de cotizador y catálogo (`lib/wizardLogic.ts`, `EventWizardCatalog.tsx`)**:
  - `isEventBarrelCompatibleWithDispenser`: filtra dinámicamente en catálogo según el dispensador elegido (Muro: 20L y 30L; Portátil: 5L y 10L).
  - Medidor de avance y alertas de pedido mínimo en catálogo y checkout evalúan dinámicamente `minRequiredLiters` (40L para Muro, 10L para Portátil).
  - Alertas en `EventStepDispenser.tsx` avisan de litros faltantes al seleccionar el Muro si la propuesta calculada es menor a 40L.
  - Validación server-side en `confirmQuoteCore.ts` y wizard step 5 (`hooks/useWizard.ts`) diferenciada por formato.
- Archivos: `lib/config.ts`, `lib/wizardLogic.ts`, `hooks/useWizard.ts`, `components/wizard/events/EventWizardCatalog.tsx`, `components/wizard/events/EventStepDispenser.tsx`, `lib/services/confirmQuoteCore.ts`, `app/admin/quotes/new/CreateQuoteManualClient.tsx`, `.agents/rules/rules.md`.

### 11-10-2026 — Actualización de texto superior en /barriles

- **Texto informativo en `DirectStep1Products.tsx`**: Se actualizó el texto descriptivo del banner superior de barriles desechables de 5L destacando rendimiento de aprox. 25 cócteles de 200 ml, conservación de hasta 3 semanas refrigerados gracias a su envasado especial, y recomendación de pedido con anticipación.
- Archivo: `components/wizard/direct/DirectStep1Products.tsx`.

### 02-10-2026 (Rama feat/event-wizard-redesign) — Rediseño del Wizard de Eventos (/eventos)

- **Flujo interactivo de 5 pasos**:
  1. Invitados (chips 30, 50, 80, 100, 150, personalizado con auto-avance).
  2. Intensidad de barra (2, 3 o 4+ tragos/persona sin selección por defecto; auto-avance).
  3. Propuesta sugerida con total de tragos, litros recomendados, variedades sugeridas y presupuesto estimado calculado con catálogo en vivo; inclusiones en $0; botón central "Elegir formato de dispensador".
  4. Formato de dispensador (Portátil o Muro de Coctelería con auto-avance sin barra inferior).
  5. Catálogo de cócteles interactivo con medidor de litros sugeridos vs seleccionados y botón de cotización.
- **Modal de checkout ("Resumen de Cotización")**:
  - Incorpora Fecha del Evento y Temática directamente en el formulario (sin tarjeta contenedora redundante).
  - Deduplicación de temática "Otro" (filtrado de duplicados y opción única al final con campo condicional para especificar temática).
- **Navegación en Shell**:
  - "Reiniciar" en esquina superior derecha restablece y lleva a `/eventos`.
  - "Volver al inicio" en paso 1 lleva a `/cotizar`.
- **Ocultamiento en scroll**:
  - Menú sándwich (`Navbar.tsx`) y botón flotante de WhatsApp (`FloatingWhatsapp.tsx`) ahora se ocultan suavemente al hacer scroll hacia abajo y reaparecen al subir o al llegar al tope (aplicado exclusivamente en `/eventos` y `/barriles`). Default de WhatsApp ajustado al borde izquierdo.


- Todas las secciones admin con pestañas persisten en `?tab=` al recargar (mismo patrón que Recetario).
- **Nuevo**: Productos (`categories` / `units` / `gallery`) y Configuración (`events` / `system` / `comunas`).
- **Alineado**: Gastos y Recordatorios usan el mismo helper (`lib/adminTabUrl.ts`): Link + `replaceState` (sin refetch al cambiar de pestaña).
- Ya tenían URL: Recetario, Estadísticas, Clientes (`?stage=`), Cotizaciones (`?status=`).
- Archivos: `lib/adminTabUrl.ts`, `app/admin/products/*`, `app/admin/settings/*`, `app/admin/gastos/*`, `app/admin/reminders/RemindersClient.tsx`, `app/admin/recetario/RecetarioClient.tsx`.

### 08-09-2026 (Sesión 119) — Recetario: pestañas con URL persistente

- Las pestañas de `/admin/recetario` (Producción, Recetas, Insumos) ahora viven en query `?tab=`.
- Recargar o compartir deja en la misma pestaña: `/admin/recetario?tab=recetas`, `?tab=insumos`. Producción es el default (sin query).
- Cambio de pestaña usa `history.replaceState` (sin refetch de insumos/recetas). El servidor lee `searchParams.tab` al cargar.
- Archivos: `app/admin/recetario/page.tsx`, `app/admin/recetario/RecetarioClient.tsx`.

### 08-09-2026 (Sesión 118) — Subida de oferta desechables + quitar banner lanzamiento

- **Precios**: `offer_price` de los 25 barriles 5L desechables (`is_disposable = true`) subió **+$5.000**. Precio lista sin cambios. Ej: Pisco Sour $47.990 → $52.990; Mojito Tradicional $39.990 → $44.990; Margarita $71.990 → $76.990.
- **Frontend `/barriles`**: se eliminó la tarjeta “Oferta de Lanzamiento / 20% de descuento por tiempo limitado”.
- **Gateway `/cotizar`**: se quitó el badge “20% OFF Lanzamiento” (misma campaña); queda “¡Nuevo Formato!”.
- Archivos: `app/barriles/page.tsx`, `components/wizard/CotizarGateway.tsx`. Datos en `product_prices` (producción). Caché catálogo 5 min.

### 08-09-2026 (Sesión 117) — Hardening seguridad post-auditoría

- **Zero Trust**: `createQuote` público solo `{ state, confirmNow? }`; catálogo vía `fetchAllProductData()`. Admin: `createQuoteAdmin` + `validateSession()`. `confirmQuoteCore` recalcula precios desde catálogo; confirm solo desde `status=draft` con UPDATE atómico.
- **Sesión admin**: cookie HMAC firmada (no hash estático del password); `timingSafeEqual`; `requireAdmin()` en RSC; logout con path `/admin`.
- **Rate limit**: `lib/rateLimit.ts` en login, cotizar, confirmar, `/api/v1`.
- **Higiene**: Zod whitelist en `updateQuoteAdmin` / productos / status; upload MIME allowlist; CSP + HSTS en `vercel.json`; escape fórmulas TXT export.
- **Vercel Firewall (manual)**: sugerido POST login 5/min/IP; `/api/v1/*` 60/min/IP.

### 08-09-2026 (Sesión 116) — Google Contacts phone-only desde admin

- Cotización, reserva y venta directa desde admin ya sincronizaban Google Contacts, pero se abortaba si no había email.
- Ahora se sincroniza con email y/o celular: si no hay `google_contact_id`, busca por teléfono/email; si no existe, crea el contacto y guarda el ID.
- El wizard público sigue exigiendo email para cotizar/confirmar; admin puede crear clientes solo con celular.
- Archivo: `lib/services/googleSyncService.ts`.

### 25-09-2026 (Sesión 121) — Fixes Google Calendar (temática 'Otro' + horario Chile) y autofill retiro admin

- **Google Calendar: Temática 'Otro'**: Al cotizar/confirmar con temática "Otro" (o ingresada manualmente), se guardaba `event_type_other` y `event_type_id = null`. En Google Calendar figuraba en `null` / vacío porque solo se leía `quote.event_type_id`. Ahora `variables.event_type` en [googleSyncService.ts](file:///d:/Webs/cocktailsontap.cl/lib/services/googleSyncService.ts) prioriza `quote.event_type_other` cuando `event_type_id` es null o 'Otro', o el nombre de `event_types(name)`. Además, se agregó `event_types(name)` a las consultas de admin para que las plantillas de Calendar muestren el nombre de la temática.
- **Google Calendar: Horarios post cambio de hora Chile**: Los horarios de reserva y retiro se estaban enviando con el offset `-04:00` hardcodeado (`${date}T${time}:00-04:00`), lo que provocaba un desfase de 1 hora al entrar el horario de verano de Chile (`-03:00`). Ahora [googleSyncService.ts](file:///d:/Webs/cocktailsontap.cl/lib/services/googleSyncService.ts) genera `dateTime` local (`${date}T${time}:00`) sin offset hardcodeado, permitiendo a la API de Google Calendar usar el `timeZone: 'America/Santiago'`, respetando automáticamente el horario exacto configurado.
- **Admin: Autollenado de fecha y horario de retiro**: En [CreateQuoteManualClient.tsx](file:///d:/Webs/cocktailsontap.cl/app/admin/quotes/new/CreateQuoteManualClient.tsx), al seleccionar o modificar la fecha del evento, se completan automáticamente la fecha de retiro al día siguiente (`calculateMaxPickupDate`) y el horario de retiro en `12:00 a 14:00`.
- Archivos: `lib/services/googleSyncService.ts`, `lib/types.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/new/CreateQuoteManualClient.tsx`.

### 01-10-2026 (Sesión 122) — Fixes Admin: Horario de Retiro en Cotizaciones, Regiones Nacionales en Admin y Categoría Padre en Gastos

- **Admin Cotizaciones: Edición de Horario de Retiro y "Todo el Día"**:
  - Se corrigió el desborde horizontal (overflow) en PC en el campo de horario de retiro dentro de `QuoteOperationalSummary.tsx` ampliando el grid a `minmax(180px, 1fr)`, asignando `span 2` y `minWidth: 220px` al bloque de horario, e incorporando `min-w-0` a los inputs.
  - Se corrigió la persistencia al editar cuando el retiro es "Todo el día" (mismo día o sin rango horario específico). Se normaliza a `'--:--'` en frontend y en el Server Action `updateQuoteAdmin`, y se actualizó `UpdateQuoteAdminSchema` en `lib/types.ts` para aceptar `pickup_time`, `pickup_date`, `event_date` y `dispenser` con transformaciones limpias a `null` si vienen vacíos.
- **Admin Crear Cotización: Selección de todas las regiones de Chile**:
  - En `RegionComunaFields.tsx`, cuando `variant === 'admin'`, se listan todas las regiones activas del país ordenadas por `display_order`, manteniendo a la Región Metropolitana como selección predeterminada.
  - El wizard público del cliente (`/cotizar`) continúa filtrado estrictamente según la disponibilidad del servicio (`filterRegionsForService`).
- **Admin Gastos: Modificación de categoría principal en subcategorías**:
  - En `app/actions/admin/gastosActions.ts`, se actualizó `updateExpenseSubcategory` para permitir modificar `category_id`, actualizando a la vez los registros históricos en la tabla `expenses` (`WHERE subcategory_id = ...`) para mantener la integridad relacional.
  - En `app/admin/gastos/GastosClient.tsx`, se reemplazó el inline text input por un modal de edición completo que permite renombrar la subcategoría y reasignar su categoría padre mediante un selector.
- Archivos: `lib/types.ts`, `app/actions/admin/adminActions.ts`, `app/admin/quotes/[id]/QuoteDetailClient.tsx`, `app/admin/quotes/[id]/QuoteOperationalSummary.tsx`, `components/ui/RegionComunaFields.tsx`, `app/actions/admin/gastosActions.ts`, `app/admin/gastos/GastosClient.tsx`.

### 01-10-2026 (Sesión 123) — Landing: Rediseño sección cócteles a formato Carta informativa

- **Rama**: `feature/landing-carta-cocteles`.
- **Enfoque informativo**: Se transformó `components/sections/CoctelesSection.tsx` en una "Carta" elegante y minimalista a 2 columnas, eliminando la duplicidad del flujo de compra (carrito, `useCart`, `ProductCatalog`, selector de tamaños y precios) de la landing `/`.
- **Contenido y estilo**: Título "Nuestros Cócteles" para total consistencia con el navbar y enlaces del sitio. Copy enfocado en calidad artesanal, frescura de insumos y preparación sin esperas, con insignias de beneficios (100% Natural, Listos para servir, Calidad Premium).
- **Filtro de categorías**: Se excluye la categoría `Otros` de la carta, ya que corresponde a complementos/insumos de compra desechable (hielos, vasos, etc.) y no a cócteles.
- **Balanceo visual en PC**: Se estructuró la carta en dos columnas simétricas: columna izquierda para 'Cocktails' (13 variedades) y columna derecha para 'Combinados' (6 variedades) + 'Mocktails' (6 variedades), eliminando el espacio en blanco y logrando un balance 50/50 perfecto en PC.
- **Llamados a la Acción (CTA)**: Tarjeta final que invita a celebrar con dos accesos directos hacia `/eventos` y `/barriles`.
- Archivo: `components/sections/CoctelesSection.tsx`.

### 01-10-2026 (Sesión 124) — Atribución Meta Ads CAPI 360° (Click ID fbc y fbp persistente)

- **Captura Server-Side resistente a Safari ITP (`proxy.ts`)**:
  - Se amplió el matcher del proxy para interceptar visitas a páginas públicas.
  - Al recibir `?fbclid=...`, el proxy fija automáticamente la cookie HTTP oficial de primer dominio `_fbc = fb.1.<ts>.<fbclid>` (90 días, `SameSite=Lax`, Secure en prod) y fija `_fbp` si no existe.
- **Captura y Respaldo Client-Side (`lib/attribution.ts` + `MetaPixel.tsx`)**:
  - `initClientMetaAttribution`: captura `fbclid` de la URL, sincroniza cookies `_fbc` / `_fbp` y respalda en `localStorage` (`cot_meta_fbc`, `cot_meta_fbp`, `cot_meta_fbclid`).
  - Se ejecuta en el montaje de `MetaPixel.tsx` y en cada cambio de ruta.
- **Formularios y Server Actions (Eventos y Barriles)**:
  - En `DirectWizardShell.tsx` (barriles) y `EventWizardShell.tsx` (eventos), `createQuote` recibe `fbc` y `fbp`.
  - En `DirectQuoteView.tsx` y `EventQuoteView.tsx`, `confirmQuote` envía `fbc` y `fbp`.
  - En `createQuoteCore.ts` y `confirmQuoteCore.ts`, se leen cookies/parámetros, se registra el touchpoint en la tabla `client_touchpoints` con `meta_fbc` / `meta_fbp` y se pasa a `advanceClientStage`.
  - Herencia automática: confirmaciones días después rescatan el `meta_fbc` histórico de `client_touchpoints` para `Purchase` CAPI.
- **API v1 (`/api/v1/quotes` y `/api/v1/direct-sales`)**:
  - Se ampliaron `IntegrationEventQuoteSchema` e `IntegrationDirectSaleSchema` en `lib/integrationSchemas.ts` para aceptar `fbc`, `fbp` y `ctwaClid`.
  - `lib/integrationApi.ts` y los routes HTTP reenvían estos parámetros a `createQuoteCore`.
- Archivos: `lib/attribution.ts`, `proxy.ts`, `components/shared/MetaPixel.tsx`, `app/actions/createQuote.ts`, `lib/services/createQuoteCore.ts`, `lib/services/confirmQuoteCore.ts`, `lib/types.ts`, `lib/integrationSchemas.ts`, `lib/integrationApi.ts`, `app/api/v1/quotes/route.ts`, `app/api/v1/direct-sales/route.ts`, `components/wizard/direct/DirectWizardShell.tsx`, `components/wizard/events/EventWizardShell.tsx`, `components/quote/DirectQuoteView.tsx`, `components/quote/EventQuoteView.tsx`.

### 02-10-2026 (Sesión 125) — Rediseño sin fricción del Wizard de Eventos (/eventos)

- **Rama**: `feat/event-wizard-redesign`.
- **Objetivo**: Eliminar la sobrecarga cognitiva inicial del primer paso de `/eventos`, postergando fecha y temática para el checkout y ofreciendo un cálculo de propuesta y presupuesto estimado transparente e instantáneo.
- **Flujo de 5 Pasos**:
  1. **Paso 1: Invitados (`EventStepGuests.tsx`)**: Chips táctiles rápidos de un toque (`[30] [50] [80] [100] [150] [Personalizado]`) con avance automático suave o selector numérico.
  2. **Paso 2: Tragos p/p (`EventStepDrinks.tsx`)**: Tarjetas de elección guiada (Barra Complemento 2 tr/p, Recomendado Estándar 3 tr/p con badge dorada, Personalizado 4+ tr/p) con cálculo en vivo de cócteles totales.
  3. **Paso 3: Propuesta Sugerida (`EventStepProposal.tsx`)**: Cálculo automático de cobertura (cócteles totales, litros sugeridos y variedades recomendadas), presupuesto estimado ($ total y por cóctel) usando promedios reales del catálogo (`calculateEstimatedProposal`), y cuadrícula de beneficios/inclusiones a costo $0 con modal descriptivo.
  4. **Paso 4: Dispensador (`EventStepDispenser.tsx`)**: Comparativa visual entre Dispensador Portátil ($0 instalación) y Muro de Coctelería ($50.000 instalación) con imágenes, características, modal ampliado y advertencia amigable si la sugerencia es <30L.
  5. **Paso 5: Catálogo de Cócteles (`EventWizardCatalog.tsx`)**: Selección de cócteles del catálogo con barra de progreso de litros sugeridos.
  6. **Checkout Modal (`EventWizardCheckoutModal.tsx`)**: Los datos del evento removidos del paso 1 (Fecha tentativa y Temática) se integraron en el formulario final junto a Nombre, Apellido, Email, WhatsApp, Región y Comuna.
- **Lógica y Hooks (`lib/wizardLogic.ts`, `hooks/useWizard.ts`)**:
  - `calculateSmartConfig`: ahora retorna `varietiesCount` y `counts` de barriles.
  - `calculateEstimatedProposal`: estima el presupuesto de la propuesta de eventos basándose en el precio de oferta mínimo real por tamaño de la categoría `Cocktails` (evitando promedios inflados con cócteles premium o combinados/mocktails) y entregando el valor exacto de catálogo (Opción A).
  - `useWizard`: se adaptó la guarda de refresco para eventos y se actualizó `validateStep` para soportar las reglas de los 5 pasos y el formulario final.
- **Archivos creados/modificados**:
  - Creados: `components/wizard/events/EventStepGuests.tsx`, `components/wizard/events/EventStepDrinks.tsx`, `components/wizard/events/EventStepProposal.tsx`, `components/wizard/events/EventStepDispenser.tsx`.
  - Modificados: `components/wizard/events/EventWizardShell.tsx`, `components/wizard/events/EventWizardCatalog.tsx`, `components/wizard/events/EventWizardCheckoutModal.tsx`, `lib/wizardLogic.ts`, `hooks/useWizard.ts`.

### 02-10-2026 (Sesión 126) — Optimización del Presupuesto Sugerido y Rendimiento de Barriles (/eventos?step=3)

- **Unificación de Rendimiento en `calculateSmartConfig` (`lib/wizardLogic.ts`)**:
  - Se eliminó la regla histórica dividida y obsoleta de $1\text{L} = 6\text{ cócteles}$ internos vs $1\text{L} = 5\text{ cócteles}$ cliente.
  - Ahora todo el motor de cálculo y visualización utiliza de forma consistente la constante oficial `COCKTAILS_PER_LITER = 5` (vaso de 200ml: 5L = 25, 10L = 50, 20L = 100, 30L = 150 cócteles).
  - Se corrigió también la venta directa (`isDirect`), calculando barriles desechables de 5L a razón de 25 cócteles por barril en vez de 30.
  - Se amplió el espacio de búsqueda de combinaciones y se agregó criterio de desempate por homogeneidad de tamaños (`distinctSizes`), prefiriendo por ejemplo dos barriles simétricos de 20L antes que mezclar 30L + 10L.
  - Resultados:
    - 100 personas x 2 tragos (200 cócteles) $\rightarrow$ **2 Barriles de 20L** (40L = 200 cócteles exactos, 2 variedades).
    - 150 personas x 2 tragos (300 cócteles) $\rightarrow$ **2 Barriles de 30L** (60L = 300 cócteles exactos, 2 variedades).
    - 50 personas x 2 tragos (100 cócteles) $\rightarrow$ **2 Barriles de 10L** (20L = 100 cócteles exactos, 2 variedades).
    - 50 personas x 3 tragos (150 cócteles) $\rightarrow$ **3 Barriles de 10L** (30L = 150 cócteles exactos, 3 variedades).
    - 25 personas x 1 trago (25 cócteles) $\rightarrow$ **1 Barril de 5L** (5L = 25 cócteles exactos, 1 variedad).
- **Ajuste en `calculateEstimatedProposal` (`lib/wizardLogic.ts`)**:
  - Filtra específicamente por la categoría `Cocktails` (`category.toLowerCase() === 'cocktails'`) y toma el **precio de oferta mínimo real** por tamaño de barril (`min(offerPrice)` en formato arriendo `!isDisposable && unit === 'L'`).
  - Opción A: valor real de catálogo sin redondeo a miles.
- **UI (`EventStepProposal.tsx` y `EventStepDrinks.tsx`)**:
  - En `EventStepProposal.tsx`: Se actualizó la leyenda inferior de la tarjeta de presupuesto estimado de *"Basado en promedio del catálogo"* a *"Calculado desde cócteles base"*.
  - En `EventStepDrinks.tsx` (Paso 2): Se reemplazaron los botones fijos `[4, 5, 6, 7]` de la tarjeta "Personalizado" por un drawer desplegable idéntico al del Paso 1, permitiendo al usuario **escribir manualmente la cantidad exacta de cócteles por persona** con cálculo de total de cócteles en vivo y botón de confirmación.

### 11-10-2026 (Sesión 127) — Refactorización Módulo de Cobertura y Métodos de Envío (Admin + Checkout)

- **Separación de Vistas en Cobertura y Despacho (`admin/settings?tab=cobertura`)**:
  - Sub-pestañas: `[ 🚚 Métodos de Envío ]` y `[ 🗺️ Matriz de Comunas y Cobertura ]`.
  - **Métodos de Envío (`ShippingMethodsCards.tsx`)**:
    - **Transporte Propio (Desechables)**: Días de operación (ej: Lun-Vie), días de anticipación (lead time), bloqueo de fechas calendario (blackout dates), ventana de entrega ("todo el día"), umbral de envío gratis opcional por monto o litros, y herramienta de copia masiva de tarifas base ("Copiar tarifa a todas las comunas de una región").
    - **Transporte y Montaje (Eventos)**: Configurable independientemente (Lun-Dom, 5 días de anticipación, bloqueo de fechas por alta demanda, regla de envío gratis por litros o monto, copia masiva de flete base).
    - **Blue Express (Courier Nacional)**: Gestión de tarifas por bulto M/L (misma zona, centro, extremo), días de despacho a courier, anticipación y bloqueo de fechas.
    - **+ Agregar Nuevo Método**: Soporte extensible para nuevos couriers de reparto en Santiago o regiones.
  - **Matriz de Comunas (`CoverageSettings.tsx`)**:
    - Mantiene la tabla geográfica por región y comuna con búsqueda rápida, edición directa de tarifas, carrier preferido (`own` vs `blue_express`), zona Blue Express, y botón para aplicar tarifas masivas por región.
- **Validación de Fechas en Wizard y Checkout**:
  - `lib/shippingMethods.ts`: Funciones `validateShippingDate`, `isDateBlocked`, `isWeekdayAllowed`, `getMinSelectableDate` y `isFreeShippingApplicable`.
  - En venta directa (`DirectWizardCheckoutModal.tsx` y `DirectQuoteView.tsx`): selector de fecha con `min` dinámico y validación de anticipación, días de entrega y fechas bloqueadas.
  - En eventos (`EventWizardCheckoutModal.tsx` y `EventQuoteView.tsx`): selector con `min` dinámico (5 días por defecto o configurado) y validación de días permitidos y fechas bloqueadas.
  - En backend (`createQuoteCore.ts` y `confirmQuoteCore.ts`): validación Zero Trust server-side de fechas y carrier activo antes de persistir la cotización o reserva.
- **Nuevo Selector de Fecha Interactivo (`components/ui/ShippingDatePicker.tsx`)**:
  - Reemplazó los `<input type="date">` nativos del navegador (los cuales no soportan deshabilitar fechas individuales arbitrarias en su menú desplegable nativo).
  - Despliega un calendario flotante con navegación de meses, días de la semana y estados claros:
    - Fechas bloqueadas (`blockedDates`): estilizadas en fondo rojo suave, tachadas, con icono de candado e imposibles de cliquear (`cursor-not-allowed`, `pointer-events-none`).
    - Días fuera de anticipación o días no operativos de la semana: deshabilitados en gris suave.
    - Fechas disponibles: resaltadas con interacción suave.
    - Tipografía refinada: alineada con Outfit, sin negritas agresivas, formato en español natural ("Jueves, 15 de octubre de 2026"), días circulares orgánicos e icono chevron sutil idéntico a los selects de la plataforma.
    - **Posicionamiento inteligente (Auto-flip)**: Detección dinámica de colisiones y espacio disponible (`updatePlacement`). Calcula el espacio inferior y superior tanto respecto a la ventana del navegador (`viewport`) como al contenedor con scroll del modal (`.overflow-y-auto`). Si el espacio inferior es insuficiente (< 340px) y hay más espacio arriba, el calendario se despliega automáticamente hacia arriba (`bottom-full mb-1.5`), evitando que quede cortado u oculto por el borde del modal. Sincronizado reactivamente ante eventos de resize y scroll (capture phase).
  - Integrado en todos los flujos: `EventWizardCheckoutModal.tsx`, `DirectWizardCheckoutModal.tsx`, `EventQuoteView.tsx` y `DirectQuoteView.tsx`.
- **Persistencia**:
  - Guardado en `site_settings` bajo la clave `shipping_methods_config` (`category: 'shipping'`).
  - Cache invalidado con `revalidateCoveragePaths` y re-fetch en catálogo vía `serverData.ts`.
- **Archivos creados/modificados**:
  - Creados: `lib/shippingMethods.ts`, `components/admin/ShippingMethodsCards.tsx`, `components/ui/ShippingDatePicker.tsx`.
  - Modificados: `app/actions/admin/adminActions.ts`, `app/admin/settings/SettingsClient.tsx`, `components/admin/CoverageSettings.tsx`, `components/quote/DirectQuoteView.tsx`, `components/quote/EventQuoteView.tsx`, `components/wizard/direct/DirectWizardCheckoutModal.tsx`, `components/wizard/events/EventWizardCheckoutModal.tsx`, `lib/serverData.ts`, `lib/services/confirmQuoteCore.ts`, `lib/services/createQuoteCore.ts`, `lib/types.ts`, `lib/wizardLogic.ts`.

---

*Ultima actualizacion: 11-10-2026 (Sesión 127)*
