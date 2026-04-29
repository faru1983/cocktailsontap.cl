# Contexto de Negocio - Cocktails on Tap

## Reglas Críticas de Calendario (Google Calendar)

### 1. Reserva de Evento
- **Con Hora**: El evento debe tener duración 0 (Hora de inicio y fin idénticas).
- **Sin Hora**: Se marca como "Todo el día". La fecha de fin en Google API debe ser el día siguiente (exclusiva).

### 2. Retiro de Evento
- **Mismo día que el evento**: Debe quedar siempre como **Todo el día** (independiente de si hay hora o no).
- **Día siguiente**: 
  - Si el cliente ingresa un rango (ej: "12:00 a 14:00"), se usa ese rango exacto.
  - Si no hay rango, queda como duración 0 en la hora de inicio.
  - Si no hay hora, queda como "Todo el día".

### 3. Sincronización
- La base de datos es la prioridad. Si Google o Resend fallan, el error se loguea en el campo `comments` de la cotización para auditoría administrativa, pero no debe bloquear la experiencia del usuario.

## Flujos de Venta
- **Evento**: Draft -> Confirmado (via link único).
- **Venta Directa (Desechables)**: Confirmado directamente (sin draft).


## Últimos Cambios

### 28-04-2026 (Sesión 1)
- **Fix de Validación**: Se resolvió el error "Datos inválidos" en la confirmación de cotizaciones. El problema era que el esquema Zod rechazaba valores `null` en `size_value` y esperaba números estrictos en campos que venían como `numeric` (strings) desde la base de datos.
- **Robustez de Tipos**: Se actualizó `ConfirmQuoteSchema` en `lib/types.ts` para usar `z.coerce.number()` y `.nullable()` en campos críticos de los items de la cotización.

### 27-04-2026 (Sesión 3)
- **Estrategia Meta Pixel**: Integración avanzada de tracking con `lib/fpixel.ts`. Se implementó **Lead Tracking** (al cotizar) y **Purchase Tracking** (al confirmar reserva o venta directa).
- **Advanced Matching**: Los eventos del Píxel ahora envían datos del cliente (email, teléfono, nombre) de forma hasheada para mejorar la atribución de anuncios en Meta.
- **Detalle de Productos**: Se añadió el paso de parámetros `contents` (IDs de productos y cantidades) y `value` (precio total) en cada evento para optimización de ROAS.
- **Estabilidad de Build**: Se corrigió un error crítico de Next.js que fallaba el deploy en Vercel al usar `useSearchParams()` sin un `<Suspense>` boundary en `/barriles`, `/eventos` y `/cotizar`.
- **Nuevos Archivos**: Creación de `lib/fpixel.ts` para centralizar la lógica de tracking.

### 27-04-2026 (Sesión 2)
- **Navegación Pro**: Sincronización de pasos del wizard con la URL (`?step=X`) en `useWizard.ts` para mejor UX, soporte de botón "Atrás" y persistencia de estado.
- **Redirección de Éxito**: Los wizards ahora redirigen automáticamente a la URL canónica de la cotización (`/cotizar/[token]?new=true`) tras el guardado, eliminando pantallas de éxito aisladas.
- **Celebración Integrada**: Se habilitó una "vista de primer acceso" en `EventQuoteView.tsx` y `DirectQuoteView.tsx` que muestra el componente de éxito premium (`WizardSuccess`) directamente sobre la cotización.
- **Limpieza**: Eliminación definitiva de la carpeta `app/api`, consolidando el uso de Server Actions.

### 27-04-2026 (Sesión 1)
- **Sincronización de Calendario**: Se unificó la lógica en `GoogleSyncService.ts` para que las ventas directas se agenden correctamente en el calendario de "Venta Directa" usando el criterio `service_type === 'direct'`.
- **UI de Éxito Premium**: Se rediseñaron las pantallas de éxito de `DirectQuoteView.tsx` y `DirectWizardSuccess.tsx` para lograr paridad visual absoluta con los flujos de eventos (estética light, tarjetas premium y animaciones).
- **Consistencia de Información**: Se actualizó `QuoteSummaryReservation.tsx` para mostrar siempre el tipo de servicio, eliminando vacíos de información en los resúmenes de venta directa.
- **Troubleshooting Producción**: Se identificó un error de configuración en Vercel donde las variables de entorno de Google Calendar no tenían el prefijo `GOOGLE_`, lo que causaba que la producción usara fallbacks incorrectos.
- **Emails**: Se ajustaron las etiquetas de datos bancarios en `ConfirmationEmail.tsx` para mayor claridad.

### 24-04-2026
- **Build Fix**: Se resolvió un error que impedía el deploy en Vercel causado por tipos incompatibles en archivos de test.
- **Limpieza**: Se eliminó la carpeta `tests/` obsoleta.

---
*Última actualización: 28-04-2026 (Sesión 1)*
