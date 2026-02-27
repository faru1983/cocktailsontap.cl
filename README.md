# 🍸 Cocktails on Tap Chile - Barra Móvil Autoservicio

¡Bienvenido al repositorio oficial de **Cocktails on Tap Chile**! Esta es una aplicación web moderna diseñada para ofrecer una experiencia premium en la cotización y gestión de servicios de barra móvil y estaciones de autoservicio de coctelería.

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://cocktailsontap.cl)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-blue?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)

---

## 🚀 Características Principales

- **Cotizador Inteligente (Wizard):** Un proceso paso a paso para que los clientes configuren su evento (invitados, duración, tipos de cócteles).
- **Cálculo en Tiempo Real:** Algoritmos que calculan automáticamente la cantidad de insumos y el presupuesto según los parámetros del evento.
- **Integración con Supabase:** Almacenamiento seguro de cotizaciones y gestión de datos.
- **Diseño Premium & Responsive:** Interfaz moderna optimizada para dispositivos móviles y escritorio, con micro-animaciones y estética de alta gama.
- **Redirecciones Inteligentes:** Manejo dinámico de enlaces para agendamiento, contacto y redes sociales.
- **Compartir por WhatsApp:** Generación automática de mensajes detallados con el resumen de la cotización.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js](https://nextjs.org/) (App Router) + React 19.
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) (Diseño personalizado sin CSS externo).
- **Iconografía:** [Lucide React](https://lucide.dev/) para iconos vectoriales limpios.
- **Backend/Base de Datos:** [Supabase](https://supabase.com/) para persistencia de datos.
- **Despliegue:** [Vercel](https://vercel.com/) con CI/CD automático desde GitHub.

---

## 🛠️ Instalación y Desarrollo Local

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TuUsuario/cocktailsontap.cl.git
   cd cocktailsontap.cl
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Crea un archivo `.env.local` en la raíz y añade tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📦 Despliegue

El proyecto está configurado para desplegarse automáticamente en Vercel al hacer push a la rama `master` o `main`. 

> [!IMPORTANT]
> Asegúrate de configurar las **Environment Variables** en el panel de Vercel antes del primer despliegue.

---

## �️ Estructura de la Base de Datos (Supabase)

Para que el proyecto funcione correctamente, tu instancia de Supabase debe tener las siguientes tablas y estructura:

### 1. Tablas Requeridas

| Tabla | Descripción | Columnas Clave |
| :--- | :--- | :--- |
| `categories` | Categorías de los cócteles | `name`, `display_order` |
| `event_types` | Tipos de eventos para el Wizard | `name`, `icon`, `display_order` |
| `comunas` | Comunas y costos de envío | `name`, `cost`, `free_from`, `display_order` |
| `products` | Información base de productos | `name`, `description`, `image_url`, `category_id` |
| `product_prices`| Precios por tamaño | `product_id`, `size` (5L, 10L, etc), `price`, `offer_price` |

### 2. Relaciones Sugeridas
- `products.category_id` -> `categories.id`
- `product_prices.product_id` -> `products.id`

### 3. Ejemplo de Datos (SQL sugerido)
Puedes usar este ejemplo para poblar las tablas iniciales:

```sql
-- Insertar una categoría
INSERT INTO categories (name, display_order) VALUES ('Clásicos', 1);

-- Insertar un producto
INSERT INTO products (name, description, category_id) 
VALUES ('Mojito Premium', 'Refrescante menta y limón', (SELECT id FROM categories WHERE name = 'Clásicos'));

-- Insertar precios
INSERT INTO product_prices (product_id, size, price, offer_price)
VALUES ((SELECT id FROM products WHERE name = 'Mojito Premium'), '5L', 45000, 39990);
```

---

## �📄 Licencia

Este proyecto es privado para Cocktails on Tap Chile. Todos los derechos reservados.

---

Desarrollado con ❤️ para elevar la experiencia de coctelería en Chile. 🇨🇱

