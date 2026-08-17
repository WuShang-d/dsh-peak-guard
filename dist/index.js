import { PeakGuardController } from './guard.js';
import { askPeakGuardConfirmation } from './ui.js';
import { Config, DEFAULT_PEAK_GUARD_SETTINGS, SETTINGS_NAMESPACE, SettingsSchema, normalizeSettings, } from './settings.js';
export const name = 'dsh-peak-guard';
export const inject = ['settings', 'userQuestions', 'connection'];
export { Config };
export { DEFAULT_DEEPSEEK_PEAK_CONFIG, DEFAULT_DEEPSEEK_BASE_URL_HOSTS, DEFAULT_DEEPSEEK_MODEL_IDS, DEFAULT_DEEPSEEK_PROVIDER_IDS, } from './constants.js';
export { getMinutesUntilOffPeak, getNextOffPeakTime, getPeakPeriod, getPeakStatus, getZonedClockMinutes, getZonedTimeLabel, isPeakTime, } from './peak-hours.js';
export { detectDeepSeekProvider, isDeepSeekProvider, } from './provider.js';
export { DEFAULT_PEAK_GUARD_SETTINGS, PEAK_GUARD_MODES, SETTINGS_NAMESPACE, SettingsSchema, } from './settings.js';
export { PeakGuardController, } from './guard.js';
const CLIENT_RPC_CHANNEL = '/peak-guard';
function service(ctx, key) {
    const fromGetter = ctx.get?.(key);
    if (fromGetter !== undefined)
        return fromGetter;
    return ctx[key];
}
function notifyIfAvailable(ctx, logger) {
    return async (message) => {
        const notifications = service(ctx, 'notifications');
        const toast = service(ctx, 'toast');
        const candidate = notifications ?? toast;
        const warn = candidate?.warn ?? candidate?.warning ?? candidate?.show;
        if (typeof warn === 'function') {
            await warn.call(candidate, message);
            return;
        }
        logger?.warn?.(`[PeakGuard] ${message}`);
    };
}
function registerClientRpc(ctx, settings, logger) {
    const rpc = service(ctx, 'connection')?.rpc;
    if (rpc?.handle === undefined) {
        logger?.warn?.('[PeakGuard] ctx.connection.rpc is unavailable; browser indicator cannot read settings');
        return;
    }
    rpc.handle(CLIENT_RPC_CHANNEL, (endpoint) => {
        if (endpoint !== 'get') {
            return {
                ok: false,
                error: {
                    code: 'not-found',
                    message: `unknown endpoint "${endpoint}"`,
                    details: {},
                },
            };
        }
        const current = settings();
        return {
            ok: true,
            value: {
                enabled: current.enabled,
                mode: current.mode,
                showRemainingPeakTime: current.showRemainingPeakTime,
                locale: current.locale,
                peak: {
                    timezone: current.peak.timezone,
                    periods: current.peak.periods.map(period => ({ ...period })),
                },
            },
        };
    }, { authority: 'loopback' });
}
export function apply(ctx, config) {
    const baseConfig = normalizeSettings(config);
    const settingsScope = ctx.settings?.register(SETTINGS_NAMESPACE, SettingsSchema, { applies: 'live' });
    const settings = () => normalizeSettings(settingsScope?.get() ?? baseConfig);
    const logger = ctx.logger;
    const llm = service(ctx, 'llm');
    const controller = new PeakGuardController({
        settings,
        runtime: {
            now: () => new Date(),
            notify: notifyIfAvailable(ctx, logger),
            confirm: async (prompt) => {
                const userQuestions = service(ctx, 'userQuestions');
                if (userQuestions === undefined) {
                    throw new Error('dsh-peak-guard: ctx.userQuestions is unavailable');
                }
                return askPeakGuardConfirmation(userQuestions, prompt);
            },
            ...(logger === undefined ? {} : { logger }),
            ...(llm === undefined ? {} : { llm }),
        },
    });
    if (ctx.on === undefined) {
        throw new Error('dsh-peak-guard: Cordis ctx.on is unavailable');
    }
    ctx.on('agent/pre-step', (payload, next) => controller.handlePreStep(payload, next), { prepend: true });
    registerClientRpc(ctx, settings, logger);
    logger?.debug?.(`[PeakGuard] loaded enabled=${String(DEFAULT_PEAK_GUARD_SETTINGS.enabled)} mode=${DEFAULT_PEAK_GUARD_SETTINGS.mode}`);
}
//# sourceMappingURL=index.js.map