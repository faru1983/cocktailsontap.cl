'use client';

import { useState, useTransition, useEffect } from 'react';
import { saveCategory, toggleCategoryStatus, saveProduct, toggleProductStatus, reorderItems } from '@/app/actions/admin/productActions';
import Modal from '@/components/admin/Modal';
import { supabase } from '@/lib/supabase';
import { GripVertical } from 'lucide-react';

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
            alert('Para reordenar manualmente, asegúrate de estar en el "Orden Original" o "Número Interno"');
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

        // Update display_order locally (1-based)
        const reordered = list.map((item, i) => ({ ...item, display_order: i + 1 }));
        
        if (type === 'products') setIndexedProducts(reordered.map((it, i) => ({...it, _idx: i})));
        else setIndexedCategories(reordered.map((it, i) => ({...it, _idx: i})));

        // Sync to DB
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

    const fetchGallery = async () => {
        setLoadingGallery(true);
        const { data, error } = await supabase.storage.from('product-images').list('', { sortBy: { column: 'created_at', order: 'desc' } });
        if (data) setGalleryImages(data);
        setLoadingGallery(false);
    }

    const deleteFromGallery = async (name: string) => {
        if (!confirm('¿Eliminar esta imagen permanentemente de la nube?')) return;
        setLoadingGallery(true);
        await supabase.storage.from('product-images').remove([name]);
        await fetchGallery();
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
            alert('Error al subir imagen: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const formatPrice = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'Clp', minimumFractionDigits: 0 }).format(n);

    const inputStyle = { width: '100%', padding: '10px 14px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', marginBottom: '16px' };

    return (
        <div>
            <style>{`
                select option { background: #1e2433; color: #f1f5f9; }
                
                /* ── Header Styles (Same as Quotes) ── */
                .pp-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
                .pp-filters { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 18px; }
                .pp-filter-btn { padding: 6px 13px; border-radius: 20px; fontSize: 12.5px; fontWeight: 600; cursor: pointer; text-decoration: none; border: 1px solid rgba(255,255,255,0.08); transition: all 0.2s; }

                /* ── List Layouts ── */
                .pp-cards { display: flex; flex-direction: column; gap: 10px; }
                .desktop-only { display: none; }
                @media(min-width: 768px) {
                    .desktop-only { display: block; }
                    .pp-cards    { display: none; }
                }

                /* ── Table & Cards ── */
                .pp-table-wrap { background: #1e2433; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
                table { width: 100%; border-collapse: collapse; }
                th { padding: 14px 20px; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; cursor: pointer; user-select: none; border-bottom: 1px solid rgba(255,255,255,0.04); }
                th:hover { color: #E2A049; }
                td { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.04); color: #f1f5f9; font-size: 14px; }
                tr:hover { background: rgba(255,255,255,0.02); }

                .pp-card { 
                    background: #1e2433; border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px; 
                    display: flex; gap: 12px; align-items: center; transition: border-color 0.15s; cursor: grab;
                }
                .pp-card:hover { border-color: rgba(226,160,73,0.3); }
                .pp-card-img { width: 50px; height: 50px; border-radius: 10px; object-fit: contain; background: #0d1117; flex-shrink: 0; }
                
                .badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; user-select: none; }
                .badge-active { background: rgba(52,211,153,0.1); color: #34d399; }
                .badge-inactive { background: rgba(244,63,94,0.1); color: #f43f5e; }
                
                .action-btn { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 6px; color: #64748b; }
                .action-btn:hover { background: rgba(226,160,73,0.1); color: #E2A049; }

                /* Drag Effects */
                .dragging { opacity: 0.3; background: #E2A049 !important; }
                .drag-handle { cursor: grab; color: #475569; display: flex; align-items: center; }
                .drag-handle:active { cursor: grabbing; }
            `}</style>

            {/* ── Header ── */}
            <div className="pp-header">
                <div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 900, margin: '0 0 3px' }}>
                        {tab === 'products' ? 'Productos' : tab === 'categories' ? 'Categorías' : 'Galería de Fotos'}
                    </h1>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                        {tab === 'products' ? sortedProducts.length : tab === 'categories' ? sortedCategories.length : ''} registros
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {tab !== 'gallery' && (
                        <select 
                            className="mobile-only"
                            style={{ ...inputStyle, marginBottom: 0, padding: '8px 12px', fontSize: '13px', width: 'auto', background: '#1e2433' }}
                            onChange={(e) => {
                                const [key, dir] = e.target.value.split(':');
                                if (tab === 'products') setSortProd({ key, dir: dir as 'asc' | 'desc' });
                                else setSortCat({ key, dir: dir as 'asc' | 'desc' });
                            }}
                        >
                            <option value="index:asc">+ Orden Manual</option>
                            <option value="name:asc">Nombre A-Z</option>
                            <option value="name:desc">Nombre Z-A</option>
                            <option value="display_order:asc">Número Interno</option>
                        </select>
                    )}
                    {tab !== 'gallery' && (
                        <button 
                            onClick={() => tab === 'products' ? openProductModal() : openCategoryModal()}
                            style={{ background: '#E2A049', color: '#1a1a2e', border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>
                            + {tab === 'products' ? 'Nuevo' : 'Nueva'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Filters (Tabs) ── */}
            <div className="pp-filters">
                <button className="pp-filter-btn" onClick={() => setTab('products')} style={{ background: tab === 'products' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'products' ? '#1a1a2e' : '#64748b' }}>📦 Productos</button>
                <button className="pp-filter-btn" onClick={() => setTab('categories')} style={{ background: tab === 'categories' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'categories' ? '#1a1a2e' : '#64748b' }}>🏷️ Categorías</button>
                <button className="pp-filter-btn" onClick={() => setTab('gallery')} style={{ background: tab === 'gallery' ? '#E2A049' : 'rgba(255,255,255,0.05)', color: tab === 'gallery' ? '#1a1a2e' : '#64748b' }}>🖼️ Galería</button>
            </div>

            {/* ── Listing ── */}
            <div className={tab === 'gallery' ? '' : 'pp-table-wrap'}>
                {tab === 'products' ? (
                    <>
                        {/* Mobile View: Cards */}
                        <div className="pp-cards" style={{ padding: '0 4px' }}>
                            {sortedProducts.map((p, idx) => (
                                <div 
                                    key={p.id} 
                                    className={`pp-card ${dragIndex === idx ? 'dragging' : ''}`}
                                    draggable
                                    onDragStart={() => onDragStart(idx)}
                                    onDragOver={(e) => onDragOver(e, idx)}
                                    onDrop={() => onDrop(idx, 'products')}
                                >
                                    <div className="drag-handle"><GripVertical size={16} /></div>
                                    <img src={p.image_url || DEFAULT_IMG} className="pp-card-img" alt="" />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>{p.name}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.categories?.name} • {formatPrice(p.product_prices?.[0]?.price || 0)}</div>
                                    </div>
                                    <span onClick={(e) => { e.stopPropagation(); toggleStatus(p.id, 'prod', p.is_active); }} className={`badge ${p.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                        {p.is_active ? '✅' : '⚪'}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); openProductModal(p); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✏️</button>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View: Table with Drag handles */}
                        <div className="desktop-only">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th onClick={() => toggleSortProd('index')}># {sortProd.key === 'index' && (sortProd.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th>Imagen</th>
                                        <th onClick={() => toggleSortProd('name')}>Nombre {sortProd.key === 'name' && (sortProd.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th onClick={() => toggleSortProd('category')}>Categoría {sortProd.key === 'category' && (sortProd.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th onClick={() => toggleSortProd('price')}>Precio {sortProd.key === 'price' && (sortProd.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th onClick={() => toggleSortProd('is_active')}>Estado {sortProd.key === 'is_active' && (sortProd.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProducts.map((p, idx) => (
                                        <tr 
                                            key={p.id} 
                                            className={dragIndex === idx ? 'dragging' : ''}
                                            onDragOver={(e) => onDragOver(e, idx)}
                                            onDrop={() => onDrop(idx, 'products')}
                                        >
                                            <td>
                                                <div 
                                                    className="drag-handle" 
                                                    draggable 
                                                    onDragStart={() => onDragStart(idx)}
                                                >
                                                    <GripVertical size={16} />
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 800, color: '#64748b', opacity: 0.6 }}>{p._idx + 1}</td>
                                            <td><img src={p.image_url || DEFAULT_IMG} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain', background: '#0d1117' }} alt="" /></td>
                                            <td style={{ fontWeight: 700 }}>{p.name}</td>
                                            <td><span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>{p.categories?.name}</span></td>
                                            <td style={{ color: '#E2A049', fontWeight: 800 }}>{formatPrice(p.product_prices?.[0]?.price || 0)}</td>
                                            <td>
                                                <span onClick={() => toggleStatus(p.id, 'prod', p.is_active)} className={`badge ${p.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ cursor: 'pointer' }}>
                                                    {p.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={() => openProductModal(p)} className="action-btn">✏️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : tab === 'categories' ? (
                    <>
                        <div className="pp-cards" style={{ padding: '0 4px' }}>
                            {sortedCategories.map((c, idx) => (
                                <div 
                                    key={c.id} 
                                    className={`pp-card ${dragIndex === idx ? 'dragging' : ''}`}
                                    draggable
                                    onDragStart={() => onDragStart(idx)}
                                    onDragOver={(e) => onDragOver(e, idx)}
                                    onDrop={() => onDrop(idx, 'categories')}
                                >
                                    <div className="drag-handle"><GripVertical size={16} /></div>
                                    <div style={{ flex: 1, fontWeight: 700, color: '#f1f5f9' }}>{c.name}</div>
                                    <span onClick={(e) => { e.stopPropagation(); toggleStatus(c.id, 'cat', c.is_active); }} className={`badge ${c.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                        {c.is_active ? '✅' : '⚪'}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); openCategoryModal(c); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✏️</button>
                                </div>
                            ))}
                        </div>
                        <div className="desktop-only">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th onClick={() => toggleSortCat('index')}># {sortCat.key === 'index' && (sortCat.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th onClick={() => toggleSortCat('name')}>Nombre {sortCat.key === 'name' && (sortCat.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th onClick={() => toggleSortCat('is_active')}>Estado {sortCat.key === 'is_active' && (sortCat.dir === 'asc' ? '↑' : '↓')}</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCategories.map((c, idx) => (
                                        <tr 
                                            key={c.id} 
                                            className={dragIndex === idx ? 'dragging' : ''}
                                            onDragOver={(e) => onDragOver(e, idx)}
                                            onDrop={() => onDrop(idx, 'categories')}
                                        >
                                            <td>
                                                <div className="drag-handle" draggable onDragStart={() => onDragStart(idx)}><GripVertical size={16} /></div>
                                            </td>
                                            <td style={{ fontWeight: 800, color: '#64748b', opacity: 0.6 }}>{c._idx + 1}</td>
                                            <td style={{ fontWeight: 700 }}>{c.name}</td>
                                            <td>
                                                <span onClick={() => toggleStatus(c.id, 'cat', c.is_active)} className={`badge ${c.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ cursor: 'pointer' }}>
                                                    {c.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button onClick={() => openCategoryModal(c)} className="action-btn">✏️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    /* 📸 Galería Manager */
                    <div style={{ padding: '4px' }}>
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <h2 style={{ fontSize: '16px', margin: 0, color: '#f1f5f9' }}>Imágenes en Cloud</h2>
                            <label style={{ background: 'rgba(226,160,73,0.1)', color: '#E2A049', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(226,160,73,0.2)' }}>
                                + Subir Nueva
                                <input type="file" style={{ display: 'none' }} onChange={(e) => handleUpload(e, false)} />
                            </label>
                        </div>
                        {loadingGallery ? <p style={{ color: '#64748b' }}>Cargando galería...</p> : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
                                {galleryImages.map(img => {
                                    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(img.name);
                                    return (
                                        <div key={img.id} style={{ background: '#1e2433', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                            <img src={publicUrl} style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#0d1117' }} alt="" />
                                            <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</span>
                                                <button onClick={() => deleteFromGallery(img.name)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── MODALS ── */}
            <Modal isOpen={modalCategory.isOpen} onClose={() => setModalCategory({ isOpen: false, data: null })} title="Categoría">
                <form onSubmit={submitCategory}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Nombre</label>
                    <input style={inputStyle} value={modalCategory.data?.name || ''} onChange={e => setModalCategory({ ...modalCategory, data: { ...modalCategory.data, name: e.target.value } })} required />
                    <button type="submit" disabled={isPending} style={{ width: '100%', padding: '14px', background: '#E2A049', color: '#1a1a2e', border: 'none', borderRadius: '10px', fontWeight: 800 }}>{isPending ? '⏳ Guardando...' : 'Guardar'}</button>
                </form>
            </Modal>

            <Modal isOpen={modalProduct.isOpen} onClose={() => setModalProduct({ isOpen: false, data: null, prices: [] })} title="Producto">
                <form onSubmit={submitProduct}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Nombre</label>
                            <input style={inputStyle} value={modalProduct.data?.name || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, name: e.target.value } })} required />
                        </div>
                        <div style={{ flex: '1 1 120px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Categoría</label>
                            <select style={inputStyle} value={modalProduct.data?.category_id || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, category_id: e.target.value } })} required>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Imagen del Producto</label>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                        <img src={modalProduct.data?.image_url || DEFAULT_IMG} style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'contain', background: '#0d1117', border: '2px solid rgba(226,160,73,0.3)' }} alt="" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button type="button" onClick={() => { fetchGallery(); setModalGallery({ isOpen: true, onSelect: (url) => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, image_url: url } }) }); }} style={{ background: '#1e2433', color: '#E2A049', border: '1px solid #E2A049', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>🎞️ Galería</button>
                            <button type="button" onClick={() => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, image_url: '' } })} style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>🗑️ Quitar</button>
                        </div>
                    </div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>O subir nueva:</label>
                    <input type="file" accept="image/*" onChange={(e) => handleUpload(e, true)} style={{ ...inputStyle, padding: '8px' }} />

                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Descripción</label>
                    <textarea style={{ ...inputStyle, height: '80px', resize: 'none' }} value={modalProduct.data?.description || ''} onChange={e => setModalProduct({ ...modalProduct, data: { ...modalProduct.data, description: e.target.value } })} />

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#f1f5f9' }}>Precios</h4>
                            <button type="button" onClick={addPriceRow} style={{ color: '#E2A049', background: 'none', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>+ Añadir</button>
                        </div>
                        {modalProduct.prices.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ flex: '1 1 80px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Tamaño</label>
                                    <input style={{ ...inputStyle, marginBottom: 0 }} value={p.size} onChange={e => { const np = [...modalProduct.prices]; np[i].size = e.target.value; setModalProduct({ ...modalProduct, prices: np }) }} placeholder="5L" required />
                                </div>
                                <div style={{ flex: '1 1 100px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Normal ($)</label>
                                    <input style={{ ...inputStyle, marginBottom: 0 }} type="number" value={p.price} onChange={e => { const np = [...modalProduct.prices]; np[i].price = parseInt(e.target.value); setModalProduct({ ...modalProduct, prices: np }) }} placeholder="0" required />
                                </div>
                                <div style={{ flex: '1 1 100px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Oferta ($)</label>
                                    <input style={{ ...inputStyle, marginBottom: 0 }} type="number" value={p.offer_price || ''} onChange={e => { const np = [...modalProduct.prices]; np[i].offer_price = e.target.value ? parseInt(e.target.value) : null; setModalProduct({ ...modalProduct, prices: np }) }} placeholder="Opcional" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="button" onClick={() => removePriceRow(i)} style={{ color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer', height: '40px', padding: '0 5px' }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button type="submit" disabled={isPending} style={{ width: '100%', padding: '14px', background: '#E2A049', color: '#1a1a2e', border: 'none', borderRadius: '10px', fontWeight: 800, marginTop: '20px' }}>{isPending ? '⏳ Guardando...' : 'Guardar Producto'}</button>
                </form>
            </Modal>

            <Modal isOpen={modalGallery.isOpen} onClose={() => setModalGallery({ isOpen: false })} title="Galería de Fotos">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                    {loadingGallery ? <p>...</p> : galleryImages.map(img => {
                        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(img.name);
                        return (
                            <img key={img.id} src={publicUrl} onClick={() => { if (modalGallery.onSelect) modalGallery.onSelect(publicUrl); setModalGallery({ isOpen: false }); }} style={{ width: '100%', height: '110px', objectFit: 'contain', background: '#0d1117', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }} alt="" />
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
}
