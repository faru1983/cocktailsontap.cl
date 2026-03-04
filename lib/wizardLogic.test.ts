import { describe, it, expect } from 'vitest';
import { calculateSmartConfig, getSizeLiters, formatEventDate } from './wizardLogic';
import type { WizardState } from './types';

describe('wizardLogic', () => {
    describe('calculateSmartConfig', () => {
        it('should return 10L for small amounts (<= 10L)', () => {
            const result = calculateSmartConfig(40); // 40/5 = 8L
            expect(result.liters).toBe(10);
            expect(result.config).toBe('1 Barril de 10L');
        });

        it('should return 3x5L for amounts between 10L and 15L', () => {
            const result = calculateSmartConfig(60); // 60/5 = 12L
            expect(result.liters).toBe(15);
            expect(result.config).toBe('3 Barriles de 5L');
        });

        it('should return 2x10L for amounts between 15L and 20L', () => {
            const result = calculateSmartConfig(90); // 90/5 = 18L
            expect(result.liters).toBe(20);
            expect(result.config).toBe('2 Barriles de 10L');
        });

        it('should handle exactly 20L', () => {
            const result = calculateSmartConfig(100); // 100/5 = 20L
            expect(result.liters).toBe(20);
            expect(result.config).toBe('2 Barriles de 10L');
        });

        it('should handle large amounts above 30L accurately', () => {
            const result = calculateSmartConfig(200); // 200/5 = 40L
            expect(result.liters).toBe(40);
            expect(result.config).toBe('4 Barriles de 10L');
        });
    });

    describe('getSizeLiters', () => {
        it('should return the correct volume for standard size strings', () => {
            expect(getSizeLiters('Barril 30L')).toBe(30);
            expect(getSizeLiters('10L - Medio Barril')).toBe(10);
            expect(getSizeLiters('5.5L')).toBe(5); // includes 5L
        });
    });

    describe('formatEventDate', () => {
        it('should format a valid date string as Chilean long format', () => {
            // "2026-12-25" -> Viernes, 25 de diciembre de 2026
            const result = formatEventDate('2026-12-25');
            expect(result).toContain('25 de diciembre de 2026');
        });

        it('should return "No especificada" for empty date', () => {
            expect(formatEventDate('')).toBe('No especificada');
        });
    });
});
