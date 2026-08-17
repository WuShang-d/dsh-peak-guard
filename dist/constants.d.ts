export interface PeakPeriodConfig {
    start: string;
    end: string;
}
export interface DeepSeekPeakConfig {
    timezone: string;
    periods: PeakPeriodConfig[];
}
export declare const DEFAULT_DEEPSEEK_PEAK_CONFIG: {
    readonly timezone: "Asia/Shanghai";
    readonly periods: [{
        readonly start: "09:00";
        readonly end: "12:00";
    }, {
        readonly start: "14:00";
        readonly end: "18:00";
    }];
};
export declare const DEFAULT_DEEPSEEK_PROVIDER_IDS: readonly ["deepseek", "deepseek-official", "deepseek-api", "deepseek-v4-flash", "deepseek-v4-pro"];
export declare const DEFAULT_DEEPSEEK_BASE_URL_HOSTS: readonly ["api.deepseek.com"];
export declare const DEFAULT_DEEPSEEK_MODEL_IDS: readonly ["deepseek-chat", "deepseek-reasoner", "deepseek-coder", "deepseek-v4-flash", "deepseek-v4-pro"];
//# sourceMappingURL=constants.d.ts.map