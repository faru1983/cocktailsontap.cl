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

## Flujos de Venta
- **Evento**: Draft -> Confirmado (via link unico).
- **Venta Directa (Desechables)**: Confirmado directo (sin draft).

## Ultimos Cambios

### 20-05-2026 (Sesion 1)
- **Google Calendar - Desactivación de Notificaciones**: Se modificó `lib/googleSync.ts` para desactivar el envío de invitaciones y notificaciones por correo electrónico al cliente (removiendo el parámetro `?sendUpdates=all` de la API de Google Calendar). Los logs de consola que hacían referencia a la variable eliminada `isReserva` se actualizaron para evitar errores de referencia.
- **Archivos Modificados**: `lib/googleSync.ts`, `.agents/context.md`.

### 17-05-2026 (Sesion 1)
- **Redirecciones - Vercel**: Se eliminaron las redirecciones `/agendar` y `/contratar` en `vercel.json`.
- **Redirecciones - Reseñas**: Se agregó la redirección `/reseñas` con destino a la búsqueda de opiniones en Google.
- **Archivos Modificados**: `vercel.json`, `.agents/context.md`.

### 14-05-2026 (Sesion 2)
- **Gastos - Iteracion Final**: `/admin/gastos` vuelve a lista mensual completa (sin paginacion al pie), manteniendo KPIs calculados con el total del mes.
- **Gastos - KPIs Ajustados**: Se ordenaron y renombraron KPIs para mostrar `Movimientos`, `Gastos Total Mes`, `Ingresos del mes` y `Utilidad del mes`.
- **Estadisticas - Header y Filtro**: `/admin/estadisticas` adopta cabecera estilo gastos, elimina tabs de rango y usa filtro unico por `Ano + Mes` con flechas y boton `Este mes`, persistido en `?month=YYYY-MM`.
- **Estadisticas V2**: Se agregaron comparativas `vs mes anterior` y `vs mismo mes del ano anterior` (porcentaje + monto base), KPIs ejecutivos, tendencia semanal y alertas del periodo.
- **Archivos Modificados**: `app/admin/gastos/page.tsx`, `app/admin/gastos/GastosClient.tsx`, `app/actions/admin/gastosActions.ts`, `app/admin/estadisticas/page.tsx`, `app/admin/estadisticas/StatsClient.tsx`, `.agents/context.md`.

### 14-05-2026 (Sesion 1)
- **Gastos por Periodo Mensual**: `/admin/gastos` abre por defecto en mes actual (`America/Santiago`) y soporta `?month=YYYY-MM`.
- **Optimizacion Supabase/Vercel**: Se acotaron consultas por mes y se reemplazo `select('*')` por campos especificos.
- **KPIs de Gestion**: Se agregaron tarjetas y desglose mensual por categoria.
- **Server Action Liviana**: `addExpense` deja de retornar la fila completa insertada.

### 13-05-2026 (Sesion 1)
- **Confirmacion**: `confirmQuote` reemplaza por completo `quote_items` al confirmar para evitar duplicados legacy.
- **Esquemas Robustos**: `ConfirmQuoteSchema` y `QuoteItem` toleran `null` en campos historicos.
- **Creacion Manual Admin**: `CreateQuoteManualClient.tsx` alineado con wizard publico y soporte de tematica `Otro`.
- **Pagos Completos**: Reserva de evento solicita `100%` del total, igual que venta directa.

---
*Ultima actualizacion: 20-05-2026 (Sesion 1)*
