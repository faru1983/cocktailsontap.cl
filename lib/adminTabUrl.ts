export function parseAdminTab<T extends string>(
    value: string | null | undefined,
    ids: readonly T[],
    fallback: T
): T {
    return ids.includes(value as T) ? (value as T) : fallback;
}

export function adminTabHref(
    pathname: string,
    tab: string,
    defaultTab: string,
    extra?: Record<string, string | undefined>
): string {
    const params = new URLSearchParams();
    if (extra) {
        for (const [key, value] of Object.entries(extra)) {
            if (value) params.set(key, value);
        }
    }
    if (tab !== defaultTab) params.set('tab', tab);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
}

export function replaceAdminTab(tab: string, defaultTab: string) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (tab === defaultTab) url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

export function isUnmodifiedLeftClick(e: {
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
}) {
    return !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0;
}
