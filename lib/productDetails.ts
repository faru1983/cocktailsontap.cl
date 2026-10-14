/**
 * Módulo de información comercial y enriquecida para cócteles y barriles de 5L.
 * Proporciona slugs SEO, notas de cata, maridaje, cómo servir y perfiles de sabor.
 */

export interface FlavorProfile {
    sweetness: number; // 1-5
    acidity: number;   // 1-5
    intensity: number; // 1-5
    freshness: number; // 1-5
}

export interface EnrichedProductInfo {
    slug: string;
    headline: string;
    commercialDesc: string;
    abv: string;
    flavorProfile: FlavorProfile;
    servingTemperature: string;
    glassware: string;
    garnish: string;
    recommendedIce: 'frappe' | 'cubo';
    pairing: string;
    tags: string[];
}

/**
 * Convierte un nombre de producto en un slug limpio y canónico para URLs.
 * Ejemplo: "Mojito Tradicional" -> "mojito-tradicional"
 *          "Piscola Alto del Carmen 35°" -> "piscola-alto-del-carmen-35"
 */
export function slugifyProductName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/°/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Catálogo enriquecido de datos comerciales y notas de cata por slug.
 */
export const ENRICHED_CATALOG: Record<string, EnrichedProductInfo> = {
    'sangria': {
        slug: 'sangria',
        headline: 'La receta española clásica con vino tinto chileno y frutas cítricas maceradas.',
        commercialDesc: 'Nuestra Sangría artesanal combina la robustez y cuerpo de un selecto Cabernet Sauvignon chileno con un jarabe cítrico de naranjas y limones naturales macerados lentamente con especias. Equilibrada, jugosa y sumamente refrescante, es el acompañamiento predilecto para asados, almuerzos campestres y celebraciones familiares.',
        abv: '11.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 3, intensity: 2, freshness: 5 },
        servingTemperature: '4°C a 6°C',
        glassware: 'Copa grande de vino o copa balón',
        garnish: 'Rodajas de naranja y limón natural o deshidratado',
        recommendedIce: 'cubo',
        pairing: 'Asados, tapas de quesos y embutidos, paellas y picoteos al aire libre.',
        tags: ['Vino Tinto', 'Frutas Cítricas', 'Ideal para Asados', 'Favorito Verano']
    },
    'mojito-tradicional': {
        slug: 'mojito-tradicional',
        headline: 'El cóctel cubano por excelencia con menta fresca, ron blanco y limón sutil.',
        commercialDesc: 'Preparado con ron blanco caribeño, abundante menta fresca aromática recién procesada y el toque justo de zumo de limón natural y azúcar de caña. Cada vaso desprende aromas intensos a hierbabuena y cítricos, con burbujas finas que limpian el paladar y entregan una frescura insuperable en cada sorbo.',
        abv: '12.5% Vol.',
        flavorProfile: { sweetness: 3, acidity: 4, intensity: 3, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo (Highball / Collins)',
        garnish: 'Penacho de menta fresca y media rodaja de limón sutil',
        recommendedIce: 'frappe',
        pairing: 'Tacos, mariscos, ceviches, sushi y tardes soleadas en la terraza.',
        tags: ['Top Ventas', '100% Refrescante', 'Ron Blanco', 'Menta Fresca']
    },
    'mojito-maracuya': {
        slug: 'mojito-maracuya',
        headline: 'Una explosión tropical de maracuyá natural con la frescura clásica del mojito.',
        commercialDesc: 'Llevamos el mojito tradicional a una dimensión exótica y vibrante. La intensa acidez aromática de la pulpa de maracuyá real con sus toques dorados se equilibra a la perfección con la menta fresca y el ron blanco. Un cóctel envolvente, de final dulce y ligeramente ácido que cautiva desde el primer sorbo.',
        abv: '12.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 4, intensity: 3, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo (Highball)',
        garnish: 'Penacho de menta y semillas de maracuyá o limón deshidratado',
        recommendedIce: 'frappe',
        pairing: 'Cocina nikkei, comida peruana picante, tablas de quesos suaves y postres cítricos.',
        tags: ['Exótico', 'Tropical', 'Top Ventas', 'Maracuyá Real']
    },
    'mojito-frambuesa': {
        slug: 'mojito-frambuesa',
        headline: 'Color rubí brillante y el encanto silvestre de frambuesas naturales del sur.',
        commercialDesc: 'Elaborado con puré de frambuesas seleccionadas, menta fresca del huerto y ron blanco. Su hermoso tono carmesí lo convierte en uno de los cócteles visualmente más atractivos, combinando dulzura frutal, notas florales silvestres y el final seco y refrescante característico de un gran mojito artesanal.',
        abv: '12.5% Vol.',
        flavorProfile: { sweetness: 3, acidity: 4, intensity: 3, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo o copa balón',
        garnish: 'Frambuesas frescas flotantes y ramita de menta',
        recommendedIce: 'frappe',
        pairing: 'Ensaladas frescas, mariscos salteados, tablas de quesos maduros y chocolates.',
        tags: ['Frutos Rojos', 'Fotogénico', 'Dulce & Cítrico', 'Favorito Mujeres']
    },
    'mojito-mango': {
        slug: 'mojito-mango',
        headline: 'Sabor suave, aterciopelado y aromático con néctar de mango maduro.',
        commercialDesc: 'La sedosidad y dulzura natural del mango maduro se fusionan armónicamente con la acidez cítrica del limón y la frescura de la menta. Es el cóctel ideal para quienes prefieren perfiles de sabor más frutales y amables al paladar, manteniendo una graduación equilibrada para disfrutar toda la jornada.',
        abv: '12.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 3, intensity: 3, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo',
        garnish: 'Lámina de mango deshidratado o penacho de menta',
        recommendedIce: 'frappe',
        pairing: 'Comida asiática, sushi, ceviche mixto y picoteos de queso crema.',
        tags: ['Frutal', 'Suave', 'Mango Natural', 'Veraniego']
    },
    'caipirina': {
        slug: 'caipirina',
        headline: 'El alma de Brasil en tu vaso: Cachaça artesanal, limón de pica y energía tropical.',
        commercialDesc: 'Inspirada en las mejores playas de Río de Janeiro, nuestra Caipiriña utiliza auténtica cachaça de caña de azúcar combinada con abundante zumo de limones de pica macerados con azúcar. Un trago cítrico, con pegada, intenso y alegre que levanta cualquier celebración desde el primer trago.',
        abv: '14.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 5, intensity: 4, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso bajo tipo Old Fashioned / On the Rocks',
        garnish: 'Gajo de lima o rodaja de limón sutil',
        recommendedIce: 'cubo',
        pairing: 'Carnes a la parrilla, feijoada, empanadas y picoteos calientes.',
        tags: ['Cítrico Fuerte', 'Cachaça', 'Fiesta', 'Enérgico']
    },
    'gin-and-tonic': {
        slug: 'gin-and-tonic',
        headline: 'Elegancia botánica británica con toques de enebro y tónica premium efervescente.',
        commercialDesc: 'Una obra de balance y sutileza. Destilado con una cuidada selección de botánicos donde predomina el enebro silvestre, cardamomo y toques de coriandro, combinado con agua tónica de quinina natural. Seco, aromático, burbujeante y extraordinariamente sofisticado.',
        abv: '13.0% Vol.',
        flavorProfile: { sweetness: 2, acidity: 3, intensity: 4, freshness: 5 },
        servingTemperature: '3°C a 5°C',
        glassware: 'Copa balón grande (G&T Glass)',
        garnish: 'Rodaja de pepino fresco o cáscara de limón deshidratada y bayas de enebro',
        recommendedIce: 'cubo',
        pairing: 'Ostras, pescados blancos, charcutería fina y carpaccios.',
        tags: ['Clásico Sofisticado', 'Seco & Herbal', 'Gin Botánico', 'Baja Caloría']
    },
    'pisco-sour-clasico': {
        slug: 'pisco-sour-clasico',
        headline: 'La joya nacional: Pisco chileno doble destilado 35° y limón de pica recién exprimido.',
        commercialDesc: 'Nuestro Pisco Sour es un homenaje a la coctelería chilena de alta gama. Elaborado con pisco doble destilado reposado, zumo de limón de pica natural con la acidez exacta, jarabe de goma artesanal y una infusión de albúmina que genera una corona de espuma blanca y sedosa al servirlo directo del grifo.',
        abv: '14.5% Vol.',
        flavorProfile: { sweetness: 3, acidity: 5, intensity: 4, freshness: 4 },
        servingTemperature: '2°C a 4°C (Casi a punto de nieve)',
        glassware: 'Copa flauta o vaso sour bajo',
        garnish: '3 gotas de amargo de angostura sobre la espuma',
        recommendedIce: 'cubo',
        pairing: 'Empanadas de pino, ceviches, mariscos, machas a la parmesana y asados.',
        tags: ['Insignia Nacional', 'Top 1 Más Vendido', 'Pisco 35°', 'Espuma Perfecta']
    },
    'ramazzotti-spritz': {
        slug: 'ramazzotti-spritz',
        headline: 'El aperitivo rosa de moda: Flores de hibisco, azahar y espumante brut burbujeante.',
        commercialDesc: 'Fresco, floral y de bajo amargor. El licor Ramazzotti Aperitivo Rosato aporta notas aterciopeladas de flor de hibisco y azahar de naranja, armonizado con un espumante brut seco que aporta burbujas chispeantes. Su bajo contenido de azúcar lo hace el favorito indiscutido de cócteles de tarde y juntas con amigas.',
        abv: '11.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 2, intensity: 2, freshness: 5 },
        servingTemperature: '4°C a 6°C',
        glassware: 'Copa balón o copa de vino blanco',
        garnish: 'Rodaja de limón sutil y hojas de albahaca o menta',
        recommendedIce: 'cubo',
        pairing: 'Tablas de quesos brie y camembert, sushi, bruschettas y tardes de sol.',
        tags: ['Aperitivo Rosa', 'Floral & Chic', 'Top Ventas', 'Ligero']
    },
    'aperol-spritz': {
        slug: 'aperol-spritz',
        headline: 'El atardecer veneciano: Naranja amarga, ruibarbo aromático y espumante brut.',
        commercialDesc: 'El aperitivo más famoso del mundo, listo para servir desde tu propio barril. El inconfundible perfil agridulce de Aperol con extractos de hierbas alpinas y ruibarbo, equilibrado con espumante brut y soda gasificada. Su color naranja brillante y burbujas persistentes son sinónimo de fiesta y buen gusto.',
        abv: '11.5% Vol.',
        flavorProfile: { sweetness: 3, acidity: 3, intensity: 3, freshness: 5 },
        servingTemperature: '4°C a 6°C',
        glassware: 'Copa balón de vino',
        garnish: 'Media rodaja de naranja fresca o deshidratada y una aceituna verde',
        recommendedIce: 'cubo',
        pairing: 'Pizzas gourmet, picoteo mediterráneo, jamón serrano y focaccias.',
        tags: ['Clásico Italiano', 'Agridulce', 'Burbujas Finas', 'Aperitivo']
    },
    'moscow-mule': {
        slug: 'moscow-mule',
        headline: 'Picor especiado de jengibre natural, vodka premium y un toque cítrico de lima.',
        commercialDesc: 'Famoso por servirse en sus tradicionales tazas de cobre heladas, nuestro Moscow Mule se prepara con vodka extra filtrado, infusión artesanal de jengibre con notas picantes y toques cítricos de lima fresca. Un trago vivaz, con carácter y extremadamente adictivo para los amantes de las especias.',
        abv: '13.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 4, intensity: 3, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Mug de cobre tradicional o vaso Old Fashioned',
        garnish: 'Rodaja de lima deshidratada y ramita de menta',
        recommendedIce: 'frappe',
        pairing: 'Hamburguesas artesanales, comida mexicana, carnes a la parrilla y piqueos especiados.',
        tags: ['Jengibre Picante', 'Vodka Premium', 'Enérgico', 'Mug de Cobre']
    },
    'tropical-gin': {
        slug: 'tropical-gin',
        headline: 'Fusión exótica de botánicos ingleses con fruta de la pasión y toques cítricos.',
        commercialDesc: 'Una reinterpretación moderna del clásico Gin Tonic. Combina gin destilado de enebro con notas exuberantes de maracuyá y frutas tropicales. El resultado es un cóctel amarillo dorado, fragante, equilibradamente ácido y con un final efervescente que llena de sabor cualquier ocasión especial.',
        abv: '12.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 3, intensity: 3, freshness: 5 },
        servingTemperature: '3°C a 5°C',
        glassware: 'Copa balón',
        garnish: 'Rodaja de limón y una ramita de romero fresco quemado sutilmente',
        recommendedIce: 'cubo',
        pairing: 'Tablas de quesos de cabra, ceviches, tartares y noches de música.',
        tags: ['Tropical', 'Gin Moderno', 'Fruta de la Pasión', 'Innovación']
    },
    'tequila-margarita': {
        slug: 'tequila-margarita',
        headline: 'El clásico mexicano: Tequila 100% de agave, licor de naranja y lima exprimida.',
        commercialDesc: 'Sin concesiones ni atajos. Tequila blanco puro de agave azul, licor seco de naranja (Triple Sec) y auténtico zumo de lima recién prensado con un toque leve de jarabe de agave. Un balance magistral entre la potencia del tequila y la frescura ácida de los cítricos.',
        abv: '14.5% Vol.',
        flavorProfile: { sweetness: 2, acidity: 5, intensity: 4, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Copa Margarita o vaso bajo con borde escarchado en sal',
        garnish: 'Borde escarchado con sal fina y rodaja de lima',
        recommendedIce: 'cubo',
        pairing: 'Tacos de carnitas, nachos con guacamole, quesadillas y mariscos al pil pil.',
        tags: ['Tequila 100% Agave', 'Cítrico & Seco', 'Borde Salado', 'Fuerte']
    },
    'piscola-alto-del-carmen-35': {
        slug: 'piscola-alto-del-carmen-35',
        headline: 'El combinado nacional por excelencia con Alto del Carmen 35° en barrica.',
        commercialDesc: 'La proporción perfecta que todo amante de la piscola busca, envasada a presión constante. Elaborada con Pisco Alto del Carmen 35° —reconocido por sus notas tostadas de madera y moscatel— mezclado con bebida cola de primera calidad en proporción 70/30 ideal para disfrutar sin preocuparse de mezclar.',
        abv: '13.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 1, intensity: 4, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo tipo Piscolero',
        garnish: 'Rodaja de limón natural y abundante hielo',
        recommendedIce: 'cubo',
        pairing: 'Asados, choripanes, empanadas, partidos de fútbol y previas con amigos.',
        tags: ['Insuperable Tradición', 'Pisco Alto 35°', 'Listísima para Servir']
    },
    'piscola-mistral-35': {
        slug: 'piscola-mistral-35',
        headline: 'Sabor acaramelado y redondo: Pisco Mistral 35° añejado en roble americano.',
        commercialDesc: 'El sabor inconfundible de Mistral 35° con sus notas de vainilla, caramelo y tostado suave otorgado por su paso por barricas de roble americano, mezclado con la cantidad justa de bebida cola. Gasificación perfecta, fresca y lista para servir copa tras copa.',
        abv: '13.5% Vol.',
        flavorProfile: { sweetness: 4, acidity: 1, intensity: 4, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso piscolero ancho',
        garnish: 'Hielo en cubos y rodaja de limón sutil',
        recommendedIce: 'cubo',
        pairing: 'Carnes a la parrilla, pizzas, tablas de picoteo y carretes.',
        tags: ['Mistral Añejado', 'Caramelo & Vainilla', 'Clásico Chileno']
    },
    'piscola-3r-transparente-40': {
        slug: 'piscola-3r-transparente-40',
        headline: 'Para piscoleros de verdad: Pisco Tres Erres Transparente 40° floral y potente.',
        commercialDesc: 'Una piscola de pura cepa. El pisco transparente de 40 grados conserva la pureza aromática de las uvas moscateles con notas florales y cítricas intensas. Al mezclarse con la bebida cola, entrega un carácter robusto, seco y vigoroso que los fanáticos del pisco blanco agradecen.',
        abv: '15.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 1, intensity: 5, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso piscolero',
        garnish: 'Rodaja de limón y hielo compacto',
        recommendedIce: 'cubo',
        pairing: 'Asados largos, cortes de carne premium y celebraciones nocturnas.',
        tags: ['40 Grados', 'Pisco Blanco', 'Aroma Moscatel', 'Intenso']
    },
    'piscola-alto-transparente-40': {
        slug: 'piscola-alto-transparente-40',
        headline: 'Destilación limpia y aroma a fruta: Alto del Carmen Transparente 40°.',
        commercialDesc: 'Elaborada con uvas cosechadas a mano en los valles del norte de Chile, destilado exclusivamente en alambiques de cobre y sin crianza en madera para preservar la frescura frutal de la uva. Combinada en proporción justa con bebida cola para un trago potente y de final limpio.',
        abv: '15.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 1, intensity: 5, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso piscolero',
        garnish: 'Limón fresco exprimido y hielo en cubos',
        recommendedIce: 'cubo',
        pairing: 'Parrilladas, hamburguesas, picoteos de queso maduro y aceitunas.',
        tags: ['40 Grados', 'Alto Transparente', 'Fuerza & Aroma']
    },
    'piscola-mistral-nobel-40': {
        slug: 'piscola-mistral-nobel-40',
        headline: 'La categoría premium: Mistral Nobel 40° extra añejado para paladares exigentes.',
        commercialDesc: 'La cumbre de los combinados nacionales. Pisco Mistral Nobel de 40 grados con triple guarda en barricas seleccionadas de roble. Ofrece una complejidad única con notas a chocolate amargo, frutos secos y roble tostado, transformando la clásica piscola en una experiencia gourmet de alto nivel.',
        abv: '15.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 1, intensity: 5, freshness: 4 },
        servingTemperature: '3°C a 5°C',
        glassware: 'Vaso piscolero o vaso de cristal grueso',
        garnish: 'Cáscara de naranja o limón y abundante hielo',
        recommendedIce: 'cubo',
        pairing: 'Cortes finos a la parrilla (entraña, lomo vetado), quesos añejos y chocolates amargos.',
        tags: ['Gourmet', 'Mistral Nobel 40°', 'Roble Tostado', 'Ultra Premium']
    },
    'whiskcola-johnnie-walker-black-label-40': {
        slug: 'whiskcola-johnnie-walker-black-label-40',
        headline: 'El combinado de whisky definitivo: Johnnie Walker Black Label 12 años.',
        commercialDesc: 'El sabor inconfundible del Scotch Whisky más premiado del mundo. Notas de turba ahumada, frutas oscuras y madera dulce de barricas escocesas, equilibradas con la carbonatación refrescante de la bebida cola. Un combinado con distinción, elegancia y un retrogusto ahumado inconfundible.',
        abv: '15.0% Vol.',
        flavorProfile: { sweetness: 3, acidity: 1, intensity: 5, freshness: 4 },
        servingTemperature: '3°C a 5°C',
        glassware: 'Vaso bajo tipo Old Fashioned o vaso largo',
        garnish: 'Media rodaja de naranja fresca',
        recommendedIce: 'cubo',
        pairing: 'Carnes ahumadas, costillitas BBQ, tablas de quesos fuertes y frutos secos.',
        tags: ['Scotch Whisky 12 Años', 'Black Label', 'Ahumado & Elegante', 'Whisky Premium']
    },
    'mojito-tradicional-sin-alcohol': {
        slug: 'mojito-tradicional-sin-alcohol',
        headline: '0.0% Alcohol, 100% Sabor: Menta fresca del huerto, limón natural y soda burbujeante.',
        commercialDesc: 'Diseñado para quienes buscan disfrutar sin alcohol sin sacrificar sabor ni experiencia. Menta seleccionada, zumo de limones de pica y un jarabe ligero de caña con agua mineral con gas. Fresco, digestivo, hidratante y apto para conductores, embarazadas y toda la familia.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 3, acidity: 4, intensity: 2, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo',
        garnish: 'Penacho de menta fresca y rodaja de limón sutil',
        recommendedIce: 'frappe',
        pairing: 'Almuerzos ligeros, ensaladas frescas, sushi y celebraciones de día.',
        tags: ['0.0% Alcohol', 'Apto Embarazadas', 'Conductor Designado', 'Menta Natural']
    },
    'mojito-maracuya-sin-alcohol': {
        slug: 'mojito-maracuya-sin-alcohol',
        headline: '0.0% Alcohol: La fruta de la pasión con menta aromática y limón sutil.',
        commercialDesc: 'Toda la magia tropical de la maracuyá real en un cóctel libre de alcohol. La pulpa aromática aporta una acidez vivaz que se equilibra armónicamente con las notas herbales de la menta. Es dulce, chispeante y sumamente refrescante para cualquier momento del día.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 4, acidity: 4, intensity: 2, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo',
        garnish: 'Penacho de menta y limón deshidratado',
        recommendedIce: 'frappe',
        pairing: 'Comida asiática, ceviches vegetarianos, tablas de frutas y picoteos salados.',
        tags: ['0.0% Alcohol', 'Maracuyá Real', 'Exótico', 'Refrescante']
    },
    'mojito-frambuesa-sin-alcohol': {
        slug: 'mojito-frambuesa-sin-alcohol',
        headline: '0.0% Alcohol: Frambuesas frescas del sur con limón y menta enérgica.',
        commercialDesc: 'Un mocktail cautivante por su intenso color rubí y su sabor a frutos rojos frescos. Frambuesas naturales trituradas con limón y menta, ligeramente endulzadas y complementadas con soda gasificada. Perfecto para celebraciones de día, cumpleaños o baby showers.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 3, acidity: 4, intensity: 2, freshness: 5 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Copa balón o vaso largo',
        garnish: 'Frambuesas frescas y ramita de menta',
        recommendedIce: 'frappe',
        pairing: 'Brunchs, tablas de quesos suaves, postres y tardes de calor.',
        tags: ['0.0% Alcohol', 'Frambuesas', 'Color Rubí', 'Familiar']
    },
    'mojito-mango-sin-alcohol': {
        slug: 'mojito-mango-sin-alcohol',
        headline: '0.0% Alcohol: Néctar suave de mango maduro con toque cítrico y menta fresca.',
        commercialDesc: 'La combinación ideal de dulzura tropical y frescura herbal. El mango maduro aporta un cuerpo aterciopelado delicioso, mientras que el limón y la menta mantienen la frescura en su punto exacto. Una opción deliciosa tanto para niños como para adultos.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 4, acidity: 3, intensity: 2, freshness: 4 },
        servingTemperature: '2°C a 4°C',
        glassware: 'Vaso largo',
        garnish: 'Penacho de menta o lámina de mango',
        recommendedIce: 'frappe',
        pairing: 'Comida nikkei, sushi, tostadas con palta y postres de limón.',
        tags: ['0.0% Alcohol', 'Mango Dulce', 'Suave', 'Para Todos']
    },
    'sangria-sin-alcohol': {
        slug: 'sangria-sin-alcohol',
        headline: '0.0% Alcohol: Vino tinto desalcoholizado con infusión de naranjas y limones.',
        commercialDesc: 'Disfruta la tradición de la sangría sin una sola gota de alcohol. Elaborada con vino tinto desalcoholizado de calidad que conserva los taninos y color profundo de la uva, infusionado con cáscaras y zumos cítricos de naranja y limón. Deliciosa, aromática y para compartir con todos.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 4, acidity: 3, intensity: 2, freshness: 5 },
        servingTemperature: '4°C a 6°C',
        glassware: 'Copa grande de vino',
        garnish: 'Rodajas de naranja y limón con un palito de canela opcional',
        recommendedIce: 'cubo',
        pairing: 'Asados, paellas, tablas de quesos y reuniones familiares.',
        tags: ['0.0% Alcohol', 'Vino Desalcoholizado', 'Tradicional', 'Familiar']
    },
    'ramazzotti-spritz-sin-alcohol': {
        slug: 'ramazzotti-spritz-sin-alcohol',
        headline: '0.0% Alcohol: Zerozotti con flores de hibisco, azahar y espumante desalcoholizado.',
        commercialDesc: 'El cóctel rosa favorito, ahora en versión 100% libre de alcohol. Utiliza Zerozotti 0.0 con extractos de flor de hibisco y azahar de naranja, combinado con espumante brut desalcoholizado y agua mineral con gas. Mantiene toda la elegancia, color rubí claro y burbujas chispeantes del original.',
        abv: '0.0% Vol. (Sin Alcohol)',
        flavorProfile: { sweetness: 3, acidity: 2, intensity: 2, freshness: 5 },
        servingTemperature: '4°C a 6°C',
        glassware: 'Copa balón grande',
        garnish: 'Rodaja de limón sutil y hojas de albahaca fresca',
        recommendedIce: 'cubo',
        pairing: 'Brunch, tablas de quesos suaves, sushi y tardes de terraza.',
        tags: ['0.0% Alcohol', 'Zerozotti', 'Floral & Rosa', 'Chic']
    }
};

/**
 * Obtiene la información enriquecida para un producto. Si no está en el mapa estático,
 * genera un perfil amigable basado en su categoría y nombre.
 */
export function getProductEnrichedInfo(name: string, category: string): EnrichedProductInfo {
    const slug = slugifyProductName(name);
    if (ENRICHED_CATALOG[slug]) {
        return ENRICHED_CATALOG[slug];
    }

    const isNonAlcohol = category.toLowerCase() === 'mocktails' || name.toLowerCase().includes('sin alcohol');
    const isPiscolaOrCombinado = category.toLowerCase() === 'combinados' || name.toLowerCase().includes('piscola') || name.toLowerCase().includes('whiskcola');

    return {
        slug,
        headline: `${name} en barril Party Keg de 5 Litros listo para servir.`,
        commercialDesc: `Disfruta de ${name} con la mejor calidad artesanal de Cocktails on Tap. Preparado con insumos seleccionados y envasado en atmósfera controlada para garantizar la máxima frescura y sabor en cada copa, directo desde su grifo dispensador integrado.`,
        abv: isNonAlcohol ? '0.0% Vol.' : isPiscolaOrCombinado ? '14.0% Vol.' : '13.0% Vol.',
        flavorProfile: {
            sweetness: 3,
            acidity: 3,
            intensity: isNonAlcohol ? 2 : 4,
            freshness: 5
        },
        servingTemperature: '3°C a 5°C',
        glassware: isPiscolaOrCombinado ? 'Vaso largo piscolero' : 'Copa balón o vaso highball',
        garnish: 'Decoración cítrica o menta fresca y abundante hielo',
        recommendedIce: 'cubo',
        pairing: 'Ideal para celebraciones, cumpleaños, asados y reuniones con amigos.',
        tags: [category, 'Barril 5L', 'Listo para Servir', 'Cocktails on Tap']
    };
}
