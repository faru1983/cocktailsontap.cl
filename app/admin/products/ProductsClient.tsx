'use client';

import { useState, useTransition, useEffect } from 'react';
import { saveCategory, toggleCategoryStatus, saveProduct, toggleProductStatus, reorderItems } from '@/app/actions/admin/productActions';
import Modal from '@/components/admin/Modal';
import { supabase } from '@/lib/supabase';
import { 
    GripVertical, 
    Plus, 
    Pencil, 
    Trash2, 
    Check, 
    X, 
    ArrowUpDown, 
    Image as ImageIcon,
    RefreshCw,
    Maximize2,
    Eye,
    Tag,
    Layers,
    Package,
    PlusCircle
} from 'lucide-react';

export default function ProductsClient({ products, categories }: { products: any[]; categories: any[] }) {
    const [tab, setTab] = useState<'products' | 'categories' | 'gallery'>('products');
    const [isPending, startTransition] = useTransition();
    const DEFAULT_IMG = '/assets/barril_sin_imagen.webp';

    // ─── Sorting & Data ──────────────────────────────────────────────────────
    const itemsWithIndex = (arr: any[]) => arr.map((item, idx) => ({ ...item, _idx: idx }));
    const [indexedProducts, setIndexedProducts] = useState(itemsWithIndex(products));
    const [indexedCategories, setIndexedCategories] = useState(itemsWithIndex(categories));
    
    const [sortProd, setSortProd] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'index', dir: 'asc' });
    const [sortCat, setSortCat] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'index', dir: 'asc' });

    useEffect(() => {
        setIndexedProducts(itemsWithIndex(products));
        setIndexedCategories(itemsWithIndex(categories));
    }, [products, categories]);

    const sortedProducts = [...indexedProducts].sort((a, b) => {
        let valA, valB;
        if (sortProd.key === 'category') {
            valA = a.categories?.name || '';
            valB = b.categories?.name || '';
        } else if (sortProd.key === 'price') {
            valA = a.product_prices?.[0]?.price || 0;
            valB = b.product_prices?.[0]?.price || 0;
        } else if (sortProd.key === 'index') {
            valA = a._idx;
            valB = b._idx;
        } else {
            valA = a[sortProd.key];
            valB = b[sortProd.key];
        }

        if (valA < valB) return sortProd.dir === 'asc' ? -1 : 1;
        if (valA > valB) return sortProd.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const sortedCategories = [...indexedCategories].sort((a, b) => {
        const valA = sortCat.key === 'index' ? a._idx : a[sortCat.key];
        const valB = sortCat.key === 'index' ? b._idx : b[sortCat.key];
        if (valA < valB) return sortCat.dir === 'asc' ? -1 : 1;
        if (valA > valB) return sortCat.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // ─── Drag & Drop ─────────────────────────────────────────────────────────
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const onDragStart = (idx: number) => {
        if (sortProd.key !== 'index' && sortProd.key !== 'display_order') {
            return;
        }
        setDragIndex(idx);
    };

    const onDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
    };

    const onDrop = async (idx: number, type: 'products' | 'categories') => {
        if (dragIndex === null || dragIndex === idx) return;
        
        const list = type === 'products' ? [...sortedProducts] : [...sortedCategories];
        const movedItem = list.splice(dragIndex, 1)[0];
        list.splice(idx, 0, movedItem);

        const reordered = list.map((item, i) => ({ ...item, display_order: i + 1 }));
        
        if (type === 'products') setIndexedProducts(reordered.map((it, i) => ({...it, _idx: i})));
        else setIndexedCategories(reordered.map((it, i) => ({...it, _idx: i})));

        startTransition(async () => {
            const updates = reordered.map(item => ({ id: item.id, display_order: item.display_order }));
            await reorderItems(type, updates);
        });
        
        setDragIndex(null);
    };

    const toggleSortProd = (key: string) => {
        setSortProd(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }
    const toggleSortCat = (key: string) => {
        setSortCat(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }

    // ─── Modal States ────────────────────────────────────────────────────────
    const [modalCategory, setModalCategory] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
    const [modalProduct, setModalProduct] = useState<{ isOpen: boolean; data: any; prices: any[] }>({ isOpen: false, data: null, prices: [] });
    const [modalGallery, setModalGallery] = useState<{ isOpen: boolean; onSelect?: (url: string) => void }>({ isOpen: false });

    // ─── Gallery Data ────────────────────────────────────────────────────────
    const [galleryImages, setGalleryImages] = useState<any[]>([]);
    const [loadingGallery, setLoadingGallery] = useState(false);
    const [galleryLoadedAt, setGalleryLoadedAt] = useState<number | null>(null);

    const fetchGallery = async (force = false) => {
        const now = Date.now();
        if (!force && galleryImages.length > 0 && galleryLoadedAt && (now - galleryLoadedAt < 300000)) return;

        setLoadingGallery(true);
        const { data, error } = await supabase.storage.from('product-images').list('', { 
            sortBy: { column: 'created_at', order: 'desc' },
            limit: 100
        });
        if (data) {
            setGalleryImages(data);
            setGalleryLoadedAt(now);
        }
        setLoadingGallery(false);
    }

    const deleteFromGallery = async (name: string) => {
        if (!confirm('¿Eliminar esta imagen permanentemente?')) return;
        setLoadingGallery(true);
        await supabase.storage.from('product-images').remove([name]);
        await fetchGallery(true);
    }

    const openCategoryModal = (cat: any = null) => {
        setModalCategory({ 
            isOpen: true, 
            data: cat || { name: '', display_order: 0, is_active: true } 
        });
    }

    const openProductModal = (prod: any = null) => {
        setModalProduct({ 
            isOpen: true, 
            data: prod || { name: '', description: '', image_url: '', display_order: 0, category_id: categories[0]?.id || '', is_active: true },
            prices: prod ? [...prod.product_prices] : [{ size: '', price: 0, offer_price: null }]
        });
    }

    // ─── Handlers ────────────────────────────────────────────────────────────
    const submitCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            await saveCategory(modalCategory.data);
            setModalCategory({ isOpen: false, data: null });
        });
    }

    const submitProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            await saveProduct(modalProduct.data, modalProduct.prices);
            setModalProduct({ isOpen: false, data: null, prices: [] });
        });
    }

    const toggleStatus = (id: string, type: 'prod' | 'cat', current: boolean) => {
        startTransition(async () => {
            if (type === 'cat') await toggleCategoryStatus(id, current);
            else await toggleProductStatus(id, current);
        });
    }

    const addPriceRow = () => {
        setModalProduct(prev => ({ ...prev, prices: [...prev.prices, { size: '', price: 0, offer_price: null }] }));
    }

    const removePriceRow = (index: number) => {
        setModalProduct(prev => ({ ...prev, prices: prev.prices.filter((_, i) => i !== index) }));
    }

    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, insideProduct = true) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const { error } = await supabase.storage.from('product-images').upload(fileName, file);
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
            
            if (insideProduct) {
                setModalProduct(prev => ({ ...prev, data: { ...prev.data, image_url: publicUrl } }));
            } else {
                await fetchGallery();
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const formatPrice = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'Clp', minimumFractionDigits: 0 }).format(n);

    return (
        <div className="pb-16 w-full">
            {/* Header Simplified */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-white text-2xl font-black mb-1 capitalize">
                        {tab === 'products' ? 'Catálogo de Productos' : tab === 'categories' ? 'Categorías' : 'Gestión de Imágenes'}
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Total: {tab === 'products' ? sortedProducts.length : tab === 'categories' ? sortedCategories.length : galleryImages.length} registros
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {tab !== 'gallery' && (
                        <button 
                            className="bg-[#E2A049] text-black px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-[#E2A049]/10"
                            onClick={() => tab === 'products' ? openProductModal() : openCategoryModal()}
                        >
                           <Plus size={18} /> {tab === 'products' ? 'Añadir Producto' : 'Añadir Categoría'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs with "Reminders" Style (No icons as requested for categories) */}
            <div className="flex gap-1.5 border-b border-white/5 mb-8 pb-3 overflow-x-auto scrollbar-none">
                <button 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                        tab === 'products' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                    }`} 
                    onClick={() => setTab('products')}
                >
                    Productos
                </button>
                <button 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                        tab === 'categories' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                    }`} 
                    onClick={() => setTab('categories')}
                >
                    Categorías
                </button>
                <button 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                        tab === 'gallery' ? 'bg-[#E2A049]/10 text-[#E2A049]' : 'text-slate-500 hover:text-slate-300'
                    }`} 
                    onClick={() => setTab('gallery')}
                >
                    Galería
                </button>
            </div>

            {/* Listing Section */}
            <div className="animate-in fade-in duration-500">
                {tab === 'products' && (
                    <>
                        <div className="md:hidden space-y-3">
                            {sortedProducts.map((p, idx) => (
                                <div key={p.id} className="bg-[#1e2433] rounded-2xl border border-white/5 p-4 flex gap-4 items-center">
                                    <div className="cursor-grab active:cursor-grabbing text-slate-600"><GripVertical size={16}/></div>
                                    <img src={p.image_url || DEFAULT_IMG} className="w-12 h-12 rounded-xl object-contain bg-black/20" alt="" />
                                    <div className="flex-1">
                                        <div className="text-white font-bold text-sm tracking-tight">{p.name}</div>
                                        <div className="text-[10px] text-[#E2A049] font-black uppercase tracking-widest">{p.categories?.name}</div>
                                    </div>
                                    <button onClick={() => toggleStatus(p.id, 'prod', p.is_active)} className={`p-2 rounded-lg ${p.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                        {p.is_active ? <Check size={16}/> : <X size={16}/>}
                                    </button>
                                    <button onClick={() => openProductModal(p)} className="p-2 bg-white/5 text-slate-400 rounded-lg hover:text-[#E2A049]"><Pencil size={16}/></button>
                                </div>
                            ))}
                        </div>

                        <div className="hidden md:block bg-[#1e2433] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02]">
                                        <th className="w-10 py-4 px-6 border-b border-white/5"></th>
                                        <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5 cursor-pointer" onClick={() => toggleSortProd('index')}>Posicion</th>
                                        <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">Imagen</th>
                                        <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5 cursor-pointer" onClick={() => toggleSortProd('name')}>Producto</th>
                                        <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5 cursor-pointer" onClick={() => toggleSortProd('category')}>Categoría</th>
                                        <th className="text-left py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5 cursor-pointer" onClick={() => toggleSortProd('is_active')}>Estado</th>
                                        <th className="text-right py-4 px-6 text-slate-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProducts.map((p, idx) => (
                                        <tr key={p.id} className="border-t border-white/[0.03] hover:bg-white/[0.01] transition-colors group">
                                            <td className="py-4 px-6"><div className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-400 transition-colors" draggable onDragStart={() => onDragStart(idx)} onDragOver={(e) => onDragOver(e, idx)} onDrop={() => onDrop(idx, 'products')}><GripVertical size={16} /></div></td>
                                            <td className="py-4 px-6 text-slate-500 font-black text-xs opacity-50">#{p._idx + 1}</td>
                                            <td className="py-4 px-6"><img src={p.image_url || DEFAULT_IMG} className="w-10 h-10 rounded-lg object-contain bg-black/40 shadow-inner" alt="" /></td>
                                            <td className="py-4 px-6 text-white font-bold text-sm tracking-tight">{p.name}</td>
                                            <td className="py-4 px-6"><span className="bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">{p.categories?.name}</span></td>
                                            <td className="py-4 px-6">
                                                <button onClick={() => toggleStatus(p.id, 'prod', p.is_active)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${p.is_active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}>
                                                    {p.is_active ? 'Publicado' : 'Oculto'}
                                                </button>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button onClick={() => openProductModal(p)} className="p-2 text-slate-500 hover:text-[#E2A049] transition-colors"><Pencil size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {tab === 'categories' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedCategories.map((c, idx) => (
                            <div key={c.id} className="bg-[#1e2433] rounded-2xl border border-white/5 p-4 flex gap-4 items-center shadow-xl hover:border-[#E2A049]/20 transition-all group">
                                <div className="cursor-grab active:cursor-grabbing text-slate-600" draggable onDragStart={() => onDragStart(idx)} onDragOver={(e) => onDragOver(e, idx)} onDrop={() => onDrop(idx, 'categories')}><GripVertical size={16}/></div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-black text-lg truncate mb-1">{c.name}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Orden: {c.display_order}</div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => toggleStatus(c.id, 'cat', c.is_active)} className={`p-2 rounded-lg ${c.is_active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}>
                                        {c.is_active ? <Check size={16}/> : <X size={16}/>}
                                    </button>
                                    <button onClick={() => openCategoryModal(c)} className="p-2 bg-white/5 text-slate-400 rounded-lg hover:text-[#E2A049] hover:bg-white/10"><Pencil size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'gallery' && (
                    <div>
                         <div className="bg-[#1e2433] rounded-2xl border border-white/5 p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><ImageIcon size={32} /></div>
                                <div>
                                    <h3 className="text-white font-black text-lg tracking-tight">Imágenes en Nube</h3>
                                    <p className="text-slate-500 text-sm">Gestiona el banco de imágenes de productos</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => fetchGallery(true)} className="p-3 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all" title="Refrescar"><RefreshCw size={20} className={loadingGallery ? 'animate-spin' : ''}/></button>
                                <label className="bg-emerald-500 text-emerald-950 px-6 py-3 rounded-xl font-black text-sm cursor-pointer active:scale-95 transition-transform flex items-center gap-2 shadow-lg shadow-emerald-500/10">
                                    <PlusCircle size={18}/> Subir Imagen
                                    <input type="file" className="hidden" onChange={(e) => handleUpload(e, false)} />
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {galleryImages.map(img => {
                                const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(img.name);
                                return (
                                    <div key={img.id} className="bg-[#1e2433] rounded-xl border border-white/5 overflow-hidden shadow-lg group relative">
                                        <img src={publicUrl} className="w-full h-32 object-contain bg-black/40" alt="" />
                                        <div className="p-3 flex justify-between items-center bg-black/20">
                                            <span className="text-[9px] text-slate-500 font-bold truncate flex-1 pr-2">{img.name}</span>
                                            <button onClick={() => deleteFromGallery(img.name)} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS REFACTORED */}
            <Modal isOpen={modalCategory.isOpen} onClose={() => setModalCategory({ isOpen: false, data: null })} title={modalCategory.data?.id ? 'Editar Categoría' : 'Nueva Categoría'}>
                <form onSubmit={submitCategory} className="space-y-6 px-1">
                    <div>
                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Nombre Público</label>
                        <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-[#E2A049] transition-colors" value={modalCategory.data?.name || ''} onChange={e => setModalCategory({ ...modalCategory, data: { ...modalCategory.data, name: e.target.value } })} placeholder="Ej: Barriles 5 Litros" required />
                    </div>
                    <button type="submit" disabled={isPending} className="w-full py-4 bg-[#E2A049] text-black rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isPending ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>}
                        {isPending ? 'Guardando...' : 'Guardar Categoría'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={modalProduct.isOpen} onClose={() => setModalProduct({ isOpen: false, data: null, prices: [] })} title={modalProduct.data?.id ? 'Ficha de Producto' : 'Nuevo Producto'}>
                <form onSubmit={submitProduct} className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pr-3 scrollbar-thin scrollbar-thumb-white/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Denominación</label>
                            <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E2A049]" value={modalProduct.data?.name || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, name: e.target.value } })} required />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Clasificación</label>
                            <select className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E2A049] appearance-none" value={modalProduct.data?.category_id || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, category_id: e.target.value } })} required>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-6 bg-black/30 border border-white/5 rounded-2xl flex items-center gap-6">
                        <img src={modalProduct.data?.image_url || DEFAULT_IMG} className="w-20 h-20 rounded-2xl object-contain bg-black shadow-2xl border-2 border-white/5" alt="" />
                        <div className="flex flex-col gap-2">
                             <button type="button" onClick={() => { fetchGallery(false); setModalGallery({ isOpen: true, onSelect: (url) => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, image_url: url } }) }); }} className="text-sky-400 text-xs font-black uppercase flex items-center gap-2 hover:text-white transition-colors"><Layers size={14}/> Explorar Galería</button>
                             <div className="flex gap-4">
                                <label className="text-[#E2A049] text-[10px] font-black uppercase cursor-pointer hover:underline"><PlusCircle size={12} className="inline mr-1"/> Subir
                                    <input type="file" className="hidden" onChange={(e) => handleUpload(e, true)} />
                                </label>
                                <button type="button" onClick={() => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, image_url: '' } })} className="text-rose-500 text-[10px] font-black uppercase hover:underline">Eliminar</button>
                             </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Descripción Detallada</label>
                        <textarea className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E2A049] resize-none h-24" value={modalProduct.data?.description || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, description: e.target.value } })} />
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <h4 className="text-white text-xs font-black uppercase tracking-widest">Esquema de Precios</h4>
                            <button type="button" onClick={addPriceRow} className="text-[#E2A049] text-[10px] font-black uppercase hover:scale-105 transition-transform flex items-center gap-1"><PlusCircle size={12}/> Agregar Formato</button>
                        </div>
                        <div className="space-y-3">
                            {modalProduct.prices.map((p: any, i: number) => (
                                <div key={i} className="grid grid-cols-12 gap-2 bg-black/20 p-3 rounded-xl border border-white/5 items-center">
                                    <div className="col-span-3">
                                        <input className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-2 text-xs text-white" value={p.size} onChange={e => { const np = [...modalProduct.prices]; np[i].size = e.target.value; setModalProduct({ ...modalProduct, prices: np }) }} placeholder="5L" required />
                                    </div>
                                    <div className="col-span-4">
                                        <input className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-2 text-xs text-white" type="number" value={p.price} onChange={e => { const np = [...modalProduct.prices]; np[i].price = parseInt(e.target.value); setModalProduct({ ...modalProduct, prices: np }) }} placeholder="Costo" required />
                                    </div>
                                    <div className="col-span-4">
                                        <input className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-2 text-xs text-emerald-400 placeholder:text-slate-700" type="number" value={p.offer_price || ''} onChange={e => { const np = [...modalProduct.prices]; np[i].offer_price = e.target.value ? parseInt(e.target.value) : null; setModalProduct({ ...modalProduct, prices: np }) }} placeholder="Oferta" />
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <button type="button" onClick={() => removePriceRow(i)} className="text-rose-500 hover:text-rose-400 p-1"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={isPending} className="w-full py-4 mt-6 bg-[#E2A049] text-black rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isPending ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>}
                        {isPending ? 'Procesando...' : 'Guardar Ficha'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={modalGallery.isOpen} onClose={() => setModalGallery({ isOpen: false })} title="Banco de Imágenes">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] p-1 pr-3 scrollbar-thin scrollbar-thumb-white/10">
                    {galleryImages.map(img => {
                        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(img.name);
                        return (
                            <div key={img.id} className="relative group cursor-pointer" onClick={() => { if (modalGallery.onSelect) modalGallery.onSelect(publicUrl); setModalGallery({ isOpen: false }); }}>
                                <img src={publicUrl} className="w-full h-24 object-contain bg-black/40 rounded-xl border border-white/5 group-hover:border-sky-500 transition-all" alt="" />
                                <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/10 flex items-center justify-center transition-all">
                                    <Check className="text-sky-400 opacity-0 group-hover:opacity-100" size={24} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
}
