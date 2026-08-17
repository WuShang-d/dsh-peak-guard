import { Config, type PeakGuardSettings } from './settings.js';
import type { DshContextLike } from './dsh-types.js';
export declare const name = "dsh-peak-guard";
export declare const inject: string[];
export { Config };
export { DEFAULT_DEEPSEEK_PEAK_CONFIG, DEFAULT_DEEPSEEK_BASE_URL_HOSTS, DEFAULT_DEEPSEEK_MODEL_IDS, DEFAULT_DEEPSEEK_PROVIDER_IDS, } from './constants.js';
export type { DeepSeekPeakConfig, PeakPeriodConfig } from './constants.js';
export { getMinutesUntilOffPeak, getNextOffPeakTime, getPeakPeriod, getPeakStatus, getZonedClockMinutes, getZonedTimeLabel, isPeakTime, } from './peak-hours.js';
export { detectDeepSeekProvider, isDeepSeekProvider, } from './provider.js';
export type { ProviderDetectionInput, ProviderDetectionResult, } from './provider.js';
export { DEFAULT_PEAK_GUARD_SETTINGS, PEAK_GUARD_MODES, SETTINGS_NAMESPACE, SettingsSchema, } from './settings.js';
export type { PeakGuardLocale, PeakGuardMode, PeakGuardSettings, ProviderMatchingConfig, } from './settings.js';
export { PeakGuardController, } from './guard.js';
export type { PeakGuardControllerOptions, PeakGuardRuntime, } from './guard.js';
export declare function apply(ctx: DshContextLike, config?: Partial<PeakGuardSettings>): void;
//# sourceMappingURL=index.d.ts.map