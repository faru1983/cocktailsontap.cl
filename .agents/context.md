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

### 24-04-2026
- **Build Fix**: Se resolvió un error que impedía el deploy en Vercel. El error era causado por el archivo de test `tests/test-confirm-sync.ts` que tenía tipos incompatibles con `QuoteItem`.
- **Limpieza**: El usuario eliminó la carpeta `tests/` que ya no estaba en uso.
- **Configuración**: Se revirtieron los cambios temporales en `tsconfig.json` tras la eliminación de la carpeta de tests.

---
*Última actualización: 24-04-2026*
