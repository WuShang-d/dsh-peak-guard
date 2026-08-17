import { type DeepSeekPeakConfig } from './constants.js';
export interface PeakPeriod {
    start: Date;
    end: Date;
}
export interface PeakStatus {
    peak: boolean;
    period: PeakPeriod | null;
    localTime: string;
    timezone: string;
    minutesUntilOffPeak: number;
}
export declare function getZonedClockMinutes(date?: Date, config?: DeepSeekPeakConfig): number;
export declare function getZonedTimeLabel(date?: Date, config?: DeepSeekPeakConfig): string;
export declare function isPeakTime(date?: Date, config?: DeepSeekPeakConfig): boolean;
export declare function getPeakPeriod(date?: Date, config?: DeepSeekPeakConfig): PeakPeriod | null;
export declare function getNextOffPeakTime(date?: Date, config?: DeepSeekPeakConfig): Date;
export declare function getMinutesUntilOffPeak(date?: Date, config?: DeepSeekPeakConfig): number;
export declare function getPeakStatus(date?: Date, config?: DeepSeekPeakConfig): PeakStatus;
//# sourceMappingURL=peak-hours.d.ts.map