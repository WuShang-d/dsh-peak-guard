import { describe, expect, it } from 'vitest'
import {
  getMinutesUntilOffPeak,
  getNextOffPeakTime,
  getPeakPeriod,
  getZonedTimeLabel,
  isPeakTime,
} from '../src/peak-hours.js'

function shanghaiInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}+08:00`)
}

describe('peak-hours', () => {
  it.each([
    ['08:59', false],
    ['09:00', true],
    ['11:59', true],
    ['12:00', false],
    ['13:59', false],
    ['14:00', true],
    ['17:59', true],
    ['18:00', false],
    ['23:00', false],
  ])('%s Asia/Shanghai peak=%s', (time, expected) => {
    expect(isPeakTime(shanghaiInstant('2026-01-02', `${time}:00`))).toBe(expected)
  })

  it('returns the current peak period as absolute Date instants', () => {
    const date = shanghaiInstant('2026-01-02', '17:23:00')
    const period = getPeakPeriod(date)
    expect(period?.start.toISOString()).toBe('2026-01-02T06:00:00.000Z')
    expect(period?.end.toISOString()).toBe('2026-01-02T10:00:00.000Z')
    expect(getNextOffPeakTime(date).toISOString()).toBe('2026-01-02T10:00:00.000Z')
    expect(getMinutesUntilOffPeak(date)).toBe(37)
  })

  it('returns zero minutes and the original instant outside peak periods', () => {
    const date = shanghaiInstant('2026-01-02', '23:00:00')
    expect(getPeakPeriod(date)).toBeNull()
    expect(getMinutesUntilOffPeak(date)).toBe(0)
    expect(getNextOffPeakTime(date).toISOString()).toBe(date.toISOString())
  })

  it('uses Asia/Shanghai instead of the host locale or timezone', () => {
    const utcInstant = new Date('2026-01-02T01:00:00.000Z')
    expect(getZonedTimeLabel(utcInstant)).toBe('09:00')
    expect(isPeakTime(utcInstant)).toBe(true)
  })

  it('is stable across dates that are DST transitions elsewhere', () => {
    const usSpringForwardDay = new Date('2026-03-08T06:00:00.000Z')
    const usFallBackDay = new Date('2026-11-01T06:00:00.000Z')
    expect(getZonedTimeLabel(usSpringForwardDay)).toBe('14:00')
    expect(isPeakTime(usSpringForwardDay)).toBe(true)
    expect(getZonedTimeLabel(usFallBackDay)).toBe('14:00')
    expect(isPeakTime(usFallBackDay)).toBe(true)
  })

  it('treats the end boundary as off-peak even with seconds present', () => {
    expect(isPeakTime(shanghaiInstant('2026-01-02', '17:59:59'))).toBe(true)
    expect(isPeakTime(shanghaiInstant('2026-01-02', '18:00:01'))).toBe(false)
  })
})
