import { detectDeepSeekProvider } from './provider.js';
import { getPeakStatus } from './peak-hours.js';
import { normalizeSettings, } from './settings.js';
import { warningMessage } from './ui.js';
function sessionIdOf(agent) {
    return String(agent.session.id);
}
function turnKey(agent, turn) {
    return `${sessionIdOf(agent)}:${String(turn)}`;
}
function hasUserInitiatedMessage(messages) {
    return messages.some(message => message.source.kind === 'user');
}
function providerNameFromRegistry(llm, provider) {
    if (provider === undefined || llm?.listProviders === undefined)
        return undefined;
    return llm.listProviders().find(info => info.id === provider)?.name
        ?? llm.listConfigurableProviders?.().find(info => info.provider === provider)?.displayName;
}
function optionString(agent, key) {
    const value = agent.options[key];
    return typeof value === 'string' ? value : undefined;
}
export class PeakGuardController {
    options;
    sessionBypass = new Set();
    authorizedTurns = new Set();
    pendingTurns = new Map();
    constructor(options) {
        this.options = options;
    }
    clearSessionBypass(sessionId) {
        this.sessionBypass.delete(sessionId);
    }
    hasSessionBypass(sessionId) {
        return this.sessionBypass.has(sessionId);
    }
    isTurnAuthorized(agent, turn) {
        return this.authorizedTurns.has(turnKey(agent, turn));
    }
    async handlePreStep(payload, next) {
        const downstream = await next();
        if (downstream.kind === 'reject')
            return downstream;
        const settings = normalizeSettings(this.options.settings());
        const guardPrompt = this.buildPromptIfNeeded(payload, downstream, settings);
        if (guardPrompt === null)
            return downstream;
        if (settings.mode === 'warn-only') {
            await this.warn(guardPrompt, payload.agent);
            this.authorizedTurns.add(turnKey(payload.agent, payload.turn));
            return downstream;
        }
        const key = turnKey(payload.agent, payload.turn);
        try {
            const decision = await this.confirmOnce(key, {
                ...guardPrompt,
                agent: payload.agent,
                signal: payload.signal,
            });
            this.log(settings, `userDecision=${decision.action}`);
            if (decision.action !== 'run')
                return { kind: 'reject' };
            this.authorizedTurns.add(key);
            if (decision.sessionBypass) {
                this.sessionBypass.add(sessionIdOf(payload.agent));
            }
            return downstream;
        }
        catch (error) {
            this.options.runtime.logger?.warn?.(`[PeakGuard] confirmation failed closed: ${String(error)}`);
            return { kind: 'reject' };
        }
    }
    buildPromptIfNeeded(payload, downstream, settings) {
        if (!settings.enabled || settings.mode === 'off')
            return null;
        if (payload.step !== 1)
            return null;
        if (downstream.messages.length === 0)
            return null;
        if (!hasUserInitiatedMessage(downstream.messages))
            return null;
        const sessionId = sessionIdOf(payload.agent);
        const key = turnKey(payload.agent, payload.turn);
        if (this.sessionBypass.has(sessionId) || this.authorizedTurns.has(key))
            return null;
        const provider = payload.agent.options.provider;
        const model = payload.agent.options.model;
        const providerName = providerNameFromRegistry(this.options.runtime.llm, provider);
        const baseURL = optionString(payload.agent, 'baseURL')
            ?? optionString(payload.agent, 'baseUrl')
            ?? optionString(payload.agent, 'base_url');
        const detectionInput = {
            ...(provider === undefined ? {} : { provider }),
            ...(providerName === undefined ? {} : { providerName }),
            ...(model === undefined ? {} : { model }),
            ...(baseURL === undefined ? {} : { baseURL }),
        };
        const detection = detectDeepSeekProvider(detectionInput, settings.providerMatching);
        this.log(settings, `provider=${provider ?? ''} model=${model ?? ''} deepseek=${String(detection.deepseek)} reason=${detection.reason ?? 'none'}`);
        if (!detection.deepseek)
            return null;
        const status = getPeakStatus(this.options.runtime.now(), settings.peak);
        this.log(settings, `localTime=${status.localTime} ${status.timezone} peak=${String(status.peak)}`);
        if (!status.peak)
            return null;
        return {
            status,
            locale: settings.locale,
            showRemainingPeakTime: settings.showRemainingPeakTime,
            allowSessionBypass: settings.allowSessionBypass,
            deferRequested: settings.mode === 'defer-to-off-peak',
        };
    }
    async confirmOnce(key, prompt) {
        const existing = this.pendingTurns.get(key);
        if (existing !== undefined)
            return existing;
        const pending = this.options.runtime.confirm(prompt);
        this.pendingTurns.set(key, pending);
        try {
            return await pending;
        }
        finally {
            this.pendingTurns.delete(key);
        }
    }
    async warn(prompt, agent) {
        const message = warningMessage(prompt);
        this.options.runtime.logger?.warn?.(`[PeakGuard] ${message}`);
        await this.options.runtime.notify?.(message, { ...prompt, agent });
    }
    log(settings, message) {
        if (settings.debug)
            this.options.runtime.logger?.debug?.(`[PeakGuard] ${message}`);
    }
}
//# sourceMappingURL=guard.js.map