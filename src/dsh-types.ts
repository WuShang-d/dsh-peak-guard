export interface TextBlock {
  type: 'text'
  text: string
}

export interface MessageSource {
  kind: string
  [key: string]: unknown
}

export interface UserMessage {
  id?: string
  content: Array<TextBlock | { type: string; [key: string]: unknown }>
  source: MessageSource
}

export interface SessionLike {
  id: string
  events?: readonly unknown[]
}

export interface AgentLike {
  id: string
  options: {
    provider?: string
    model?: string
    [key: string]: unknown
  }
  session: SessionLike
}

export type PreStepDecision =
  | { kind: 'reject' }
  | { kind: 'enter'; messages: UserMessage[] }

export interface PreStepPayload {
  agent: AgentLike
  messages: UserMessage[]
  turn: number
  step: number
  signal: AbortSignal
}

export type PreStepNext = () => Promise<PreStepDecision>

export interface AskUserQuestionOption {
  label: string
  description?: string
}

export interface AskUserQuestionItem {
  id: string
  question: string
  detail?: string
  header?: string
  options?: AskUserQuestionOption[]
  multiSelect?: boolean
}

export interface AskUserQuestionAnswerItem {
  id: string
  selected: string[]
  custom?: string
}

export interface AskUserQuestionAnswer {
  answers: AskUserQuestionAnswerItem[]
}

export interface UserQuestionServiceLike {
  ask(request: {
    questions: AskUserQuestionItem[]
    agent?: AgentLike
    signal?: AbortSignal
  }): Promise<AskUserQuestionAnswer>
}

export interface SettingsScopeLike<T> {
  get(): T
  update?(patch: Partial<T>): Promise<void>
}

export interface SettingsServiceLike {
  register<T>(namespace: string, schema: unknown, options?: { applies?: string }): SettingsScopeLike<T>
}

export interface RpcServiceLike {
  handle(
    channel: string,
    handler: (endpoint: string, payload: unknown) => Promise<unknown> | unknown,
    options?: { authority?: string },
  ): unknown
}

export interface ConnectionLike {
  rpc?: RpcServiceLike
}

export interface LoggerLike {
  debug?(message: string): void
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
}

export interface LlmProviderInfoLike {
  id: string
  name: string
}

export interface LlmConfigurableProviderLike {
  provider: string
  displayName: string
  settingsNs?: string
  settingsPath?: readonly string[]
  declared?: boolean
}

export interface LlmServiceLike {
  listProviders?(): LlmProviderInfoLike[]
  listConfigurableProviders?(): LlmConfigurableProviderLike[]
}

export interface DshContextLike {
  settings?: SettingsServiceLike
  userQuestions?: UserQuestionServiceLike
  connection?: ConnectionLike
  llm?: LlmServiceLike
  logger?: LoggerLike
  get?(key: string): unknown
  on?(
    event: 'agent/pre-step',
    listener: (payload: PreStepPayload, next: PreStepNext) => Promise<PreStepDecision>,
    options?: { prepend?: boolean },
  ): unknown
}
