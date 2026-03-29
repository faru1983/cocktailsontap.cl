# 🛠️ Reglas de Oro (MANDATORIAS)

1.  **Tailwind CSS v4 Only**: Prohibido usar archivos `.css` adicionales o etiquetas `<style>`. Solo Tailwind utilitario.
2.  **Server Actions First**: Toda mutación (POST/PUT/DELETE) se realiza mediante **Next.js Server Actions** en `app/actions/`.
3.  **Capa de Servicios**: La lógica pesada de infraestructura (DB, Google APIs, Resend) reside en `lib/services/`. Los Actions solo orquestan.
4.  **Zero Trust Financials**: Nunca confiar en precios del frontend. Todo total se recalcula en el servidor consultando `product_prices` y `comunas` en Supabase.
5.  **Configuración Centralizada**: Usar siempre las constantes de `lib/config.ts` para URLs, números de contacto y montos base.
6.  **Proxy File Convention**: Prohibido crear archivos `middleware.ts`. En este entorno, Next.js utiliza única y exclusivamente `proxy.ts` para la lógica de middleware/proxy global. La presencia de ambos archivos causará fallos en el despliegue y desarrollo.

---

## 📌 Optimización para Capa Gratuita (Vercel/Supabase)

- **Execution Timeout**: Todas las llamadas externas (Google/Resend) deben ser eficientes. Si una falla, no debe interrumpir el flujo principal (usar `try-catch` locales).
- **Supabase Connections**: Mantener el pool de conexiones bajo. Preferir `select` de campos específicos sobre `select('*')`.
- **Bandwidth**: Minimizar el payload de las peticiones a la DB en el dashboard administrativo.

---

## 📋 Lógica de Negocio Crítica

- **Muro de Coctelería**: Requiere `volumen >= 30L`. Bloquea subproductos de 5L si el muro está activo.
- **Envíos Dinámicos**: Basados en `free_from` por comuna. "Otra" comuna marca envío como "Pendiente de factibilidad".
- **Conversión**: 1 Litro = 5 Cócteles/Tragos.
