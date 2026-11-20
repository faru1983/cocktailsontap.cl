'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateDraftQuote } from '@/app/actions/updateDraftQuote';
import type { UpdateDraftQuoteResult } from '@/lib/services/updateDraftQuoteCore';
import type { UpdateDraftQuoteInput } from '@/lib/types';

export type DraftSaveStatus =
    | 'idle'
    | 'pending'
    | 'saving'
    | 'saved'
    | 'empty_items'
    | 'error';

interface UseDraftQuoteAutoSaveOptions {
    enabled: boolean;
    payload: UpdateDraftQuoteInput;
    onSaved?: (res: UpdateDraftQuoteResult) => void;
    onNotDraft?: () => void;
}

const IMMEDIATE_DELAY_MS = 300;
const TYPING_DELAY_MS = 700;

function serializeImmediatePart(p: UpdateDraftQuoteInput): string {
    return JSON.stringify({
        dispenser: p.dispenser,
        region_name: p.region_name ?? '',
        comuna_name: p.comuna_name ?? '',
        comuna_other: p.comuna_other ?? '',
        event_type_id: p.event_type_id ?? '',
        event_date: p.event_date ?? '',
        start_time: p.start_time ?? '',
        pickup_date: p.pickup_date ?? '',
        pickup_time: p.pickup_time ?? '',
        // Excluir `id` temporal para que sincronizar UUIDs reales no dispare un segundo guardado
        items: p.items.map((i) => ({
            product_id: i.product_id ?? null,
            size: i.size,
            quantity: i.quantity,
        })),
    });
}

function serializeTypingPart(p: UpdateDraftQuoteInput): string {
    return JSON.stringify({
        client_name: p.client_name ?? '',
        client_lastname: p.client_lastname ?? '',
        client_email: p.client_email ?? '',
        client_phone: p.client_phone ?? '',
        client_address: p.client_address ?? '',
        guests: p.guests ?? 0,
        event_type_other: p.event_type_other ?? '',
        comments: p.comments ?? '',
    });
}

export function useDraftQuoteAutoSave({
    enabled,
    payload,
    onSaved,
    onNotDraft,
}: UseDraftQuoteAutoSaveOptions) {
    const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);

    const immediateKey = useMemo(() => serializeImmediatePart(payload), [payload]);
    const typingKey = useMemo(() => serializeTypingPart(payload), [payload]);
    const fingerprint = `${immediateKey}||${typingKey}`;

    const latestPayloadRef = useRef<UpdateDraftQuoteInput>(payload);
    const latestFingerprintRef = useRef<string>(fingerprint);
    const lastSavedFingerprintRef = useRef<string>(fingerprint);
    const prevImmediateKeyRef = useRef<string>(immediateKey);
    const hasMountedRef = useRef<boolean>(false);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = useRef<Promise<boolean> | null>(null);
    const onSavedRef = useRef(onSaved);
    const onNotDraftRef = useRef(onNotDraft);
    const enabledRef = useRef(enabled);

    onSavedRef.current = onSaved;
    onNotDraftRef.current = onNotDraft;
    enabledRef.current = enabled;
    latestPayloadRef.current = payload;
    latestFingerprintRef.current = fingerprint;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const executeSaveLoop = useCallback(async (): Promise<boolean> => {
        if (!enabledRef.current) return true;

        // Si ya hay un guardado corriendo, esperar a que termine el ciclo actual
        if (inFlightRef.current) {
            return inFlightRef.current;
        }

        const run = (async (): Promise<boolean> => {
            while (enabledRef.current) {
                const targetPayload = latestPayloadRef.current;
                const targetFingerprint = latestFingerprintRef.current;

                if (targetFingerprint === lastSavedFingerprintRef.current) {
                    return true;
                }

                if (targetPayload.items.length === 0) {
                    setSaveStatus('empty_items');
                    setSaveError(null);
                    return false;
                }

                setSaveStatus('saving');
                setSaveError(null);

                let res: UpdateDraftQuoteResult;
                try {
                    res = await updateDraftQuote(targetPayload);
                } catch {
                    setSaveStatus('error');
                    setSaveError('Sin conexión. No se pudieron guardar los cambios.');
                    return false;
                }

                if (!res.success) {
                    if (res.code === 'NOT_DRAFT') {
                        setSaveStatus('error');
                        setSaveError(res.error || 'Esta cotización ya no puede editarse.');
                        onNotDraftRef.current?.();
                        return false;
                    }
                    if (res.code === 'EMPTY_ITEMS') {
                        setSaveStatus('empty_items');
                        setSaveError(null);
                        return false;
                    }
                    setSaveStatus('error');
                    setSaveError(res.error || 'Error al guardar los cambios.');
                    return false;
                }

                lastSavedFingerprintRef.current = targetFingerprint;

                // Solo sincronizar respuesta con el estado local si el usuario no hizo nuevos cambios mientras guardaba
                if (latestFingerprintRef.current === targetFingerprint) {
                    onSavedRef.current?.(res);
                    setSaveStatus('saved');
                    setSaveError(null);
                    return true;
                }
                // Si hubo nuevos cambios durante el vuelo, el while continúa con el último snapshot
            }
            return true;
        })();

        inFlightRef.current = run;
        try {
            return await run;
        } finally {
            inFlightRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            clearTimer();
            return;
        }

        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            lastSavedFingerprintRef.current = fingerprint;
            prevImmediateKeyRef.current = immediateKey;
            return;
        }

        if (payload.items.length === 0) {
            clearTimer();
            setSaveStatus('empty_items');
            setSaveError(null);
            prevImmediateKeyRef.current = immediateKey;
            return;
        }

        if (fingerprint === lastSavedFingerprintRef.current) {
            prevImmediateKeyRef.current = immediateKey;
            return;
        }

        const isImmediateChange = immediateKey !== prevImmediateKeyRef.current;
        prevImmediateKeyRef.current = immediateKey;

        clearTimer();
        setSaveStatus((prev) => (prev === 'saving' ? 'saving' : 'pending'));
        setSaveError(null);

        const delay = isImmediateChange ? IMMEDIATE_DELAY_MS : TYPING_DELAY_MS;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void executeSaveLoop();
        }, delay);
    }, [enabled, fingerprint, immediateKey, payload.items.length, clearTimer, executeSaveLoop]);

    useEffect(() => {
        return () => {
            clearTimer();
        };
    }, [clearTimer]);

    // Aviso si el usuario intenta cerrar/recargar mientras hay un guardado en curso o pendiente
    useEffect(() => {
        if (!enabled) return;
        const hasUnsaved = saveStatus === 'pending' || saveStatus === 'saving';
        if (!hasUnsaved) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [enabled, saveStatus]);

    const flushNow = useCallback(async (): Promise<boolean> => {
        if (!enabledRef.current) return true;
        clearTimer();
        if (inFlightRef.current) {
            await inFlightRef.current;
        }
        if (latestFingerprintRef.current === lastSavedFingerprintRef.current) {
            return true;
        }
        return executeSaveLoop();
    }, [clearTimer, executeSaveLoop]);

    const flushOnBlur = useCallback(() => {
        if (!enabledRef.current) return;
        if (timerRef.current && latestPayloadRef.current.items.length > 0) {
            clearTimer();
            void executeSaveLoop();
        }
    }, [clearTimer, executeSaveLoop]);

    return {
        saveStatus,
        saveError,
        flushNow,
        flushOnBlur,
    };
}
