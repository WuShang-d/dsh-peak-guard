import { DEFAULT_DEEPSEEK_BASE_URL_HOSTS, DEFAULT_DEEPSEEK_MODEL_IDS, DEFAULT_DEEPSEEK_PROVIDER_IDS, } from './constants.js';
function normalizeToken(value) {
    return value.trim().toLowerCase();
}
function configuredSet(values, fallback) {
    return new Set((values ?? fallback).map(normalizeToken).filter(Boolean));
}
function hostOf(value) {
    const raw = value.trim();
    if (raw.length === 0)
        return null;
    try {
        return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
function hostnameMatches(hostname, configured) {
    for (const candidate of configured) {
        if (hostname === candidate || hostname.endsWith(`.${candidate}`))
            return true;
    }
    return false;
}
function modelMatches(model, configured) {
    const normalized = normalizeToken(model);
    if (configured.has(normalized))
        return true;
    return /^deepseek-v\d+(?:\.\d+)?-(?:flash|pro)$/.test(normalized);
}
function metadataBaseURL(metadata) {
    const candidates = [
        metadata?.baseURL,
        metadata?.baseUrl,
        metadata?.base_url,
        metadata?.endpoint,
        metadata?.url,
    ];
    const hit = candidates.find((value) => typeof value === 'string');
    return hit;
}
export function detectDeepSeekProvider(input, config) {
    const providerIds = configuredSet(config?.providerIds, DEFAULT_DEEPSEEK_PROVIDER_IDS);
    const baseURLHosts = configuredSet(config?.baseURLHosts, DEFAULT_DEEPSEEK_BASE_URL_HOSTS);
    const modelIds = configuredSet(config?.modelIds, DEFAULT_DEEPSEEK_MODEL_IDS);
    const provider = input.provider === undefined ? '' : normalizeToken(input.provider);
    if (provider !== '' && providerIds.has(provider)) {
        return { deepseek: true, reason: 'provider-id' };
    }
    const providerName = input.providerName === undefined ? '' : normalizeToken(input.providerName);
    if (providerName === 'deepseek' || providerName === 'deepseek official') {
        return { deepseek: true, reason: 'provider-name' };
    }
    const baseURL = input.baseURL ?? metadataBaseURL(input.metadata);
    if (baseURL !== undefined) {
        const host = hostOf(baseURL);
        if (host !== null && hostnameMatches(host, baseURLHosts)) {
            return { deepseek: true, reason: 'base-url' };
        }
    }
    if (input.model !== undefined && modelMatches(input.model, modelIds)) {
        return { deepseek: true, reason: 'model-id' };
    }
    return { deepseek: false, reason: null };
}
export function isDeepSeekProvider(input, config) {
    return detectDeepSeekProvider(input, config).deepseek;
}
//# sourceMappingURL=provider.js.map