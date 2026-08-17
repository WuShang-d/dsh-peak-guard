import type {
  AskUserQuestionAnswer,
  AskUserQuestionItem,
  UserQuestionServiceLike,
} from './dsh-types.js'
import type { PeakStatus } from './peak-hours.js'
import type { PeakGuardLocale } from './settings.js'

export type PeakGuardUserAction = 'run' | 'cancel'

export interface PeakGuardConfirmation {
  action: PeakGuardUserAction
  sessionBypass: boolean
}

export interface PeakGuardPrompt {
  status: PeakStatus
  locale: PeakGuardLocale
  showRemainingPeakTime: boolean
  allowSessionBypass: boolean
  deferRequested: boolean
}

const LABELS = {
  zh: {
    header: 'DeepSeek 高峰时段',
    question: '你仍然要运行这个任务吗？',
    body: '当前处于 DeepSeek API 高峰计价时段。非高峰运行通常可以降低 API 成本。',
    currentTime: '当前时间',
    peakEnd: '本轮高峰结束',
    remaining: '距离非高峰',
    minute: '分钟',
    run: '仍然运行',
    runRecommended: '仍然运行（推荐）',
    cancel: '取消',
    bypassQuestion: '本会话高峰期不再提醒？',
    bypassOption: '本会话高峰期不再提醒',
    bypassDescription: '只对当前 session 生效；新会话和应用重启后会恢复提醒。',
    deferUnavailable: '自动延迟到非高峰运行暂未在此 MVP 中启用；请选择立即运行或取消。',
  },
  en: {
    header: 'DeepSeek Peak Pricing',
    question: 'Do you still want to run this task?',
    body: 'The current time is within the DeepSeek API peak pricing period. Running off-peak can often reduce API cost.',
    currentTime: 'Current time',
    peakEnd: 'Peak period ends',
    remaining: 'Until off-peak',
    minute: 'minute(s)',
    run: 'Run anyway',
    runRecommended: 'Run anyway (Recommended)',
    cancel: 'Cancel',
    bypassQuestion: 'Do not warn again during peak hours in this session?',
    bypassOption: 'Do not warn again in this session',
    bypassDescription: 'Applies only to the current session; new sessions and app restarts warn again.',
    deferUnavailable: 'Automatic defer-to-off-peak is not enabled in this MVP. Choose whether to run now or cancel.',
  },
} as const

function formatEnd(status: PeakStatus): string {
  if (status.period === null) return ''
  return new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone: status.timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(status.period.end)
}

export function buildPeakGuardDetail(prompt: PeakGuardPrompt): string {
  const t = LABELS[prompt.locale]
  const lines = [
    t.body,
    '',
    `${t.currentTime}: ${prompt.status.localTime}`,
  ]
  if (prompt.status.period !== null) {
    lines.push(`${t.peakEnd}: ${formatEnd(prompt.status)}`)
  }
  if (prompt.showRemainingPeakTime) {
    lines.push(`${t.remaining}: ${prompt.status.minutesUntilOffPeak} ${t.minute}`)
  }
  if (prompt.deferRequested) {
    lines.push('', t.deferUnavailable)
  }
  return lines.join('\n')
}

function selected(answer: AskUserQuestionAnswer, id: string): string[] {
  return answer.answers.find(item => item.id === id)?.selected ?? []
}

export function parsePeakGuardAnswer(answer: AskUserQuestionAnswer, locale: PeakGuardLocale): PeakGuardConfirmation {
  const t = LABELS[locale]
  const decision = selected(answer, 'decision')
  const bypass = selected(answer, 'sessionBypass')
  const runLabels: ReadonlySet<string> = new Set([t.run, t.runRecommended])
  return {
    action: decision.some(label => runLabels.has(label)) ? 'run' : 'cancel',
    sessionBypass: bypass.includes(t.bypassOption),
  }
}

export async function askPeakGuardConfirmation(
  userQuestions: UserQuestionServiceLike,
  prompt: PeakGuardPrompt & { agent: Parameters<UserQuestionServiceLike['ask']>[0]['agent']; signal?: AbortSignal },
): Promise<PeakGuardConfirmation> {
  const t = LABELS[prompt.locale]
  const questions: AskUserQuestionItem[] = [
    {
      id: 'decision',
      header: `⚠ ${t.header}`,
      question: t.question,
      detail: buildPeakGuardDetail(prompt),
      options: [
        { label: t.runRecommended },
        { label: t.cancel },
      ],
    },
  ]
  if (prompt.allowSessionBypass) {
    questions.push({
      id: 'sessionBypass',
      question: t.bypassQuestion,
      options: [
        { label: t.bypassOption, description: t.bypassDescription },
      ],
      multiSelect: true,
    })
  }

  const answer = await userQuestions.ask({
    questions,
    ...(prompt.agent === undefined ? {} : { agent: prompt.agent }),
    ...(prompt.signal === undefined ? {} : { signal: prompt.signal }),
  })
  return parsePeakGuardAnswer(answer, prompt.locale)
}

export function warningMessage(prompt: PeakGuardPrompt): string {
  const t = LABELS[prompt.locale]
  return `${t.header}: ${buildPeakGuardDetail(prompt).replace(/\n+/g, ' ')}`
}
