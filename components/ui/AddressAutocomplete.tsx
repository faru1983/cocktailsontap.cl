'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Pencil } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '@/lib/config';
import { loadGooglePlacesLibrary, type GooglePlacesLibrary } from '@/lib/googleMapsLoader';

export interface AddressSelectionDetails {
    address: string;
    comunaCandidates: string[];
    regionName: string | null;
}

interface AddressSuggestionItem {
    id: string;
    mainText: string;
    secondaryText: string;
    select: () => Promise<AddressSelectionDetails>;
}

interface AddressAutocompleteProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    onSelectAddressDetails?: (details: AddressSelectionDetails) => void;
    onManualModeChange?: (isManual: boolean) => void;
    onBlur?: () => void;
    comuna?: string;
    biasByComuna?: boolean;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

function extractStreetAddress(
    addressComponents: Array<{ longText?: string; shortText?: string; types: string[] }> | undefined,
    fallbackMainText: string,
    formattedAddress?: string
): string {
    if (addressComponents && addressComponents.length > 0) {
        const route = addressComponents.find((c) => c.types.includes('route'))?.longText?.trim();
        const streetNumber = addressComponents
            .find((c) => c.types.includes('street_number'))
            ?.longText?.trim();

        if (route && streetNumber) return `${route} ${streetNumber}`;
        if (route) return route;
    }

    if (fallbackMainText.trim()) return fallbackMainText.trim();
    return formattedAddress?.split(',')[0]?.trim() || '';
}

function extractAddressDetails(
    addressComponents: Array<{ longText?: string; shortText?: string; types: string[] }> | undefined,
    fallbackMainText: string,
    formattedAddress?: string,
    secondaryText?: string
): AddressSelectionDetails {
    const streetAddress = extractStreetAddress(addressComponents, fallbackMainText, formattedAddress);

    const getComp = (type: string) =>
        addressComponents?.find((c) => c.types.includes(type))?.longText?.trim() || null;

    const primaryComuna =
        getComp('administrative_area_level_3') ||
        getComp('locality') ||
        getComp('sublocality_level_1');

    const comunaCandidates = [
        getComp('administrative_area_level_3'),
        getComp('locality'),
        getComp('sublocality_level_1'),
        ...(secondaryText ? secondaryText.split(',').map((s) => s.trim()) : []),
    ].filter((v): v is string => Boolean(v));

    const regionName = getComp('administrative_area_level_1');

    // Construir dirección completa legible en una sola línea: "Calle 123, Comuna, Región"
    const parts: string[] = [];
    for (const part of [streetAddress, primaryComuna, regionName]) {
        if (!part) continue;
        const alreadyIncluded = parts.some(
            (existing) => existing.toLowerCase().includes(part.toLowerCase())
        );
        if (!alreadyIncluded) parts.push(part);
    }

    return {
        address: parts.join(', ') || streetAddress,
        comunaCandidates: Array.from(new Set(comunaCandidates)),
        regionName,
    };
}

