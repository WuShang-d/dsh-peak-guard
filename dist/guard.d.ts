import type { AgentLike, LoggerLike, LlmServiceLike, PreStepDecision, PreStepNext, PreStepPayload } from './dsh-types.js';
import { type PeakGuardSettings } from './settings.js';
import type { PeakGuardConfirmation, PeakGuardPrompt } from './ui.js';
export interface PeakGuardRuntime {
    now(): Date;
    confirm(prompt: PeakGuardPrompt & {
        agent: AgentLike;
        signal?: AbortSignal;
    }): Promise<PeakGuardConfirmation>;
    notify?(message: string, prompt: PeakGuardPrompt & {
        agent: AgentLike;
    }): Promise<void> | void;
    logger?: LoggerLike;
    llm?: LlmServiceLike;
}
export interface PeakGuardControllerOptions {
    settings(): PeakGuardSettings;
    runtime: PeakGuardRuntime;
}
export declare class PeakGuardController {
    private readonly options;
    private readonly sessionBypass;
    private readonly authorizedTurns;
    private readonly pendingTurns;
    constructor(options: PeakGuardControllerOptions);
    clearSessionBypass(sessionId: string): void;
    hasSessionBypass(sessionId: string): boolean;
    isTurnAuthorized(agent: AgentLike, turn: number): boolean;
    handlePreStep(payload: PreStepPayload, next: PreStepNext): Promise<PreStepDecision>;
    private buildPromptIfNeeded;
    private confirmOnce;
    private warn;
    private log;
}
//# sourceMappingURL=guard.d.ts.map