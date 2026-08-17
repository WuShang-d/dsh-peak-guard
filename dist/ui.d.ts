import type { AskUserQuestionAnswer, UserQuestionServiceLike } from './dsh-types.js';
import type { PeakStatus } from './peak-hours.js';
import type { PeakGuardLocale } from './settings.js';
export type PeakGuardUserAction = 'run' | 'cancel';
export interface PeakGuardConfirmation {
    action: PeakGuardUserAction;
    sessionBypass: boolean;
}
export interface PeakGuardPrompt {
    status: PeakStatus;
    locale: PeakGuardLocale;
    showRemainingPeakTime: boolean;
    allowSessionBypass: boolean;
    deferRequested: boolean;
}
export declare function buildPeakGuardDetail(prompt: PeakGuardPrompt): string;
export declare function parsePeakGuardAnswer(answer: AskUserQuestionAnswer, locale: PeakGuardLocale): PeakGuardConfirmation;
export declare function askPeakGuardConfirmation(userQuestions: UserQuestionServiceLike, prompt: PeakGuardPrompt & {
    agent: Parameters<UserQuestionServiceLike['ask']>[0]['agent'];
    signal?: AbortSignal;
}): Promise<PeakGuardConfirmation>;
export declare function warningMessage(prompt: PeakGuardPrompt): string;
//# sourceMappingURL=ui.d.ts.map