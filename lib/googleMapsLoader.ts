import { GOOGLE_MAPS_API_KEY } from '@/lib/config';

export interface GooglePlacesLibrary {
    AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (request: {
            input: string;
            includedRegionCodes?: string[];
            language?: string;
            sessionToken?: unknown;
        }) => Promise<{
            suggestions: Array<{
                placePrediction?: {
                    placeId: string;
                    text?: { text?: string };
                    mainText?: { text?: string };
                    secondaryText?: { text?: string };
                    toPlace: () => {
                        fetchFields: (opts: { fields: string[] }) => Promise<{
                            place: {
                                formattedAddress?: string;
                                addressComponents?: Array<{
                                    longText?: string;
                                    shortText?: string;
                                    types: string[];
                                }>;
                            };
                        }>;
                    };
                };
            }>;
        }>;
    };
    AutocompleteSessionToken: new () => unknown;
}

type GoogleMapsGlobal = {
    maps?: {
        importLibrary?: (name: string) => Promise<unknown>;
    };
};

let loaderPromise: Promise<GooglePlacesLibrary | null> | null = null;

/**
 * Carga bajo demanda la librería `places` de Google Maps JavaScript API.
 * Devuelve `null` si no hay API Key configurada o si falla la carga (permite fallback manual).
 */
export function loadGooglePlacesLibrary(): Promise<GooglePlacesLibrary | null> {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (!GOOGLE_MAPS_API_KEY) return Promise.resolve(null);

    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise<GooglePlacesLibrary | null>((resolve) => {
        const win = window as unknown as { google?: GoogleMapsGlobal };

        const resolvePlaces = () => {
            const importLib = win.google?.maps?.importLibrary;
            if (!importLib) {
                console.warn('[GoogleMapsLoader] google.maps.importLibrary no disponible');
                loaderPromise = null;
                resolve(null);
                return;
            }
            importLib('places')
                .then((lib) => resolve(lib as GooglePlacesLibrary))
                .catch((err) => {
                    console.warn('[GoogleMapsLoader] Error cargando librería places:', err);
                    loaderPromise = null;
                    resolve(null);
                });
        };

        if (win.google?.maps?.importLibrary) {
            resolvePlaces();
            return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>(
            'script[data-google-maps-loader="true"]'
        );
        if (existingScript) {
            existingScript.addEventListener('load', resolvePlaces, { once: true });
            existingScript.addEventListener('error', () => {
                loaderPromise = null;
                resolve(null);
            }, { once: true });
            return;
        }

        const callbackName = '__cotGoogleMapsReady';
        (window as unknown as Record<string, unknown>)[callbackName] = resolvePlaces;

        const script = document.createElement('script');
        script.dataset.googleMapsLoader = 'true';
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
            GOOGLE_MAPS_API_KEY
        )}&libraries=places&language=es&region=CL&loading=async&callback=${callbackName}`;
        script.onerror = () => {
            console.warn('[GoogleMapsLoader] Error descargando script de Google Maps');
            loaderPromise = null;
            resolve(null);
        };
        document.head.appendChild(script);
    });

    return loaderPromise;
}
