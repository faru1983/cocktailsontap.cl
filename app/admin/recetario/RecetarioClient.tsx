'use client';

import { useEffect, useMemo, useState, useTransition, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/admin/Modal';
import { formatCurrency } from '@/lib/utils';
import {
    saveIngredient,
    toggleIngredientStatus,
    deleteIngredient,
    updateIngredientPrice,
    saveRecipe,
    toggleRecipeStatus,
    deleteRecipe,
    getConfirmedQuotesForProduction,
    type ProductionQuoteRow,
} from '@/app/actions/admin/recetarioActions';
import {
    INGREDIENT_CATEGORIES,
    costPerUnit,
    costRecipe,
    scaleProduction,
    aggregateFromQuotes,
    buildProductionWhatsAppMessage,
    roundQty,
    type ProductionResult,
    type QuoteRange,
    type IngredientCategory,
} from '@/lib/services/productionService';
import {
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Package,
    BookOpen,
    Calculator,
    MessageCircle,
    Printer,
    Search,
    ArrowLeft,
} from 'lucide-react';

type Tab = 'insumos' | 'recetas' | 'produccion';
type ProdMode = 'manual' | 'quotes';

type Ingredient = {
    id: string;
    name: string;
    category: string;
    format_qty: number;
    format_unit: string;
    format_price: number;
    is_active: boolean;
};

type RecipeItem = {
    id?: string;
    ingredient_id: string;
    qty_base: number;
    ingredients?: Ingredient | null;
};

type Recipe = {
    id: string;
    product_id: string;
    base_liters: number;
    notes: string | null;
    is_active: boolean;
    products?: { id: string; name: string; is_active: boolean } | null;
    recipe_items?: RecipeItem[];
};

type ProductRow = {
    id: string;
    name: string;
    is_active: boolean;
    product_prices?: {
        id: string;
        size: string;
        size_value: number | null;
        price: number;
        offer_price: number | null;
        is_active: boolean;
        display_order: number | null;
    }[];
};

const inputClass =
    'w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#E2A049]/50';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';

export default function RecetarioClient({
    ingredients,
    recipes,
    products,
}: {
    ingredients: Ingredient[];
    recipes: Recipe[];
    products: ProductRow[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [tab, setTab] = useState<Tab>('produccion');
    const [search, setSearch] = useState('');
    type IngSortKey = 'name' | 'category' | 'format_qty' | 'format_price' | 'cost' | 'is_active';
    const [ingSort, setIngSort] = useState<{ key: IngSortKey; dir: 'asc' | 'desc' }>({
        key: 'name',
        dir: 'asc',
    });

    const toggleIngSort = (key: IngSortKey) => {
        setIngSort((prev) => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    // ── Insumos modal ──
    const [ingModal, setIngModal] = useState<{
        open: boolean;
        data: {
            id?: string;
            name: string;
            category: IngredientCategory;
            format_qty: number;
            format_unit: 'ml' | 'g';
            format_price: number;
            is_active: boolean;
        };
    }>({
        open: false,
        data: { name: '', category: 'Licor', format_qty: 750, format_unit: 'ml', format_price: 0, is_active: true },
    });

    // ── Recetas modal ──
    const [recipeModal, setRecipeModal] = useState<{
        open: boolean;
        data: {
            id?: string;
            product_id: string;
            base_liters: number;
            notes: string;
            is_active: boolean;
            items: { ingredient_id: string; qty_base: number }[];
        };
    }>({
        open: false,
        data: { product_id: '', base_liters: 5, notes: '', is_active: true, items: [{ ingredient_id: '', qty_base: 0 }] },
    });
    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
    const [mobileShowRecipeDetail, setMobileShowRecipeDetail] = useState(false);

    // ── Producción ──
    const [prodMode, setProdMode] = useState<ProdMode>('quotes');
    const [manualLiters, setManualLiters] = useState<Record<string, string>>({});
    const [quoteRange, setQuoteRange] = useState<QuoteRange>('week');
    const [quotes, setQuotes] = useState<ProductionQuoteRow[]>([]);
    const [quoteRangeLabel, setQuoteRangeLabel] = useState({ from: '', to: '' });
    const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
    const [loadingQuotes, setLoadingQuotes] = useState(false);
    const [result, setResult] = useState<ProductionResult | null>(null);
    const [skippedNotice, setSkippedNotice] = useState<string[]>([]);

    const activeIngredients = useMemo(
        () => ingredients.filter((i) => i.is_active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [ingredients]
    );

    const recipeProductIds = useMemo(() => new Set(recipes.map((r) => r.product_id)), [recipes]);

    const productsWithoutRecipe = useMemo(
        () => products.filter((p) => !recipeProductIds.has(p.id) && p.is_active),
        [products, recipeProductIds]
    );

    const filteredIngredients = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = !q
            ? [...ingredients]
            : ingredients.filter(
                  (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
              );

        return list.sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (ingSort.key === 'cost') {
                valA = costPerUnit(a);
                valB = costPerUnit(b);
            } else if (ingSort.key === 'format_qty') {
                valA = Number(a.format_qty);
                valB = Number(b.format_qty);
            } else if (ingSort.key === 'format_price') {
                valA = Number(a.format_price);
                valB = Number(b.format_price);
            } else if (ingSort.key === 'is_active') {
                valA = a.is_active ? 1 : 0;
                valB = b.is_active ? 1 : 0;
            } else if (ingSort.key === 'category') {
                valA = a.category.toLowerCase();
                valB = b.category.toLowerCase();
            } else {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            }

            if (valA < valB) return ingSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return ingSort.dir === 'asc' ? 1 : -1;
            // tie-break by name
            return a.name.localeCompare(b.name, 'es');
        });
    }, [ingredients, search, ingSort]);

    const filteredRecipes = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return recipes;
        return recipes.filter((r) => (r.products?.name || '').toLowerCase().includes(q));
    }, [recipes, search]);

    const selectedRecipe = useMemo(
        () => recipes.find((r) => r.id === selectedRecipeId) || filteredRecipes[0] || null,
        [recipes, selectedRecipeId, filteredRecipes]
    );

    useEffect(() => {
        if (selectedRecipe && !selectedRecipeId) setSelectedRecipeId(selectedRecipe.id);
    }, [selectedRecipe, selectedRecipeId]);

    useEffect(() => {
        if (tab === 'produccion' && prodMode === 'quotes') {
            loadQuotes(quoteRange);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, prodMode]);

    const loadQuotes = async (range: QuoteRange) => {
        setLoadingQuotes(true);
        try {
            const res = await getConfirmedQuotesForProduction(range);
            if (res.success && res.quotes) {
                setQuotes(res.quotes);
                setQuoteRangeLabel({ from: res.from || '', to: res.to || '' });
                setSelectedQuoteIds(new Set());
                setResult(null);
            } else {
                alert(res.error || 'Error al cargar cotizaciones');
            }
        } finally {
            setLoadingQuotes(false);
        }
    };

    const openIngredientModal = (ing?: Ingredient) => {
        if (ing) {
            setIngModal({
                open: true,
                data: {
                    id: ing.id,
                    name: ing.name,
                    category: (INGREDIENT_CATEGORIES.includes(ing.category as IngredientCategory)
                        ? ing.category
                        : 'Otros') as IngredientCategory,
                    format_qty: Number(ing.format_qty),
                    format_unit: (ing.format_unit as 'ml' | 'g') || 'ml',
                    format_price: Number(ing.format_price),
                    is_active: ing.is_active,
                },
            });
        } else {
            setIngModal({
                open: true,
                data: { name: '', category: 'Licor', format_qty: 750, format_unit: 'ml', format_price: 0, is_active: true },
            });
        }
    };

    const submitIngredient = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const res = await saveIngredient(ingModal.data);
            if (!res.success) {
                alert(res.error);
                return;
            }
            setIngModal((prev) => ({ ...prev, open: false }));
            router.refresh();
        });
    };

    const openRecipeModal = (recipe?: Recipe, productId?: string) => {
        if (recipe) {
            setRecipeModal({
                open: true,
                data: {
                    id: recipe.id,
                    product_id: recipe.product_id,
                    base_liters: Number(recipe.base_liters) || 5,
                    notes: recipe.notes || '',
                    is_active: recipe.is_active,
                    items:
                        recipe.recipe_items?.map((i) => ({
                            ingredient_id: i.ingredient_id,
                            qty_base: Number(i.qty_base),
                        })) || [{ ingredient_id: '', qty_base: 0 }],
                },
            });
        } else {
            setRecipeModal({
                open: true,
                data: {
                    product_id: productId || productsWithoutRecipe[0]?.id || '',
                    base_liters: 5,
                    notes: '',
                    is_active: true,
                    items: [{ ingredient_id: '', qty_base: 0 }],
                },
            });
        }
    };

    const submitRecipe = (e: React.FormEvent) => {
        e.preventDefault();
        const items = recipeModal.data.items.filter((i) => i.ingredient_id && i.qty_base > 0);
        if (items.length === 0) {
            alert('Agrega al menos un insumo con cantidad.');
            return;
        }
        startTransition(async () => {
            const res = await saveRecipe({
                ...recipeModal.data,
                notes: recipeModal.data.notes || null,
                items,
            });
            if (!res.success) {
                alert(res.error);
                return;
            }
            setRecipeModal((prev) => ({ ...prev, open: false }));
            router.refresh();
        });
    };

    const calculateManual = () => {
        const litersByProductId: Record<string, number> = {};
        for (const recipe of recipes.filter((r) => r.is_active)) {
            const val = parseFloat(manualLiters[recipe.product_id] || '0');
            if (val > 0) litersByProductId[recipe.product_id] = val;
        }
        if (Object.keys(litersByProductId).length === 0) {
            setResult(null);
            setSkippedNotice([]);
            alert('Ingresa al menos un volumen en litros.');
            return;
        }
        const scaled = scaleProduction(litersByProductId, recipes);
        setResult(scaled);
        setSkippedNotice([]);
    };

    const calculateFromQuotes = () => {
        const selected = quotes.filter((q) => selectedQuoteIds.has(q.id));
        if (selected.length === 0) {
            alert('Selecciona al menos una cotización.');
            return;
        }
        const allItems = selected.flatMap((q) => q.quote_items || []);
        const recipeIds = new Set(recipes.filter((r) => r.is_active).map((r) => r.product_id));
        const { litersByProductId, skipped } = aggregateFromQuotes(allItems, recipeIds);
        if (Object.keys(litersByProductId).length === 0) {
            setResult(null);
            setSkippedNotice(skipped);
            alert('No hay cócteles con receta en las cotizaciones seleccionadas.');
            return;
        }
        const scaled = scaleProduction(litersByProductId, recipes);
        setResult(scaled);
        setSkippedNotice(skipped);
    };

    const clearProduction = () => {
        setManualLiters({});
        setSelectedQuoteIds(new Set());
        setResult(null);
        setSkippedNotice([]);
    };

    const shareWhatsApp = () => {
        if (!result) return;
        const msg = buildProductionWhatsAppMessage(result);
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const recipeCost = selectedRecipe
        ? costRecipe(selectedRecipe.recipe_items || [], Number(selectedRecipe.base_liters) || 5)
        : null;

    const selectedProduct = selectedRecipe
        ? products.find((p) => p.id === selectedRecipe.product_id)
        : null;

    const tabTitle =
        tab === 'produccion' ? 'Producción' : tab === 'recetas' ? 'Recetas y Costeo' : 'Insumos';

    return (
        <div className="pb-16 w-full print:pb-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1">{tabTitle}</h1>
                    <p className="text-slate-500 text-sm">
                        {tab === 'insumos' && `${filteredIngredients.length} insumos`}
                        {tab === 'recetas' && `${filteredRecipes.length} recetas · ${productsWithoutRecipe.length} sin receta`}
                        {tab === 'produccion' && 'Calcula lista de producción y compras'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {tab !== 'produccion' && (
                        <div className="relative flex-1 sm:flex-none">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                className={`${inputClass} pl-9 w-full sm:w-44`}
                            />
                        </div>
                    )}
                    {tab === 'insumos' && (
                        <button
                            type="button"
                            onClick={() => openIngredientModal()}
                            className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer border-none"
                        >
                            <Plus size={18} /> Añadir Insumo
                        </button>
                    )}
                    {tab === 'recetas' && (
                        <button
                            type="button"
                            onClick={() => openRecipeModal()}
                            disabled={productsWithoutRecipe.length === 0}
                            className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-40"
                        >
                            <Plus size={18} /> Nueva Receta
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5 border-b border-white/5 mb-8 pb-3 print:hidden">
                {(
                    [
                        { id: 'produccion' as const, label: 'Producción', icon: <Calculator size={14} /> },
                        { id: 'recetas' as const, label: 'Recetas', icon: <BookOpen size={14} /> },
                        { id: 'insumos' as const, label: 'Insumos', icon: <Package size={14} /> },
                    ] as const
                ).map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                            setTab(t.id);
                            setSearch('');
                            setMobileShowRecipeDetail(false);
                        }}
                        className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 border-none ${
                            tab === t.id ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'bg-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════ INSUMOS ═══════════════ */}
            {tab === 'insumos' && (
                <>
                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                        {filteredIngredients.length === 0 && (
                            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 text-center text-slate-500 text-sm font-bold">
                                Sin insumos.
                            </div>
                        )}
                        {filteredIngredients.map((ing) => {
                            const unitCost = costPerUnit(ing);
                            return (
                                <div
                                    key={ing.id}
                                    className={`bg-[#1e2433] rounded-2xl border border-white/5 p-5 shadow-lg ${
                                        !ing.is_active ? 'opacity-60' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-3 mb-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-white font-black text-base tracking-tight truncate">
                                                {ing.name}
                                            </div>
                                            <div className="text-[#E2A049] text-[10px] font-black uppercase tracking-widest mt-1">
                                                {ing.category}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    startTransition(async () => {
                                                        await toggleIngredientStatus(ing.id, !ing.is_active);
                                                        router.refresh();
                                                    })
                                                }
                                                className={`p-2.5 rounded-xl border-none cursor-pointer ${
                                                    ing.is_active
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-rose-500/10 text-rose-400'
                                                }`}
                                            >
                                                {ing.is_active ? <Check size={16} /> : <X size={16} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openIngredientModal(ing)}
                                                className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-[#E2A049] border-none cursor-pointer"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    startTransition(async () => {
                                                        if (!confirm('¿Eliminar este insumo?')) return;
                                                        const res = await deleteIngredient(ing.id);
                                                        if (!res.success) alert(res.error);
                                                        else router.refresh();
                                                    })
                                                }
                                                className="p-2.5 bg-red-500/5 rounded-xl text-red-400/70 hover:text-red-400 border-none cursor-pointer"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                Formato
                                            </div>
                                            <div className="text-slate-200 font-semibold">
                                                {Number(ing.format_qty)} {ing.format_unit}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                                                Costo/u
                                            </div>
                                            <div className="text-slate-200 font-semibold">
                                                {formatCurrency(unitCost)}/{ing.format_unit}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">
                                            Precio formato
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 text-xs font-bold">$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                defaultValue={Number(ing.format_price)}
                                                key={`m-${ing.id}-${ing.format_price}`}
                                                className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200"
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (Number.isNaN(val) || val === Number(ing.format_price)) return;
                                                    startTransition(async () => {
                                                        const res = await updateIngredientPrice(ing.id, val);
                                                        if (!res.success) alert(res.error);
                                                        else router.refresh();
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02]">
                                        {(
                                            [
                                                { label: 'Nombre', field: 'name' as const },
                                                { label: 'Categoría', field: 'category' as const },
                                                { label: 'Formato', field: 'format_qty' as const },
                                                { label: 'Precio', field: 'format_price' as const },
                                                { label: 'Costo/u', field: 'cost' as const },
                                                { label: 'Estado', field: 'is_active' as const },
                                            ] as const
                                        ).map((h) => (
                                            <th
                                                key={h.field}
                                                className="text-left py-4 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5 cursor-pointer"
                                                onClick={() => toggleIngSort(h.field)}
                                            >
                                                <span
                                                    className={`inline-flex items-center gap-1 ${
                                                        ingSort.key === h.field ? 'text-[#E2A049]' : ''
                                                    }`}
                                                >
                                                    {h.label}
                                                    {ingSort.key === h.field &&
                                                        (ingSort.dir === 'asc' ? ' 🔼' : ' 🔽')}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="text-left py-4 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIngredients.map((ing) => {
                                        const unitCost = costPerUnit(ing);
                                        return (
                                            <tr
                                                key={ing.id}
                                                className={`border-b border-white/5 ${!ing.is_active ? 'opacity-50' : ''}`}
                                            >
                                                <td className="py-3 px-4 text-sm font-bold text-white">{ing.name}</td>
                                                <td className="py-3 px-4 text-xs text-[#E2A049] font-bold uppercase tracking-wider">
                                                    {ing.category}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-300">
                                                    {Number(ing.format_qty)} {ing.format_unit}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        defaultValue={Number(ing.format_price)}
                                                        key={`${ing.id}-${ing.format_price}`}
                                                        className="w-28 bg-[#0d1117] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-slate-200"
                                                        onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            if (
                                                                Number.isNaN(val) ||
                                                                val === Number(ing.format_price)
                                                            )
                                                                return;
                                                            startTransition(async () => {
                                                                const res = await updateIngredientPrice(
                                                                    ing.id,
                                                                    val
                                                                );
                                                                if (!res.success) alert(res.error);
                                                                else router.refresh();
                                                            });
                                                        }}
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-400">
                                                    {formatCurrency(unitCost)}/{ing.format_unit}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            startTransition(async () => {
                                                                await toggleIngredientStatus(
                                                                    ing.id,
                                                                    !ing.is_active
                                                                );
                                                                router.refresh();
                                                            })
                                                        }
                                                        className={`p-2 rounded-lg border-none cursor-pointer ${
                                                            ing.is_active
                                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                                : 'bg-rose-500/10 text-rose-400'
                                                        }`}
                                                    >
                                                        {ing.is_active ? <Check size={16} /> : <X size={16} />}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openIngredientModal(ing)}
                                                            className="p-2 bg-white/5 text-slate-400 rounded-lg hover:text-[#E2A049] border-none cursor-pointer"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                startTransition(async () => {
                                                                    if (!confirm('¿Eliminar este insumo?'))
                                                                        return;
                                                                    const res = await deleteIngredient(ing.id);
                                                                    if (!res.success) alert(res.error);
                                                                    else router.refresh();
                                                                })
                                                            }
                                                            className="p-2 bg-white/5 text-slate-400 rounded-lg hover:text-rose-400 border-none cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════════ RECETAS ═══════════════ */}
            {tab === 'recetas' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Lista */}
                    <div
                        className={`lg:col-span-1 ${
                            mobileShowRecipeDetail ? 'hidden lg:block' : 'block'
                        }`}
                    >
                        {/* Mobile cards */}
                        <div className="flex flex-col gap-3 lg:hidden">
                            {filteredRecipes.length === 0 && (
                                <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 text-center text-slate-500 text-sm font-bold">
                                    No hay recetas.
                                </div>
                            )}
                            {filteredRecipes.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedRecipeId(r.id);
                                        setMobileShowRecipeDetail(true);
                                    }}
                                    className="bg-[#1e2433] rounded-2xl border border-white/5 p-5 text-left shadow-lg cursor-pointer border-solid"
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <div className="text-white font-black text-base tracking-tight">
                                                {r.products?.name || 'Sin producto'}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-widest mt-1.5 text-slate-500 font-bold">
                                                {r.recipe_items?.length || 0} insumos · Base{' '}
                                                {Number(r.base_liters)} L
                                            </div>
                                        </div>
                                        <span
                                            className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                                                r.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-rose-500/10 text-rose-400'
                                            }`}
                                        >
                                            {r.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Desktop sidebar list */}
                        <div className="hidden lg:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden max-h-[70vh] overflow-y-auto">
                            {filteredRecipes.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setSelectedRecipeId(r.id)}
                                    className={`w-full text-left px-4 py-3 border-b border-white/5 border-x-0 border-t-0 cursor-pointer ${
                                        selectedRecipe?.id === r.id
                                            ? 'bg-[#E2A049]/10 text-white'
                                            : 'bg-transparent text-slate-400 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="font-bold text-sm">
                                        {r.products?.name || 'Sin producto'}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest mt-1 text-slate-500">
                                        {r.recipe_items?.length || 0} insumos ·{' '}
                                        {r.is_active ? 'Activa' : 'Inactiva'}
                                    </div>
                                </button>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <p className="p-6 text-slate-500 text-sm text-center">No hay recetas.</p>
                            )}
                        </div>
                    </div>

                    {/* Detalle */}
                    <div
                        className={`lg:col-span-2 bg-[#1e2433] rounded-2xl border border-white/5 p-4 sm:p-6 ${
                            mobileShowRecipeDetail ? 'block' : 'hidden lg:block'
                        }`}
                    >
                        {!selectedRecipe ? (
                            <p className="text-slate-500 text-center py-12">Selecciona una receta</p>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setMobileShowRecipeDetail(false)}
                                    className="lg:hidden mb-4 flex items-center gap-2 text-slate-400 text-sm font-bold bg-transparent border-none cursor-pointer hover:text-white"
                                >
                                    <ArrowLeft size={16} /> Volver a la lista
                                </button>

                                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-white text-xl font-black mb-1">
                                            {selectedRecipe.products?.name}
                                        </h2>
                                        <p className="text-slate-500 text-sm">
                                            Base {Number(selectedRecipe.base_liters)} L
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => openRecipeModal(selectedRecipe)}
                                            className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white/5 text-slate-300 text-sm font-bold flex items-center justify-center gap-2 border-none cursor-pointer hover:text-[#E2A049]"
                                        >
                                            <Pencil size={14} /> Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                startTransition(async () => {
                                                    await toggleRecipeStatus(
                                                        selectedRecipe.id,
                                                        !selectedRecipe.is_active
                                                    );
                                                    router.refresh();
                                                })
                                            }
                                            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm font-bold border-none cursor-pointer ${
                                                selectedRecipe.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-rose-500/10 text-rose-400'
                                            }`}
                                        >
                                            {selectedRecipe.is_active ? 'Activa' : 'Inactiva'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                startTransition(async () => {
                                                    if (!confirm('¿Eliminar esta receta?')) return;
                                                    const res = await deleteRecipe(selectedRecipe.id);
                                                    if (!res.success) alert(res.error);
                                                    else {
                                                        setSelectedRecipeId(null);
                                                        setMobileShowRecipeDetail(false);
                                                        router.refresh();
                                                    }
                                                })
                                            }
                                            className="px-3 py-2 rounded-xl bg-white/5 text-rose-400 text-sm font-bold border-none cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Mobile: líneas como cards */}
                                <div className="flex flex-col gap-2 mb-6 sm:hidden">
                                    {(selectedRecipe.recipe_items || []).map((item) => {
                                        const ing = item.ingredients;
                                        const line = ing ? Number(item.qty_base) * costPerUnit(ing) : 0;
                                        return (
                                            <div
                                                key={item.id || item.ingredient_id}
                                                className="bg-[#0d1117] rounded-xl border border-white/5 p-3"
                                            >
                                                <div className="text-white text-sm font-bold">
                                                    {ing?.name || '—'}
                                                </div>
                                                <div className="flex justify-between mt-1 text-xs text-slate-400">
                                                    <span>
                                                        {Number(item.qty_base)} {ing?.format_unit}
                                                    </span>
                                                    <span className="font-semibold text-slate-300">
                                                        {formatCurrency(line)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop: tabla insumos */}
                                <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5 mb-6">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-white/[0.02]">
                                                {['Insumo', 'Cantidad', 'Costo línea'].map((h) => (
                                                    <th
                                                        key={h}
                                                        className="text-left py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedRecipe.recipe_items || []).map((item) => {
                                                const ing = item.ingredients;
                                                const line =
                                                    ing ? Number(item.qty_base) * costPerUnit(ing) : 0;
                                                return (
                                                    <tr
                                                        key={item.id || item.ingredient_id}
                                                        className="border-b border-white/5"
                                                    >
                                                        <td className="py-3 px-4 text-sm text-white font-medium">
                                                            {ing?.name || '—'}
                                                            <span className="block text-[10px] text-slate-500 uppercase">
                                                                {ing?.category}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-slate-300">
                                                            {Number(item.qty_base)} {ing?.format_unit}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-slate-300">
                                                            {formatCurrency(line)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {recipeCost && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                        <div className="bg-[#0d1117] rounded-xl p-4 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                                                Costo {Number(selectedRecipe.base_liters)} L
                                            </div>
                                            <div className="text-lg font-black text-white">
                                                {formatCurrency(recipeCost.total)}
                                            </div>
                                        </div>
                                        <div className="bg-[#0d1117] rounded-xl p-4 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                                                Por litro
                                            </div>
                                            <div className="text-lg font-black text-white">
                                                {formatCurrency(recipeCost.perLiter)}
                                            </div>
                                        </div>
                                        <div className="bg-[#0d1117] rounded-xl p-4 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                                                Por trago (200 ml)
                                            </div>
                                            <div className="text-lg font-black text-white">
                                                {formatCurrency(recipeCost.perDrink)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedProduct?.product_prices && recipeCost && (
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
                                            Margen vs precio venta
                                        </h3>
                                        {/* Mobile margin cards */}
                                        <div className="flex flex-col gap-2 sm:hidden">
                                            {[...(selectedProduct.product_prices || [])]
                                                .filter((p) => p.is_active !== false)
                                                .sort(
                                                    (a, b) =>
                                                        (a.display_order || 0) - (b.display_order || 0)
                                                )
                                                .map((price) => {
                                                    const liters = Number(price.size_value) || 0;
                                                    const sale =
                                                        Number(price.offer_price ?? price.price) || 0;
                                                    const cost = recipeCost.perLiter * liters;
                                                    const margin = sale - cost;
                                                    const pct = sale > 0 ? (margin / sale) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={price.id}
                                                            className="bg-[#0d1117] rounded-xl border border-white/5 p-3"
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-white font-bold text-sm">
                                                                    {price.size}
                                                                </span>
                                                                <span
                                                                    className={`text-xs font-black ${
                                                                        margin >= 0
                                                                            ? 'text-emerald-400'
                                                                            : 'text-rose-400'
                                                                    }`}
                                                                >
                                                                    {roundQty(pct, 1)}%
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                                <div>
                                                                    <div className="text-slate-500 uppercase font-bold">
                                                                        Venta
                                                                    </div>
                                                                    <div className="text-slate-300">
                                                                        {formatCurrency(sale)}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-slate-500 uppercase font-bold">
                                                                        Costo
                                                                    </div>
                                                                    <div className="text-slate-300">
                                                                        {formatCurrency(cost)}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-slate-500 uppercase font-bold">
                                                                        Margen
                                                                    </div>
                                                                    <div
                                                                        className={
                                                                            margin >= 0
                                                                                ? 'text-emerald-400 font-bold'
                                                                                : 'text-rose-400 font-bold'
                                                                        }
                                                                    >
                                                                        {formatCurrency(margin)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-white/[0.02]">
                                                        {['Tamaño', 'Venta', 'Costo', 'Margen', '%'].map(
                                                            (h) => (
                                                                <th
                                                                    key={h}
                                                                    className="text-left py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"
                                                                >
                                                                    {h}
                                                                </th>
                                                            )
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[...(selectedProduct.product_prices || [])]
                                                        .filter((p) => p.is_active !== false)
                                                        .sort(
                                                            (a, b) =>
                                                                (a.display_order || 0) -
                                                                (b.display_order || 0)
                                                        )
                                                        .map((price) => {
                                                            const liters = Number(price.size_value) || 0;
                                                            const sale =
                                                                Number(
                                                                    price.offer_price ?? price.price
                                                                ) || 0;
                                                            const cost = recipeCost.perLiter * liters;
                                                            const margin = sale - cost;
                                                            const pct =
                                                                sale > 0 ? (margin / sale) * 100 : 0;
                                                            return (
                                                                <tr
                                                                    key={price.id}
                                                                    className="border-b border-white/5"
                                                                >
                                                                    <td className="py-3 px-4 text-sm text-white font-medium">
                                                                        {price.size}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-sm text-slate-300">
                                                                        {formatCurrency(sale)}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-sm text-slate-300">
                                                                        {formatCurrency(cost)}
                                                                    </td>
                                                                    <td
                                                                        className={`py-3 px-4 text-sm font-bold ${
                                                                            margin >= 0
                                                                                ? 'text-emerald-400'
                                                                                : 'text-rose-400'
                                                                        }`}
                                                                    >
                                                                        {formatCurrency(margin)}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-sm text-slate-400">
                                                                        {roundQty(pct, 1)}%
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ PRODUCCIÓN ═══════════════ */}
            {tab === 'produccion' && (
                <div>
                    <div className="flex gap-2 mb-6 print:hidden">
                        {(
                            [
                                { id: 'quotes' as const, label: 'Desde pedidos' },
                                { id: 'manual' as const, label: 'Manual' },
                            ] as const
                        ).map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                    setProdMode(m.id);
                                    setResult(null);
                                    setSkippedNotice([]);
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border-none cursor-pointer ${
                                    prodMode === m.id
                                        ? 'bg-[#E2A049] text-black'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {prodMode === 'manual' && (
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 mb-6 print:hidden">
                            <h2 className="text-white font-bold mb-4">Litros por cóctel</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recipes
                                    .filter((r) => r.is_active)
                                    .sort((a, b) =>
                                        (a.products?.name || '').localeCompare(b.products?.name || '', 'es')
                                    )
                                    .map((r) => (
                                        <div key={r.id}>
                                            <label className={labelClass}>{r.products?.name}</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                placeholder="Litros"
                                                value={manualLiters[r.product_id] || ''}
                                                onChange={(e) =>
                                                    setManualLiters((prev) => ({
                                                        ...prev,
                                                        [r.product_id]: e.target.value,
                                                    }))
                                                }
                                                className={inputClass}
                                            />
                                        </div>
                                    ))}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={calculateManual}
                                    className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm border-none cursor-pointer"
                                >
                                    Calcular
                                </button>
                                <button
                                    type="button"
                                    onClick={clearProduction}
                                    className="bg-white/5 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm border-none cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    )}

                    {prodMode === 'quotes' && (
                        <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 mb-6 print:hidden">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <h2 className="text-white font-bold mr-auto">Cotizaciones confirmadas</h2>
                                {(
                                    [
                                        { id: 'week' as const, label: 'Esta semana' },
                                        { id: 'next7' as const, label: 'Próximos 7 días' },
                                        { id: 'month' as const, label: 'Mes actual' },
                                    ] as const
                                ).map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => {
                                            setQuoteRange(r.id);
                                            loadQuotes(r.id);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer ${
                                            quoteRange === r.id
                                                ? 'bg-[#E2A049]/15 text-[#E2A049]'
                                                : 'bg-white/5 text-slate-500'
                                        }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            {quoteRangeLabel.from && (
                                <p className="text-xs text-slate-500 mb-4">
                                    {quoteRangeLabel.from} → {quoteRangeLabel.to}
                                    {loadingQuotes ? ' · Cargando…' : ` · ${quotes.length} pedidos`}
                                </p>
                            )}

                            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/5 mb-4">
                                {quotes.length === 0 && !loadingQuotes && (
                                    <p className="p-6 text-slate-500 text-sm text-center">
                                        No hay cotizaciones confirmadas en este rango.
                                    </p>
                                )}
                                {quotes.map((q) => {
                                    const checked = selectedQuoteIds.has(q.id);
                                    const name = [q.client_name, q.client_lastname].filter(Boolean).join(' ');
                                    return (
                                        <label
                                            key={q.id}
                                            className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 cursor-pointer ${
                                                checked ? 'bg-[#E2A049]/5' : 'hover:bg-white/[0.02]'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    setSelectedQuoteIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(q.id)) next.delete(q.id);
                                                        else next.add(q.id);
                                                        return next;
                                                    });
                                                }}
                                                className="mt-1 accent-[#E2A049]"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {q.event_date}
                                                    {q.total_liters != null ? ` · ${q.total_liters} L` : ''}
                                                </div>
                                                <div className="text-[11px] text-slate-600 mt-1">
                                                    {(q.quote_items || [])
                                                        .map((i) => `${i.quantity}× ${i.product_name} (${i.size})`)
                                                        .join(' · ')}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={calculateFromQuotes}
                                    disabled={selectedQuoteIds.size === 0}
                                    className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm border-none cursor-pointer disabled:opacity-40"
                                >
                                    Calcular ({selectedQuoteIds.size})
                                </button>
                                <button
                                    type="button"
                                    onClick={clearProduction}
                                    className="bg-white/5 text-slate-300 px-5 py-2.5 rounded-xl font-bold text-sm border-none cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    )}

                    {skippedNotice.length > 0 && (
                        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm print:hidden">
                            Sin receta o no líquidos (omitidos): {skippedNotice.join(', ')}
                        </div>
                    )}

                    {result && (
                        <div id="production-result" className="space-y-6">
                            <div className="flex flex-wrap gap-3 print:hidden">
                                <button
                                    type="button"
                                    onClick={shareWhatsApp}
                                    className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 border-none cursor-pointer"
                                >
                                    <MessageCircle size={16} /> WhatsApp
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 border-none cursor-pointer"
                                >
                                    <Printer size={16} /> Imprimir
                                </button>
                            </div>

                            <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-6 print:bg-white print:text-black print:border-slate-200">
                                <h2 className="text-lg font-black text-white print:text-black mb-4">
                                    Resumen de producción
                                </h2>
                                <ul className="space-y-1 mb-6">
                                    {Object.values(result.litersByProduct)
                                        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                                        .map((row) => (
                                            <li key={row.productId} className="text-sm text-slate-300 print:text-slate-800">
                                                <span className="font-bold text-white print:text-black">{row.name}</span>
                                                : {roundQty(row.liters)} L
                                            </li>
                                        ))}
                                </ul>

                                <h3 className="text-base font-bold text-white print:text-black mb-3">
                                    Lista técnica
                                </h3>
                                <table className="w-full border-collapse text-sm table-fixed mb-2">
                                    <colgroup>
                                        <col />
                                        <col className="w-28" />
                                        <col className="w-16" />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="text-left py-1 text-slate-500 text-[10px] uppercase">
                                                Insumo
                                            </th>
                                            <th className="text-right py-1 pr-2 text-slate-500 text-[10px] uppercase">
                                                Cantidad
                                            </th>
                                            <th className="text-right py-1 text-slate-500 text-[10px] uppercase">
                                                Unidad
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.byCategory.map((group) => (
                                            <Fragment key={group.category}>
                                                <tr>
                                                    <td
                                                        colSpan={3}
                                                        className="pt-4 pb-1 text-sm font-bold text-[#E2A049] print:text-slate-700 border-b border-white/10 print:border-slate-200"
                                                    >
                                                        {group.category}
                                                    </td>
                                                </tr>
                                                {group.items.map((item) => (
                                                    <tr
                                                        key={item.ingredientId}
                                                        className="border-t border-white/5 print:border-slate-100"
                                                    >
                                                        <td className="py-1.5 text-slate-200 print:text-slate-800">
                                                            {item.name}
                                                        </td>
                                                        <td className="py-1.5 text-right pr-2 tabular-nums text-slate-300 print:text-slate-700">
                                                            {roundQty(item.qty)}
                                                        </td>
                                                        <td className="py-1.5 text-right text-slate-400">
                                                            {item.unit}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>

                                <h3 className="text-base font-bold text-white print:text-black mb-3 mt-8">
                                    Recetas por cóctel
                                </h3>
                                {result.scaledRecipes.map((recipe) => (
                                    <div key={recipe.productId} className="mb-6 last:mb-0">
                                        <h4 className="text-sm font-black text-white print:text-black mb-3 pb-2 border-b border-white/10 print:border-slate-200">
                                            {recipe.name}
                                            <span className="text-[#E2A049] print:text-slate-600 font-bold ml-2">
                                                {roundQty(recipe.liters)} L
                                            </span>
                                        </h4>
                                        <table className="w-full border-collapse text-sm table-fixed mb-2">
                                            <colgroup>
                                                <col />
                                                <col className="w-28" />
                                                <col className="w-16" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th className="text-left py-1 text-slate-500 text-[10px] uppercase">
                                                        Insumo
                                                    </th>
                                                    <th className="text-right py-1 pr-2 text-slate-500 text-[10px] uppercase">
                                                        Cantidad
                                                    </th>
                                                    <th className="text-right py-1 text-slate-500 text-[10px] uppercase">
                                                        Unidad
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recipe.items.map((item) => (
                                                    <tr
                                                        key={`${recipe.productId}-${item.ingredientId}`}
                                                        className="border-t border-white/5 print:border-slate-100"
                                                    >
                                                        <td className="py-1.5 text-slate-200 print:text-slate-800">
                                                            {item.name}
                                                        </td>
                                                        <td className="py-1.5 text-right pr-2 tabular-nums text-slate-300 print:text-slate-700">
                                                            {roundQty(item.qty)}
                                                        </td>
                                                        <td className="py-1.5 text-right text-slate-400">
                                                            {item.unit}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-white/10 print:border-slate-200 flex justify-between items-center mt-8">
                                    <span className="text-sm font-bold text-slate-400 print:text-slate-600">
                                        Costo estimado total
                                    </span>
                                    <span className="text-xl font-black text-[#E2A049] print:text-black">
                                        {formatCurrency(result.totalCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Insumo */}
            <Modal
                isOpen={ingModal.open}
                onClose={() => setIngModal((p) => ({ ...p, open: false }))}
                title={ingModal.data.id ? 'Editar insumo' : 'Nuevo insumo'}
            >
                <form onSubmit={submitIngredient} className="space-y-4">
                    <div>
                        <label className={labelClass}>Nombre</label>
                        <input
                            required
                            className={inputClass}
                            value={ingModal.data.name}
                            onChange={(e) =>
                                setIngModal((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))
                            }
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Categoría</label>
                        <select
                            className={inputClass}
                            value={ingModal.data.category}
                            onChange={(e) =>
                                setIngModal((p) => ({
                                    ...p,
                                    data: { ...p.data, category: e.target.value as IngredientCategory },
                                }))
                            }
                        >
                            {INGREDIENT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Formato (cantidad)</label>
                            <input
                                type="number"
                                min={0.01}
                                step="any"
                                required
                                className={inputClass}
                                value={ingModal.data.format_qty}
                                onChange={(e) =>
                                    setIngModal((p) => ({
                                        ...p,
                                        data: { ...p.data, format_qty: parseFloat(e.target.value) || 0 },
                                    }))
                                }
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Unidad</label>
                            <select
                                className={inputClass}
                                value={ingModal.data.format_unit}
                                onChange={(e) =>
                                    setIngModal((p) => ({
                                        ...p,
                                        data: { ...p.data, format_unit: e.target.value as 'ml' | 'g' },
                                    }))
                                }
                            >
                                <option value="ml">ml</option>
                                <option value="g">g</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Precio del formato (CLP)</label>
                        <input
                            type="number"
                            min={0}
                            step={1}
                            required
                            className={inputClass}
                            value={ingModal.data.format_price}
                            onChange={(e) =>
                                setIngModal((p) => ({
                                    ...p,
                                    data: { ...p.data, format_price: parseFloat(e.target.value) || 0 },
                                }))
                            }
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-[#E2A049] text-black py-3 rounded-xl font-black text-sm border-none cursor-pointer disabled:opacity-50"
                        >
                            {isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIngModal((p) => ({ ...p, open: false }))}
                            className="px-5 py-3 rounded-xl bg-white/5 text-slate-300 font-bold text-sm border-none cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Receta */}
            <Modal
                isOpen={recipeModal.open}
                onClose={() => setRecipeModal((p) => ({ ...p, open: false }))}
                title={recipeModal.data.id ? 'Editar receta' : 'Nueva receta'}
            >
                <form onSubmit={submitRecipe} className="space-y-4">
                    <div>
                        <label className={labelClass}>Producto del catálogo</label>
                        <select
                            required
                            className={inputClass}
                            value={recipeModal.data.product_id}
                            disabled={!!recipeModal.data.id}
                            onChange={(e) =>
                                setRecipeModal((p) => ({ ...p, data: { ...p.data, product_id: e.target.value } }))
                            }
                        >
                            <option value="">— Selecciona —</option>
                            {recipeModal.data.id
                                ? products
                                      .filter((p) => p.id === recipeModal.data.product_id)
                                      .map((p) => (
                                          <option key={p.id} value={p.id}>
                                              {p.name}
                                          </option>
                                      ))
                                : productsWithoutRecipe.map((p) => (
                                      <option key={p.id} value={p.id}>
                                          {p.name}
                                      </option>
                                  ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Base (litros)</label>
                        <input
                            type="number"
                            min={0.1}
                            step="any"
                            required
                            className={inputClass}
                            value={recipeModal.data.base_liters}
                            onChange={(e) =>
                                setRecipeModal((p) => ({
                                    ...p,
                                    data: { ...p.data, base_liters: parseFloat(e.target.value) || 5 },
                                }))
                            }
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass + ' mb-0'}>Insumos (base)</label>
                            <button
                                type="button"
                                onClick={() =>
                                    setRecipeModal((p) => ({
                                        ...p,
                                        data: {
                                            ...p.data,
                                            items: [...p.data.items, { ingredient_id: '', qty_base: 0 }],
                                        },
                                    }))
                                }
                                className="text-xs font-bold text-[#E2A049] bg-transparent border-none cursor-pointer"
                            >
                                + Línea
                            </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {recipeModal.data.items.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <select
                                        required
                                        className={`${inputClass} flex-1`}
                                        value={item.ingredient_id}
                                        onChange={(e) => {
                                            const items = [...recipeModal.data.items];
                                            items[idx] = { ...items[idx], ingredient_id: e.target.value };
                                            setRecipeModal((p) => ({ ...p, data: { ...p.data, items } }));
                                        }}
                                    >
                                        <option value="">Insumo…</option>
                                        {activeIngredients.map((ing) => (
                                            <option key={ing.id} value={ing.id}>
                                                {ing.name} ({ing.format_unit})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={0.01}
                                        step="any"
                                        required
                                        placeholder="Cant."
                                        className={`${inputClass} w-24`}
                                        value={item.qty_base || ''}
                                        onChange={(e) => {
                                            const items = [...recipeModal.data.items];
                                            items[idx] = {
                                                ...items[idx],
                                                qty_base: parseFloat(e.target.value) || 0,
                                            };
                                            setRecipeModal((p) => ({ ...p, data: { ...p.data, items } }));
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRecipeModal((p) => ({
                                                ...p,
                                                data: {
                                                    ...p.data,
                                                    items: p.data.items.filter((_, i) => i !== idx),
                                                },
                                            }))
                                        }
                                        className="p-2 text-slate-500 hover:text-rose-400 bg-transparent border-none cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Notas</label>
                        <textarea
                            className={inputClass}
                            rows={2}
                            value={recipeModal.data.notes}
                            onChange={(e) =>
                                setRecipeModal((p) => ({ ...p, data: { ...p.data, notes: e.target.value } }))
                            }
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-[#E2A049] text-black py-3 rounded-xl font-black text-sm border-none cursor-pointer disabled:opacity-50"
                        >
                            {isPending ? 'Guardando…' : 'Guardar receta'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRecipeModal((p) => ({ ...p, open: false }))}
                            className="px-5 py-3 rounded-xl bg-white/5 text-slate-300 font-bold text-sm border-none cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
