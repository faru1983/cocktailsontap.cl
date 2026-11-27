export type GlasswareType = 'reusable' | 'disposable_pet';

export interface GlasswareOption {
    id: GlasswareType;
    title: string;
    badge: string;
    shortLabel: string;
    capacityNote: string;
    summary: string;
    highlights: string[];
    conditionNote: string;
    images: { src: string; alt: string; label?: string }[];
}

export const GLASSWARE_OPTIONS: readonly GlasswareOption[] = [
    {
        id: 'disposable_pet',
        title: 'Vasos PET',
        badge: 'Desechables · Incluido ($0)',
        shortLabel: 'Vasos PET 360 ml (desechables)',
        capacityNote: 'Vasos PET gruesos y firmes de 360 ml (12 oz)',
        summary: 'Plástico PET grueso y firme de 360 ml con nuestro logo. Sin devolución al terminar.',
        highlights: [
            'Capacidad de 360 ml (12 oz), gruesos y transparentes',
            'Con diseño oficial Cocktails on Tap',
            'Sin devolución: cero preocupaciones al terminar el evento',
        ],
        conditionNote:
            'Son desechables y no se devuelven al finalizar tu celebración (sin cobros por faltantes).',
        images: [
            {
                src: '/assets/glassware/vaso-pet-360ml.webp',
                alt: 'Vaso desechable PET de 360 ml con logo Cocktails on Tap',
                label: 'Vaso PET 360 ml',
            },
        ],
    },
    {
        id: 'reusable',
        title: 'Vasos y Copas Reutilizables',
        badge: 'En préstamo · Incluido ($0)',
        shortLabel: 'Vasos y Copas Reutilizables (en préstamo)',
        capacityNote: 'Copas de 480 ml y vasos de 450 ml',
        summary: 'Plástico rígido de alta gama, firmes, irrompibles y con logo Cocktails on Tap.',
        highlights: [
            'Vasos reutilizables de 450 ml y copas de 480 ml',
            'Las copas se prestan exclusivamente para cócteles tipo Spritz (como Aperol Spritz, Ramazzotti Spritz y Tropical Gin)',
            'Look elegante de bar e irrompibles (seguros para pista o piscina)',
        ],
        conditionNote:
            'Se entregan en préstamo y se retiran con el equipo. En caso de faltante o daño: $1.000 por vaso y $2.000 por copa.',
        images: [
            {
                src: '/assets/glassware/copa-reutilizable-480ml.webp',
                alt: 'Copa reutilizable de 480 ml con logo Cocktails on Tap',
                label: 'Copa 480 ml · Solo Spritz',
            },
            {
                src: '/assets/glassware/vaso-reutilizable-450ml.webp',
                alt: 'Vaso reutilizable de 450 ml con logo Cocktails on Tap',
                label: 'Vaso 450 ml',
            },
        ],
    },
] as const;

export function isGlasswareType(value: unknown): value is GlasswareType {
    return value === 'reusable' || value === 'disposable_pet';
}

export function formatGlasswareLabel(type?: string | null): string {
    if (type === 'reusable') return 'Vasos y Copas Reutilizables (en préstamo)';
    if (type === 'disposable_pet') return 'Vasos PET 360 ml (desechables)';
    return '';
}

export function formatGlasswareShortLabel(type?: string | null): string {
    if (type === 'reusable') return 'Reutilizables (préstamo)';
    if (type === 'disposable_pet') return 'Vasos PET (desechables)';
    return '';
}
