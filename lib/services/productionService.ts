/** Lógica pura de costeo y producción del Recetario (sin I/O). */

export const INGREDIENT_CATEGORIES = ['Licor', 'Bebida', 'Endulzante', 'Jugo', 'Otros'] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];
export type FormatUnit = 'ml' | 'g';

export interface IngredientLike {
    id: string;
    name: string;
    category: IngredientCategory | string;
    format_qty: number;
    format_unit: FormatUnit | string;
    format_price: number;
    is_active?: boolean;
}

export interface RecipeItemLike {
    ingredient_id: string;
    qty_base: number;
    ingredients?: IngredientLike | null;
}

export interface RecipeLike {
    id: string;
    product_id: string;
    base_liters: number;
    is_active?: boolean;
    recipe_items?: RecipeItemLike[];
    products?: { id: string; name: string } | null;
}

export type QuoteRange = 'week' | 'next7' | 'month';

export interface QuoteItemForProduction {
    product_id: string | null;
    product_name: string;
    quantity: number;
    size_value: number | null;
}

export interface ProductionLine {
    ingredientId: string;
    name: string;
    category: string;
    qty: number;
    unit: string;
    formatQty: number;
    formatUnit: string;
    formatPrice: number;
    packs: number;
    lineCost: number;
}

export interface ScaledRecipeLine {
    ingredientId: string;
    name: string;
    category: string;
    qty: number;
    unit: string;
}

export interface ScaledRecipe {
    productId: string;
    name: string;
    liters: number;
    items: ScaledRecipeLine[];
    byCategory: { category: string; items: ScaledRecipeLine[] }[];
}

export interface ProductionResult {
    litersByProduct: Record<string, { productId: string; name: string; liters: number }>;
    technical: ProductionLine[];
    byCategory: { category: string; items: ProductionLine[] }[];
    scaledRecipes: ScaledRecipe[];
    totalCost: number;
    skipped: string[];
}

function groupLinesByCategory(lines: ScaledRecipeLine[]): { category: string; items: ScaledRecipeLine[] }[] {
    return INGREDIENT_CATEGORIES.map((category) => ({
        category,
        items: lines.filter((l) => l.category === category),
    })).filter((g) => g.items.length > 0);
}

export function costPerUnit(ing: Pick<IngredientLike, 'format_price' | 'format_qty'>): number {
    const qty = Number(ing.format_qty) || 0;
    if (qty <= 0) return 0;
    return Number(ing.format_price) / qty;
}

export function costRecipe(
    items: RecipeItemLike[],
    baseLiters = 5
): { total: number; perLiter: number; perDrink: number } {
    let total = 0;
    for (const item of items) {
        const ing = item.ingredients;
        if (!ing) continue;
        total += Number(item.qty_base) * costPerUnit(ing);
    }
    const liters = baseLiters > 0 ? baseLiters : 5;
    const perLiter = total / liters;
    // 1L = 5 tragos de 200ml → por trago = perLiter / 5
    const perDrink = perLiter / 5;
    return { total, perLiter, perDrink };
}

export function roundQty(n: number, decimals = 2): number {
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
}

