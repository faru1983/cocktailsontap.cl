import React from 'react';
import { 
    Cake, 
    Heart, 
    Baby, 
    Briefcase, 
    GlassWater, 
    Wine, 
    Beer, 
    PartyPopper, 
    Music, 
    Mic2, 
    Star, 
    Smile, 
    Camera, 
    Laptop, 
    Users, 
    Trophy, 
    Gift, 
    Coffee, 
    Plus,
    Infinity,
    type LucideIcon 
} from 'lucide-react';

// Catálogo oficial de 20 iconos para selección visual
export const ICON_CATALOG = [
    { id: 'cake', component: Cake, name: 'Cumpleaños' },
    { id: 'heart', component: Heart, name: 'Amor / Boda' },
    { id: 'infinity', component: Infinity, name: 'Aniversario' },
    { id: 'baby', component: Baby, name: 'Baby Shower' },
    { id: 'briefcase', component: Briefcase, name: 'Empresarial' },
    { id: 'cheers', component: GlassWater, name: 'Brindis' },
    { id: 'wine', component: Wine, name: 'Vinos' },
    { id: 'beer', component: Beer, name: 'Cerveza' },
    { id: 'party', component: PartyPopper, name: 'Fiesta' },
    { id: 'music', component: Music, name: 'DJ / Música' },
    { id: 'mic', component: Mic2, name: 'Karaoke' },
    { id: 'star', component: Star, name: 'VIP / Especial' },
    { id: 'smile', component: Smile, name: 'Casual' },
    { id: 'camera', component: Camera, name: 'Social' },
    { id: 'laptop', component: Laptop, name: 'Taller / Trabajo' },
    { id: 'users', component: Users, name: 'Comunidad' },
    { id: 'trophy', component: Trophy, name: 'Premios' },
    { id: 'gift', component: Gift, name: 'Regalo' },
    { id: 'coffee', component: Coffee, name: 'Coffee Break' },
    { id: 'plus', component: Plus, name: 'Otro' },
];

// Mapeo para facilitar la búsqueda en el catálogo
export const ICON_MAP: Record<string, LucideIcon> = {
    ...Object.fromEntries(ICON_CATALOG.map(item => [item.id, item.component]))
};

export function renderIconFromKey(iconKey: string, size: number = 24, className?: string) {
    if (!iconKey) return null;
    const key = iconKey.toLowerCase().trim();
    
    // 1. PRIORIDAD: ¿Está en nuestro catálogo oficial? (cake, wine, party, etc.)
    if (ICON_MAP[key]) {
        const IconComponent = ICON_MAP[key];
        return <IconComponent size={size} className={className} />;
    }

    // 2. SECUNDARIO: Si no está en el mapa pero es muy corto, lo tratamos como Emoji (ej: 🥂)
    if (key.length <= 4) {
        return <span style={{ fontSize: `${size}px` }} className={className}>{iconKey}</span>;
    }

    // 3. FALLBACK: Si no lo conocemos, mostramos el símbolo +
    return <Plus size={size} className={className} />;
}
