import type { ProviderMatchingConfig } from './settings.js';
export interface ProviderDetectionInput {
    provider?: string;
    providerName?: string;
    model?: string;
    baseURL?: string;
    metadata?: Record<string, unknown>;
}
export interface ProviderDetectionResult {
    deepseek: boolean;
    reason: 'provider-id' | 'provider-name' | 'base-url' | 'model-id' | null;
}
export declare function detectDeepSeekProvider(input: ProviderDetectionInput, config?: Partial<ProviderMatchingConfig>): ProviderDetectionResult;
export declare function isDeepSeekProvider(input: ProviderDetectionInput, config?: Partial<ProviderMatchingConfig>): boolean;
//# sourceMappingURL=provider.d.ts.map