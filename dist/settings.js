import z from '@deepseek-ai/schemastery';
import { DEFAULT_DEEPSEEK_BASE_URL_HOSTS, DEFAULT_DEEPSEEK_MODEL_IDS, DEFAULT_DEEPSEEK_PEAK_CONFIG, DEFAULT_DEEPSEEK_PROVIDER_IDS, } from './constants.js';
export const SETTINGS_NAMESPACE = 'peak-guard';
export const PEAK_GUARD_MODES = [
    'off',
    'warn-only',
    'require-confirmation',
    'defer-to-off-peak',
];
export const LOCALES = ['zh', 'en'];
export const DEFAULT_PEAK_GUARD_SETTINGS = {
    enabled: true,
    mode: 'require-confirmation',
    showRemainingPeakTime: true,
    allowSessionBypass: true,
    locale: 'zh',
    debug: false,
    peak: {
        timezone: DEFAULT_DEEPSEEK_PEAK_CONFIG.timezone,
        periods: DEFAULT_DEEPSEEK_PEAK_CONFIG.periods.map(period => ({ ...period })),
    },
    providerMatching: {
        providerIds: [...DEFAULT_DEEPSEEK_PROVIDER_IDS],
        baseURLHosts: [...DEFAULT_DEEPSEEK_BASE_URL_HOSTS],
        modelIds: [...DEFAULT_DEEPSEEK_MODEL_IDS],
    },
};
const peakPeriodSchema = z.object({
    start: z.string().required(),
    end: z.string().required(),
});
const peakSchema = z.object({
    timezone: z.string().default(DEFAULT_DEEPSEEK_PEAK_CONFIG.timezone),
    periods: z.array(peakPeriodSchema).default(DEFAULT_DEEPSEEK_PEAK_CONFIG.periods.map(period => ({ ...period }))),
});
const providerMatchingSchema = z.object({
    providerIds: z.array(z.string()).default([...DEFAULT_DEEPSEEK_PROVIDER_IDS]),
    baseURLHosts: z.array(z.string()).default([...DEFAULT_DEEPSEEK_BASE_URL_HOSTS]),
    modelIds: z.array(z.string()).default([...DEFAULT_DEEPSEEK_MODEL_IDS]),
});
export const SettingsSchema = z.object({
    enabled: z.boolean().default(DEFAULT_PEAK_GUARD_SETTINGS.enabled),
    mode: z.union(PEAK_GUARD_MODES).default(DEFAULT_PEAK_GUARD_SETTINGS.mode),
    showRemainingPeakTime: z.boolean().default(DEFAULT_PEAK_GUARD_SETTINGS.showRemainingPeakTime),
    allowSessionBypass: z.boolean().default(DEFAULT_PEAK_GUARD_SETTINGS.allowSessionBypass),
    locale: z.union(LOCALES).default(DEFAULT_PEAK_GUARD_SETTINGS.locale),
    debug: z.boolean().default(DEFAULT_PEAK_GUARD_SETTINGS.debug),
    peak: peakSchema.default(DEFAULT_PEAK_GUARD_SETTINGS.peak),
    providerMatching: providerMatchingSchema.default(DEFAULT_PEAK_GUARD_SETTINGS.providerMatching),
});
export const Config = SettingsSchema;
export function normalizeSettings(input) {
    const raw = input ?? {};
    return {
        ...DEFAULT_PEAK_GUARD_SETTINGS,
        ...raw,
        peak: {
            ...DEFAULT_PEAK_GUARD_SETTINGS.peak,
            ...raw.peak,
            periods: raw.peak?.periods?.map(period => ({ ...period }))
                ?? DEFAULT_PEAK_GUARD_SETTINGS.peak.periods.map(period => ({ ...period })),
        },
        providerMatching: {
            ...DEFAULT_PEAK_GUARD_SETTINGS.providerMatching,
            ...raw.providerMatching,
            providerIds: raw.providerMatching?.providerIds ?? [...DEFAULT_PEAK_GUARD_SETTINGS.providerMatching.providerIds],
            baseURLHosts: raw.providerMatching?.baseURLHosts ?? [...DEFAULT_PEAK_GUARD_SETTINGS.providerMatching.baseURLHosts],
            modelIds: raw.providerMatching?.modelIds ?? [...DEFAULT_PEAK_GUARD_SETTINGS.providerMatching.modelIds],
        },
    };
}
//# sourceMappingURL=settings.js.map