/** Fecha YYYY-MM-DD en timezone del proyecto. */
export function dateKeyInTz(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/** Lunes–domingo de la semana actual (ISO, lunes inicio) en timezone. */
export function getWeekRange(timeZone: string, now = new Date()): { from: string; to: string } {
    const todayKey = dateKeyInTz(now, timeZone);
    const [y, m, d] = todayKey.split('-').map(Number);
    // Noon UTC-ish: use Date.UTC and find weekday of "today" in TZ via weekday format
    const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const isoDow = map[weekdayStr] ?? 1;
    const mondayOffset = isoDow - 1;
    const monday = new Date(Date.UTC(y, m - 1, d - mondayOffset));
    const sunday = new Date(Date.UTC(y, m - 1, d - mondayOffset + 6));
    const fmt = (dt: Date) =>
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    return { from: fmt(monday), to: fmt(sunday) };
}

export function getNext7Range(timeZone: string, now = new Date()): { from: string; to: string } {
    const from = dateKeyInTz(now, timeZone);
    const [y, m, d] = from.split('-').map(Number);
    const end = new Date(Date.UTC(y, m - 1, d + 6));
    const to = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
    return { from, to };
}

export function getMonthRange(timeZone: string, now = new Date()): { from: string; to: string } {
    const todayKey = dateKeyInTz(now, timeZone);
    const [y, m] = todayKey.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
}

export function rangeFor(range: QuoteRange, timeZone: string, now = new Date()): { from: string; to: string } {
    if (range === 'next7') return getNext7Range(timeZone, now);
    if (range === 'month') return getMonthRange(timeZone, now);
    return getWeekRange(timeZone, now);
}

/**
 * Agrega litros por product_id desde items de cotización.
 * Solo suma si product_id está en recipeProductIds y size_value > 0.
 */
export function aggregateFromQuotes(
    items: QuoteItemForProduction[],
    recipeProductIds: Set<string>
): { litersByProductId: Record<string, number>; skipped: string[] } {
    const litersByProductId: Record<string, number> = {};
    const skipped: string[] = [];
    const skippedSet = new Set<string>();

    for (const item of items) {
        const sizeVal = Number(item.size_value) || 0;
        const qty = Number(item.quantity) || 0;
        if (!item.product_id || sizeVal <= 0 || qty <= 0) {
            const label = item.product_name || 'Item sin nombre';
            if (!skippedSet.has(label)) {
                skippedSet.add(label);
                skipped.push(label);
            }
            continue;
        }
        if (!recipeProductIds.has(item.product_id)) {
            const label = item.product_name || item.product_id;
            if (!skippedSet.has(label)) {
                skippedSet.add(label);
                skipped.push(label);
            }
            continue;
        }
        litersByProductId[item.product_id] = (litersByProductId[item.product_id] || 0) + sizeVal * qty;
    }

    return { litersByProductId, skipped };
}

export function scaleProduction(
    litersByProductId: Record<string, number>,
    recipes: RecipeLike[]
): ProductionResult {
    const recipeByProduct = new Map(recipes.map((r) => [r.product_id, r]));
    const ingredientTotals = new Map<string, ProductionLine>();
    const litersByProduct: ProductionResult['litersByProduct'] = {};
    const scaledRecipes: ScaledRecipe[] = [];
    const skipped: string[] = [];

    for (const [productId, liters] of Object.entries(litersByProductId)) {
        if (liters <= 0) continue;
        const recipe = recipeByProduct.get(productId);
        if (!recipe || recipe.is_active === false) {
            skipped.push(productId);
            continue;
        }
        const name = recipe.products?.name || productId;
        const roundedLiters = roundQty(liters);
        litersByProduct[productId] = { productId, name, liters: roundedLiters };

        const base = Number(recipe.base_liters) || 5;
        const factor = liters / base;
        const recipeLines: ScaledRecipeLine[] = [];

        for (const item of recipe.recipe_items || []) {
            const ing = item.ingredients;
            if (!ing || ing.is_active === false) continue;
            const qty = Number(item.qty_base) * factor;
            recipeLines.push({
                ingredientId: ing.id,
                name: ing.name,
                category: String(ing.category),
                qty: roundQty(qty),
                unit: String(ing.format_unit),
            });

            const existing = ingredientTotals.get(ing.id);
            if (existing) {
                existing.qty = roundQty(existing.qty + qty, 4);
                existing.packs = existing.formatQty > 0 ? roundQty(existing.qty / existing.formatQty, 4) : 0;
                existing.lineCost = roundQty(existing.packs * existing.formatPrice);
            } else {
                const formatQty = Number(ing.format_qty) || 0;
                const formatPrice = Number(ing.format_price) || 0;
                const packs = formatQty > 0 ? roundQty(qty / formatQty, 4) : 0;
                ingredientTotals.set(ing.id, {
                    ingredientId: ing.id,
                    name: ing.name,
                    category: String(ing.category),
                    qty: roundQty(qty, 4),
                    unit: String(ing.format_unit),
                    formatQty,
                    formatUnit: String(ing.format_unit),
                    formatPrice,
                    packs,
                    lineCost: roundQty(packs * formatPrice),
                });
            }
        }

        recipeLines.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        scaledRecipes.push({
            productId,
            name,
            liters: roundedLiters,
            items: recipeLines,
            byCategory: groupLinesByCategory(recipeLines),
        });
    }

    scaledRecipes.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Recalculate packs/cost after aggregation with consistent rounding
    const technical = Array.from(ingredientTotals.values()).map((line) => {
        const packs = line.formatQty > 0 ? roundQty(line.qty / line.formatQty, 4) : 0;
        return {
            ...line,
            qty: roundQty(line.qty),
            packs,
            lineCost: roundQty(packs * line.formatPrice),
        };
    });

    technical.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const byCategory = INGREDIENT_CATEGORIES
        .map((category) => ({
            category,
            items: technical.filter((t) => t.category === category),
        }))
        .filter((g) => g.items.length > 0);

    const totalCost = roundQty(technical.reduce((sum, t) => sum + t.lineCost, 0));

    return { litersByProduct, technical, byCategory, scaledRecipes, totalCost, skipped };
}

export function buildProductionWhatsAppMessage(result: ProductionResult): string {
    let message = '*Resumen de Producción (Litros)*\n\n';
    const liters = Object.values(result.litersByProduct);
    if (liters.length === 0) {
        message += 'No se ingresó producción.\n';
    } else {
        for (const row of liters.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
            message += `- ${row.name}: ${roundQty(row.liters)} Lts\n`;
        }
    }

    message += '\n----------------------------------\n\n*Lista de Ingredientes Total*\n\n';
    if (result.byCategory.length === 0) {
        message += 'No se generaron ingredientes.\n';
    } else {
        for (const group of result.byCategory) {
            message += `*${group.category}*\n`;
            for (const item of group.items) {
                message += `- ${item.name}: ${roundQty(item.qty)} ${item.unit}\n`;
            }
            message += '\n';
        }
    }

    message += '----------------------------------\n\n*Recetas por cóctel*\n\n';
    if (result.scaledRecipes.length === 0) {
        message += 'No hay recetas.\n';
    } else {
        for (const recipe of result.scaledRecipes) {
            message += `*${recipe.name}* (${roundQty(recipe.liters)} L)\n`;
            for (const item of recipe.items) {
                message += `- ${item.name}: ${roundQty(item.qty)} ${item.unit}\n`;
            }
            message += '\n';
        }
    }

    if (result.totalCost > 0) {
        message += `*Costo estimado:* $${Math.round(result.totalCost).toLocaleString('es-CL')}\n`;
    }

    return message;
}
