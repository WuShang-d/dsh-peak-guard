import z from '@deepseek-ai/schemastery';
import { type DeepSeekPeakConfig } from './constants.js';
export declare const SETTINGS_NAMESPACE = "peak-guard";
export declare const PEAK_GUARD_MODES: readonly ["off", "warn-only", "require-confirmation", "defer-to-off-peak"];
export type PeakGuardMode = typeof PEAK_GUARD_MODES[number];
export declare const LOCALES: readonly ["zh", "en"];
export type PeakGuardLocale = typeof LOCALES[number];
export interface ProviderMatchingConfig {
    providerIds: string[];
    baseURLHosts: string[];
    modelIds: string[];
}
export interface PeakGuardSettings {
    enabled: boolean;
    mode: PeakGuardMode;
    showRemainingPeakTime: boolean;
    allowSessionBypass: boolean;
    locale: PeakGuardLocale;
    debug: boolean;
    peak: DeepSeekPeakConfig;
    providerMatching: ProviderMatchingConfig;
}
export declare const DEFAULT_PEAK_GUARD_SETTINGS: PeakGuardSettings;
export declare const SettingsSchema: z<PeakGuardSettings>;
export declare const Config: z<PeakGuardSettings>;
export declare function normalizeSettings(input: Partial<PeakGuardSettings> | undefined): PeakGuardSettings;
//# sourceMappingURL=settings.d.ts.map