export function AddressAutocomplete({
    id = 'field-address',
    value,
    onChange,
    onSelectAddressDetails,
    onManualModeChange,
    onBlur,
    comuna,
    biasByComuna = false,
    placeholder = 'Ej: Av. Providencia 1234',
    required = false,
    className = '',
}: AddressAutocompleteProps) {
    const hasGoogleKey = Boolean(GOOGLE_MAPS_API_KEY);
    const [manualMode, setManualMode] = useState(!hasGoogleKey);
    const [placesUnavailable, setPlacesUnavailable] = useState(!hasGoogleKey);
    const [suggestions, setSuggestions] = useState<AddressSuggestionItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Sub-campo opcional para depto/casa/referencia tras elegir dirección de Google
    const [baseStreet, setBaseStreet] = useState<string | null>(null);
    const [unitDetail, setUnitDetail] = useState('');

    const placesLibRef = useRef<GooglePlacesLibrary | null>(null);
    const sessionTokenRef = useRef<unknown>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const skipNextSearchRef = useRef(false);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const ensurePlacesReady = async () => {
        if (manualMode || placesUnavailable) return null;
        if (placesLibRef.current) return placesLibRef.current;

        const lib = await loadGooglePlacesLibrary();
        if (!lib?.AutocompleteSuggestion) {
            setPlacesUnavailable(true);
            setManualMode(true);
            onManualModeChange?.(true);
            return null;
        }
        placesLibRef.current = lib;
        if (!sessionTokenRef.current && lib.AutocompleteSessionToken) {
            sessionTokenRef.current = new lib.AutocompleteSessionToken();
        }
        return lib;
    };

    // Buscar sugerencias con debounce mientras escribe en modo Google
    useEffect(() => {
        if (manualMode || placesUnavailable || baseStreet !== null) {
            return;
        }
        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        const query = value.trim();
        if (query.length < 3) {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            const lib = await ensurePlacesReady();
            if (!lib || cancelled) return;

            setIsSearching(true);
            try {
                if (!sessionTokenRef.current && lib.AutocompleteSessionToken) {
                    sessionTokenRef.current = new lib.AutocompleteSessionToken();
                }

                const cleanComuna = biasByComuna ? (comuna || '').trim() : '';
                const searchInput =
                    cleanComuna &&
                    cleanComuna !== 'Otra' &&
                    !query.toLowerCase().includes(cleanComuna.toLowerCase())
                        ? `${query}, ${cleanComuna}`
                        : query;

                const response = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: searchInput,
                    includedRegionCodes: ['cl'],
                    language: 'es',
                    sessionToken: sessionTokenRef.current,
                });

                if (cancelled) return;

                const mapped: AddressSuggestionItem[] = (response.suggestions || [])
                    .map((s) => s.placePrediction)
                    .filter((p): p is NonNullable<typeof p> => Boolean(p))
                    .slice(0, 5)
                    .map((prediction) => {
                        const mainText =
                            prediction.mainText?.text ||
                            prediction.text?.text?.split(',')[0] ||
                            '';
                        const secondaryText = prediction.secondaryText?.text || '';

                        return {
                            id: prediction.placeId,
                            mainText,
                            secondaryText,
                            select: async () => {
                                const place = prediction.toPlace();
                                const { place: details } = await place.fetchFields({
                                    fields: ['formattedAddress', 'addressComponents'],
                                });
                                return extractAddressDetails(
                                    details.addressComponents,
                                    mainText,
                                    details.formattedAddress,
                                    secondaryText
                                );
                            },
                        };
                    });

                setSuggestions(mapped);
                setIsOpen(mapped.length > 0);
            } catch (err) {
                console.warn('[AddressAutocomplete] Error buscando sugerencias:', err);
                if (!cancelled) {
                    setSuggestions([]);
                    setIsOpen(false);
                }
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        }, 280);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, comuna, biasByComuna, manualMode, placesUnavailable]);

    const handleSelectSuggestion = async (item: AddressSuggestionItem) => {
        setIsOpen(false);
        setSuggestions([]);
        skipNextSearchRef.current = true;

        try {
            const details = await item.select();
            setBaseStreet(details.address);
            setUnitDetail('');
            onChange(details.address);
            onSelectAddressDetails?.(details);
            // Reiniciar token tras completar la sesión de autocomplete
            if (placesLibRef.current?.AutocompleteSessionToken) {
                sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
            } else {
                sessionTokenRef.current = null;
            }
        } catch {
            skipNextSearchRef.current = false;
        }
    };

    const handleUnitDetailChange = (detail: string) => {
        setUnitDetail(detail);
        if (!baseStreet) return;
        const trimmed = detail.trim();
        skipNextSearchRef.current = true;
        onChange(trimmed ? `${baseStreet}, ${trimmed}` : baseStreet);
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    required={required}
                    placeholder={
                        manualMode
                            ? 'Calle 123, Depto 456'
                            : placeholder
                    }
                    autoComplete={manualMode ? 'street-address' : 'off'}
                    aria-autocomplete={manualMode ? undefined : 'list'}
                    aria-expanded={manualMode ? undefined : isOpen}
                    className={`${className} ${!manualMode ? 'pr-9' : ''}`}
                    value={baseStreet !== null ? baseStreet : value}
                    onFocus={() => {
                        if (!manualMode && !placesUnavailable) {
                            void ensurePlacesReady();
                            if (suggestions.length > 0) setIsOpen(true);
                        }
                    }}
                    onChange={(e) => {
                        if (baseStreet !== null) {
                            setBaseStreet(null);
                            setUnitDetail('');
                        }
                        if (e.target.value.trim().length < 3) {
                            setSuggestions([]);
                            setIsOpen(false);
                        }
                        onChange(e.target.value);
                    }}
                    onBlur={onBlur}
                />
                {!manualMode && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                            <MapPin className="w-4 h-4" />
                        )}
                    </span>
                )}
            </div>

            {isOpen && suggestions.length > 0 && !manualMode && (
                <ul
                    role="listbox"
                    className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto"
                >
                    {suggestions.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => void handleSelectSuggestion(item)}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/60 transition-colors flex items-start gap-2.5 cursor-pointer"
                            >
                                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                        {item.mainText}
                                    </p>
                                    {item.secondaryText && (
                                        <p className="text-xs text-slate-500 truncate">
                                            {item.secondaryText}
                                        </p>
                                    )}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {baseStreet !== null && !manualMode && (
                <div className="mt-2">
                    <input
                        type="text"
                        value={unitDetail}
                        onChange={(e) => handleUnitDetailChange(e.target.value)}
                        onBlur={onBlur}
                        placeholder="Depto, casa, torre o referencia (opcional)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:border-primary focus:outline-none transition-colors"
                    />
                </div>
            )}

            {hasGoogleKey && !placesUnavailable && (
                <div className="mt-1.5 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            const nextManual = !manualMode;
                            setManualMode(nextManual);
                            onManualModeChange?.(nextManual);
                            setIsOpen(false);
                            setSuggestions([]);
                            setBaseStreet(null);
                            setUnitDetail('');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-primary transition-colors cursor-pointer"
                    >
                        {manualMode ? (
                            <>
                                <MapPin className="w-3 h-3" />
                                <span>Buscar dirección con Google</span>
                            </>
                        ) : (
                            <>
                                <Pencil className="w-3 h-3" />
                                <span>¿No encuentras tu dirección? Escríbela manualmente</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
