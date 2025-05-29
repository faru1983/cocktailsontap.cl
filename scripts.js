document.addEventListener('DOMContentLoaded', function () {
    // Elementos del DOM
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');
    const testimonialItems = document.querySelectorAll('.testimonial');
    const indicators = document.querySelectorAll('.indicator');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');

    // Lista de testimonios
    const testimonials = [
        {
            text: "Contraté el servicio con Mojito, Caipiriña, Sangría. Todos los tragos muy ricos, vinieron con hielo, en cantidades más que suficientes para todos los tragos, menta, y unas rebanadas de naranjas secas maravillosas para decorar y dar un toque al coctel.",
            author: "@ying_xuliu"
        },
        {
            text: "Maravilloso… muy fácil de hacer cada coctel 🍸 y delicioso… Felicitaciones!!!",
            author: "@maritza.o.lopez"
        },
        {
            text: "Excelente!!!! Como anfitriones fuimos sensación, la calidad de los tragos top. Súper recomendable. 👏👏 👏",
            author: "@fanny_ruiz1"
        },
        {
            text: "Muy buena experiencia nos lucimos con nuestros invitados👏👏👏👏",
            author: "@amol56.cl"
        },
        {
            text: "Los mejores cócteles! ❤️❤️ Super novedoso😃",
            author: "@catalogoidealregalo"
        },
        {
            text: "Buenísimo, los mejores cócteles y eleva tu evento con una experiencia única 🥂!",
            author: "@josefalmendras"
        },
        {
            text: "Son los mejores una experiencia increíble para tu evento",
            author: "@estudio_v.o"
        }
    ];

    // Renderizar testimonios e indicadores
    function renderTestimonials() {
        const testimonialsContainer = document.getElementById('testimonials-container');
        const indicatorsContainer = document.getElementById('carousel-indicators');
        testimonialsContainer.innerHTML = '';
        indicatorsContainer.innerHTML = '';

        testimonials.forEach((testimonial, idx) => {
            const testimonialDiv = document.createElement('div');
            testimonialDiv.className = 'testimonial' + (idx === 0 ? ' active' : '');
            testimonialDiv.innerHTML = `
                <p class="testimonial-text">${testimonial.text}</p>
                <p class="testimonial-author">${testimonial.author}</p>
            `;
            testimonialsContainer.appendChild(testimonialDiv);

            const indicator = document.createElement('span');
            indicator.className = 'indicator' + (idx === 0 ? ' active' : '');
            indicator.setAttribute('data-index', idx);
            indicatorsContainer.appendChild(indicator);
        });
    }

    // Variables
    let currentTestimonial = 0;
    let testimonialInterval;

    // Menu mobile
    menuToggle.addEventListener('click', function () {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Cerrar menu al hacer click en un link
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            menuToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Scroll suave y detección de sección activa
    window.addEventListener('scroll', function () {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (pageYOffset >= (sectionTop - 100)) {
                current = section.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${current}`) {
                item.classList.add('active');
            }
        });
    });

    // Carousel con la lista de testimonios
    function showTestimonial(index) {
        const testimonialItems = document.querySelectorAll('.testimonial');
        const indicators = document.querySelectorAll('.indicator');
        testimonialItems.forEach(item => item.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));

        testimonialItems[index].classList.add('active');
        indicators[index].classList.add('active');
        currentTestimonial = index;
    }

    function nextTestimonial() {
        let nextIndex = (currentTestimonial + 1) % testimonials.length;
        showTestimonial(nextIndex);
    }

    function prevTestimonial() {
        let prevIndex = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
        showTestimonial(prevIndex);
    }

    function startTestimonialInterval() {
        testimonialInterval = setInterval(nextTestimonial, 5000);
    }

    function resetTestimonialInterval() {
        clearInterval(testimonialInterval);
        startTestimonialInterval();
    }

    // Inicializar testimonios y eventos
    renderTestimonials();

    // Event listeners para controles del carousel
    document.querySelector('.carousel-next').addEventListener('click', () => {
        nextTestimonial();
        resetTestimonialInterval();
    });
    document.querySelector('.carousel-prev').addEventListener('click', () => {
        prevTestimonial();
        resetTestimonialInterval();
    });

    document.getElementById('carousel-indicators').addEventListener('click', function (e) {
        if (e.target.classList.contains('indicator')) {
            const idx = parseInt(e.target.getAttribute('data-index'));
            showTestimonial(idx);
            resetTestimonialInterval();
        }
    });

    // Auto-avance del carousel
    startTestimonialInterval();

    // Pausar auto-avance al interactuar
    const carouselContainer = document.querySelector('.testimonios-carousel');
    carouselContainer.addEventListener('mouseenter', () => clearInterval(testimonialInterval));
    carouselContainer.addEventListener('mouseleave', startTestimonialInterval);

    // Lista de cócteles y mocktails
    const products = [
        {
            id: '1',
            category: 'Cocktails',
            name: 'Caipiriña',
            image: 'img/barril_caipirina.webp',
            description: 'Cachaza, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 69990 },
                { size: 'Barril 10L', price: 119990 },
                { size: 'Barril 20L', price: 229990 },
                { size: 'Barril 30L', price: 289990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 69990 }
        },
        {
            id: '2',
            category: 'Cocktails',
            name: 'Pisco Sour Clásico',
            image: 'img/barril_pisco_sour.webp',
            description: 'Pisco Transparente, Limón Sutil, Azúcar, Albumina.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 79990 },
                { size: 'Barril 10L', price: 139990 },
                { size: 'Barril 20L', price: 249990 },
                { size: 'Barril 30L', price: 339990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 79990 }
        },
        {
            id: '3',
            category: 'Cocktails',
            name: 'Gin and Tonic',
            image: 'img/barril_gin_and_tonic.webp',
            description: 'Gin, Agua Tónica.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 79990 },
                { size: 'Barril 10L', price: 139990 },
                { size: 'Barril 20L', price: 249990 },
                { size: 'Barril 30L', price: 339990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 79990 }
        },
        {
            id: '4',
            category: 'Cocktails',
            name: 'Sangría',
            image: 'img/barril_sangria.webp',
            description: 'Vino Tinto CS, Triple Sec, Destilado Añejado, Naranja, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 79990 },
                { size: 'Barril 10L', price: 129990 },
                { size: 'Barril 20L', price: 239990 },
                { size: 'Barril 30L', price: 299990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 79990 }
        },
        {
            id: '5',
            category: 'Cocktails',
            name: 'Mojito Tradicional',
            image: 'img/barril_mojito.webp',
            description: 'Ron Blanco, Agua Mineral Gasificada, Limón, Menta, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 79990 },
                { size: 'Barril 10L', price: 129990 },
                { size: 'Barril 20L', price: 239990 },
                { size: 'Barril 30L', price: 299990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 79990 }
        },
        {
            id: '6',
            category: 'Cocktails',
            name: 'Mojito Mango',
            image: 'img/barril_mojito_mango.webp',
            description: 'Ron Blanco, Agua Mineral Gasificada, Mango, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 84990 },
                { size: 'Barril 10L', price: 139990 },
                { size: 'Barril 20L', price: 249990 },
                { size: 'Barril 30L', price: 339990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 84990 }
        },
        {
            id: '7',
            category: 'Cocktails',
            name: 'Mojito Frambuesa',
            image: 'img/barril_mojito_frambuesa.webp',
            description: 'Ron Blanco, Agua Mineral Gasificada, Frambuesa, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 84990 },
                { size: 'Barril 10L', price: 139990 },
                { size: 'Barril 20L', price: 249990 },
                { size: 'Barril 30L', price: 339990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 84990 }
        },
        {
            id: '8',
            category: 'Cocktails',
            name: 'Mojito Maracuyá',
            image: 'img/barril_mojito_maracuya.webp',
            description: 'Ron Blanco, Agua Mineral Gasificada, Maracuyá, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 84990 },
                { size: 'Barril 10L', price: 139990 },
                { size: 'Barril 20L', price: 249990 },
                { size: 'Barril 30L', price: 339990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 84990 }
        },
        {
            id: '9',
            category: 'Cocktails',
            name: 'Ramazzotti Spritz',
            image: 'img/barril_ramazzotti_spritz.webp',
            description: 'Ramazzotti, Espumante Brut, Agua Mineral Gasificada.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 99990 },
                { size: 'Barril 10L', price: 179990 },
                { size: 'Barril 20L', price: 299990 },
                { size: 'Barril 30L', price: 419990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 99990 }
        },
        {
            id: '10',
            category: 'Cocktails',
            name: 'Aperol Spritz',
            image: 'img/barril_aperol_spritz.webp',
            description: 'Aperol, Espumante Brut, Agua Mineral Gasificada.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 99990 },
                { size: 'Barril 10L', price: 179990 },
                { size: 'Barril 20L', price: 299990 },
                { size: 'Barril 30L', price: 419990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 99990 }
        },
        {
            id: '11',
            category: 'Cocktails',
            name: 'Tropical Gin',
            image: 'img/barril_tropical_gin.webp',
            description: 'Gin, Red Bull Tropical.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 99990 },
                { size: 'Barril 10L', price: 179990 },
                { size: 'Barril 20L', price: 299990 },
                { size: 'Barril 30L', price: 419990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 99990 }
        },
        {
            id: '12',
            category: 'Cocktails',
            name: 'Moscow Mule',
            image: 'img/barril_moscow_mule.webp',
            description: 'Vodka, Ginger Beer, Limón.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 109990 },
                { size: 'Barril 10L', price: 199990 },
                { size: 'Barril 20L', price: 339990 },
                { size: 'Barril 30L', price: 499990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 109990 }
        },
        {
            id: '13',
            category: 'Cocktails',
            name: 'Tequila Margarita',
            image: 'img/barril_tequila_margarita.webp',
            description: 'Tequila Blanco, Triple Sec, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 119990 },
                { size: 'Barril 10L', price: 209990 },
                { size: 'Barril 20L', price: 379990 },
                { size: 'Barril 30L', price: 539990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 119990 }
        },
        {
            id: '14',
            category: 'Mocktails',
            name: 'Mojito Tradicional Sin Alcohol',
            image: 'img/barril_mojito_sin_alcohol.webp',
            description: 'Agua Mineral, Limón, Menta, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 69990 },
                { size: 'Barril 10L', price: 119990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 69990 }
        },
        {
            id: '15',
            category: 'Mocktails',
            name: 'Mojito Mango Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Agua Mineral Gasificada, Mango, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 74990 },
                { size: 'Barril 10L', price: 129990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 74990 }
        },
        {
            id: '16',
            category: 'Mocktails',
            name: 'Mojito Frambuesa Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Agua Mineral Gasificada, Frambuesa, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 74990 },
                { size: 'Barril 10L', price: 129990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 74990 }
        },
        {
            id: '17',
            category: 'Mocktails',
            name: 'Mojito Maracuyá Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Agua Mineral Gasificada, Maracuyá, Limón, Azúcar.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 74990 },
                { size: 'Barril 10L', price: 129990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 74990 }
        },
        {
            id: '18',
            category: 'Mocktails',
            name: 'Gin and Tonic Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Gin Sin Alcohol, Agua Tónica.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 69990 },
                { size: 'Barril 10L', price: 119990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 69990 }
        },
        {
            id: '19',
            category: 'Mocktails',
            name: 'Tinto de Verano Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Vino Tinto CS Sin Alcohol, Bebida de limón. Limón.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 69990 },
                { size: 'Barril 10L', price: 119990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 69990 }
        },
        {
            id: '20',
            category: 'Mocktails',
            name: 'Sangría Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Vino Tinto CS Sin Alcohol, Syrup Mix Cítricos, Naranja, Limón, Agua Mineral Gasificada.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 69990 },
                { size: 'Barril 10L', price: 119990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 69990 }
        },
        {
            id: '21',
            category: 'Mocktails',
            name: 'Maracuya Spritz Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Maracuyá, Pomelo, Syrup de Naranja, Espumante Sin Alcohol, Agua Mineral Gasificada.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 89990 },
                { size: 'Barril 10L', price: 159990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 89990 }
        },
        {
            id: '22',
            category: 'Mocktails',
            name: 'Tropical Gin Sin Alcohol',
            image: 'img/producto_sin_imagen.webp',
            description: 'Gin Sin Alcohol, Red Bull Tropical.',
            quantity: 0,
            sizes: [
                { size: 'Barril 5L', price: 89990 },
                { size: 'Barril 10L', price: 159990 }
            ],
            selectedSize: { size: 'Barril 5L', price: 89990 }
        }
    ];

    let cart = [];
    let currentCategory = 'Cocktails';

    // Elementos del DOM para el cotizador
    const productsContainer = document.getElementById('products-container');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartModal = document.getElementById('cart-modal');
    const cartCount = document.getElementById('cart-count');
    const totalAmount = document.getElementById('total-amount');
    const modalTotal = document.getElementById('modal-total');
    const viewCartBtn = document.getElementById('view-cart-btn');
    const closeModal = document.querySelector('.close-modal');
    const sendWhatsappBtn = document.getElementById('send-whatsapp');
    const tabButtons = document.querySelectorAll('.tab-button');

    // Renderizar productos
    function renderProducts(category) {
        productsContainer.innerHTML = '';

        const filteredProducts = products.filter(product => product.category === category);

        filteredProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <select class="product-size" data-id="${product.id}">
                        ${product.sizes.map(size =>
                `<option value="${size.size}" ${size.size === product.selectedSize.size ? 'selected' : ''}>
                                ${size.size} $${size.price.toLocaleString('es-CL')}
                            </option>`
            ).join('')}
                    </select>
                    <p class="product-price">$${product.selectedSize.price.toLocaleString('es-CL')}</p>
                    <div class="product-actions">
                        <div class="quantity-control">
                            <button class="quantity-btn minus" data-id="${product.id}">-</button>
                            <input type="number" class="quantity-input" data-id="${product.id}" value="${product.quantity}" min="0">
                            <button class="quantity-btn plus" data-id="${product.id}">+</button>
                        </div>
                        <button class="add-to-cart" data-id="${product.id}">Agregar</button>
                    </div>
                </div>
            `;
            productsContainer.appendChild(productCard);
        });

        // Event listeners para los productos
        document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
            btn.addEventListener('click', function () {
                const productId = this.getAttribute('data-id');
                const product = products.find(p => p.id === productId);
                if (product.quantity > 0) {
                    product.quantity--;
                    updateProductQuantity(productId, product.quantity);
                }
            });
        });

        document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
            btn.addEventListener('click', function () {
                const productId = this.getAttribute('data-id');
                const product = products.find(p => p.id === productId);
                product.quantity++;
                updateProductQuantity(productId, product.quantity);
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', function () {
                const productId = this.getAttribute('data-id');
                const product = products.find(p => p.id === productId);
                product.quantity = parseInt(this.value) || 0;
                updateProductQuantity(productId, product.quantity);
            });
        });

        document.querySelectorAll('.product-size').forEach(select => {
            select.addEventListener('change', function () {
                const productId = this.getAttribute('data-id');
                const product = products.find(p => p.id === productId);
                const selectedSizeName = this.value;
                const selectedSize = product.sizes.find(s => s.size === selectedSizeName);
                product.selectedSize = selectedSize;

                // Actualizar precio mostrado
                const productCard = this.closest('.product-card');
                productCard.querySelector('.product-price').textContent = `$${selectedSize.price.toLocaleString('es-CL')}`;
            });
        });

        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function () {
                const productId = this.getAttribute('data-id');
                const product = products.find(p => p.id === productId);
                if (product.quantity > 0) {
                    addToCart(product);
                }
            });
        });
    }

    // Actualizar cantidad de producto
    function updateProductQuantity(productId, quantity) {
        const input = document.querySelector(`.quantity-input[data-id="${productId}"]`);
        if (input) {
            input.value = quantity;
        }
    }

    // Agregar al carrito
    function addToCart(product) {
        const existingItem = cart.find(item =>
            item.id === product.id && item.selectedSize.size === product.selectedSize.size
        );

        if (existingItem) {
            existingItem.quantity += product.quantity;
        } else {
            cart.push({
                ...JSON.parse(JSON.stringify(product))
            });
        }

        product.quantity = 0;
        updateProductQuantity(product.id, 0);
        updateCart();
        triggerCartAnimation();
    }

    // Animación del carrito
    function triggerCartAnimation() {
        const cartIcon = document.querySelector('.cart-icon');
        cartIcon.classList.add('animate');

        setTimeout(() => {
            cartIcon.classList.remove('animate');
        }, 500);
    }

    // Actualizar carrito
    function updateCart() {
        // Actualizar contador
        const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = itemCount;

        // Actualizar total
        const total = cart.reduce((sum, item) => sum + (item.selectedSize.price * item.quantity), 0);
        totalAmount.textContent = total.toLocaleString('es-CL');
        modalTotal.textContent = total.toLocaleString('es-CL');

        // Guardar en localStorage
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    // Renderizar items del carrito
    function renderCartItems() {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart">No hay productos en tu cotización</div>';
            modalTotal.textContent = '0';
            return;
        }

        cartItemsContainer.innerHTML = '';
        cart.forEach((item, index) => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-size">${item.selectedSize.size}</div>
                </div>
                <div class="cart-item-price">$${(item.selectedSize.price * item.quantity).toLocaleString('es-CL')}</div>
                <div class="cart-item-actions">
                    <div class="quantity-control">
                        <button class="quantity-btn minus" data-index="${index}">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn plus" data-index="${index}">+</button>
                    </div>
                    <button class="remove-item" data-index="${index}">&times;</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        // Event listeners para los items del carrito
        document.querySelectorAll('.cart-item .quantity-btn.minus').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                if (cart[index].quantity > 1) {
                    cart[index].quantity--;
                } else {
                    cart.splice(index, 1);
                }
                renderCartItems();
                updateCart();
            });
        });

        document.querySelectorAll('.cart-item .quantity-btn.plus').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                cart[index].quantity++;
                renderCartItems();
                updateCart();
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                cart.splice(index, 1);
                renderCartItems();
                updateCart();
            });
        });
    }

    // Enviar por WhatsApp y guardar en Google Sheets
    function sendWhatsApp() {
    if (cart.length === 0) {
        alert('Por favor agrega al menos un producto a tu cotización.');
        return;
    }

    const eventDatetime = document.getElementById('event-datetime').value;
    const guests = document.getElementById('guests').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const name = document.getElementById('name').value;
    const lastname = document.getElementById('lastname').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const comments = document.getElementById('comments').value;

    // Preparar el mensaje para WhatsApp
    let message = `*COTIZACIÓN DE EVENTO*\n\n`;

    if (eventDatetime) {
        const date = new Date(eventDatetime);
        const formattedDate = date.toLocaleDateString('es-CL');
        const formattedTime = date.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        message += `*Fecha y Hora:* ${formattedDate} - ${formattedTime}hrs\n`;
    } else {
        message += `*Fecha y Hora:* Sin especificar\n`;
    }

    message += `*Invitados:* ${guests || 'Sin especificar'}\n`;
    message += `*Dirección:* ${address || 'Sin especificar'}\n`;        
    message += `*Comuna:* ${city || 'Sin especificar'}\n`;
    message += `*Nombre:* ${name || 'Sin especificar'}\n`;
    message += `*Apellidos:* ${lastname || 'Sin especificar'}\n`;
    message += `*Celular:* ${phone || 'Sin especificar'}\n`;
    message += `*E-mail:* ${email || 'Sin especificar'}\n`;
    message += `*Comentarios:* ${comments || 'Ninguno'}\n\n`;

    message += `*PRODUCTOS:*\n`;

    cart.forEach(item => {
        message += `- ${item.quantity}x ${item.name} (${item.selectedSize.size}): $${(item.quantity * item.selectedSize.price).toLocaleString('es-CL')}\n`;
    });

    message += `\n*TOTAL: $${cart.reduce((sum, item) => sum + (item.selectedSize.price * item.quantity), 0).toLocaleString('es-CL')}*`;

    // Primero enviar los datos al Google Sheet
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbzZXZcc_8je5aTZtz9xm1ksQEfCdd4_J9lhBc0VDL87FN_Na0b7TQGdrZ8Kg9eHK9aeCw/exec';
    
    const formData = {
        eventDatetime: eventDatetime,
        guests: guests,
        address: address,
        city: city,
        name: name,
        lastname: lastname,
        phone: phone,
        email: email,
        comments: comments,
        cart: cart
    };

    fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(() => {
        // Después de enviar al sheet, abrir WhatsApp
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/56932334235?text=${encodedMessage}`, '_blank');
    })
    .catch(error => {
        console.error('Error al enviar a Google Sheets:', error);
        // Aún así abrir WhatsApp si falla el envío al sheet
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/56932334235?text=${encodedMessage}`, '_blank');
    });
}

    // Cargar carrito desde localStorage
    function loadCart() {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
            updateCart();
        }
    }

    // Event listeners para pestañas
    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderProducts(currentCategory);
        });
    });

    // Event listeners para el modal
    viewCartBtn.addEventListener('click', function () {
        renderCartItems();
        cartModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    closeModal.addEventListener('click', function () {
        cartModal.style.display = 'none';
        document.body.style.overflow = '';
    });

    window.addEventListener('click', function (event) {
        if (event.target === cartModal) {
            cartModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });

    sendWhatsappBtn.addEventListener('click', sendWhatsApp);

    // Inicializar
    loadCart();
    renderProducts(currentCategory);
});