import {
  DEFAULT_DEEPSEEK_PEAK_CONFIG,
  type DeepSeekPeakConfig,
  type PeakPeriodConfig,
} from './constants.js'

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export interface PeakPeriod {
  start: Date
  end: Date
}

export interface PeakStatus {
  peak: boolean
  period: PeakPeriod | null
  localTime: string
  timezone: string
  minutesUntilOffPeak: number
}

function parseClock(value: string): number {
  const match = TIME_RE.exec(value)
  if (match === null) throw new Error(`invalid peak time "${value}", expected HH:MM`)
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour * 60 + minute
}

function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function assertSupportedTimezone(timezone: string): void {
  if (timezone !== 'Asia/Shanghai') {
    throw new Error(`unsupported peak timezone "${timezone}"; dsh-peak-guard currently supports Asia/Shanghai`)
  }
}

function normalizePeriods(periods: readonly PeakPeriodConfig[]): Array<{ start: number; end: number }> {
  return periods.map((period) => {
    const start = parseClock(period.start)
    const end = parseClock(period.end)
    if (end <= start) throw new Error(`peak period ${period.start}-${period.end} must not cross midnight`)
    return { start, end }
  })
}

const shanghaiFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
  timeZone: 'Asia/Shanghai',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function shanghaiParts(date: Date): ZonedParts {
  const parts = shanghaiFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find(part => part.type === type)?.value
    if (value === undefined) throw new Error(`Intl formatter omitted ${type}`)
    return Number(value)
  }
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function dateAtShanghaiClock(parts: ZonedParts, minutes: number): Date {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, minute, 0, 0))
}

function configOrDefault(config?: DeepSeekPeakConfig): DeepSeekPeakConfig {
  return config ?? DEFAULT_DEEPSEEK_PEAK_CONFIG
}

export function getZonedClockMinutes(date = new Date(), config?: DeepSeekPeakConfig): number {
  const resolved = configOrDefault(config)
  assertSupportedTimezone(resolved.timezone)
  const parts = shanghaiParts(date)
  return parts.hour * 60 + parts.minute
}

export function getZonedTimeLabel(date = new Date(), config?: DeepSeekPeakConfig): string {
  const resolved = configOrDefault(config)
  assertSupportedTimezone(resolved.timezone)
  return formatClock(getZonedClockMinutes(date, resolved))
}

export function isPeakTime(date = new Date(), config?: DeepSeekPeakConfig): boolean {
  const resolved = configOrDefault(config)
  const minutes = getZonedClockMinutes(date, resolved)
  return normalizePeriods(resolved.periods).some(period => minutes >= period.start && minutes < period.end)
}

export function getPeakPeriod(date = new Date(), config?: DeepSeekPeakConfig): PeakPeriod | null {
  const resolved = configOrDefault(config)
  assertSupportedTimezone(resolved.timezone)
  const parts = shanghaiParts(date)
  const minutes = parts.hour * 60 + parts.minute
  const period = normalizePeriods(resolved.periods).find(candidate =>
    minutes >= candidate.start && minutes < candidate.end)
  if (period === undefined) return null
  return {
    start: dateAtShanghaiClock(parts, period.start),
    end: dateAtShanghaiClock(parts, period.end),
  }
}

export function getNextOffPeakTime(date = new Date(), config?: DeepSeekPeakConfig): Date {
  const period = getPeakPeriod(date, config)
  return period?.end ?? new Date(date.getTime())
}

export function getMinutesUntilOffPeak(date = new Date(), config?: DeepSeekPeakConfig): number {
  const period = getPeakPeriod(date, config)
  if (period === null) return 0
  return Math.max(0, Math.ceil((period.end.getTime() - date.getTime()) / 60000))
}

export function getPeakStatus(date = new Date(), config?: DeepSeekPeakConfig): PeakStatus {
  const resolved = configOrDefault(config)
  const period = getPeakPeriod(date, resolved)
  return {
    peak: period !== null,
    period,
    localTime: getZonedTimeLabel(date, resolved),
    timezone: resolved.timezone,
    minutesUntilOffPeak: getMinutesUntilOffPeak(date, resolved),
  }
}
