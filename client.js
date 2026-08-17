/* global window, setInterval, clearInterval */
// Browser half for dsh-peak-guard.
// Renders a compact peak/off-peak indicator in the session header utilities
// slot. Runtime settings come from the Host half over a private loopback RPC.
window.__ModuleLoader__.load({
  id: 'dsh-peak-guard',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')

    const RPC_CHANNEL = '/peak-guard'
    const REFRESH_MS = 15000
    const SETTINGS_REFRESH_MS = 60000

    const DEFAULT_SETTINGS = {
      enabled: true,
      mode: 'require-confirmation',
      showRemainingPeakTime: true,
      locale: 'zh',
      peak: {
        timezone: 'Asia/Shanghai',
        periods: [
          { start: '09:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
    }

    const LABELS = {
      zh: {
        peak: '🔴 高峰时段',
        off: '🟢 低谷时段',
        guardOff: '保护已关闭',
        current: '当前时间',
        peakEnd: '本轮高峰结束',
        remaining: '距离低谷',
        minute: '分钟',
        schedule: '北京时间 09:00-12:00 / 14:00-18:00',
        peakTitle: '当前处于 DeepSeek API 高峰计价时段。',
        offTitle: '当前处于 DeepSeek API 低谷/非高峰时段。',
      },
      en: {
        peak: '🔴 Peak hours',
        off: '🟢 Off-peak',
        guardOff: 'Guard off',
        current: 'Current time',
        peakEnd: 'Peak period ends',
        remaining: 'Until off-peak',
        minute: 'min',
        schedule: 'Beijing time 09:00-12:00 / 14:00-18:00',
        peakTitle: 'DeepSeek API peak pricing is active.',
        offTitle: 'DeepSeek API is currently off-peak.',
      },
    }

    const badgeStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      height: '28px',
      padding: '0 10px',
      borderRadius: '14px',
      border: '1px solid var(--dsw-alias-border-l2)',
      font: 'inherit',
      fontSize: '12px',
      lineHeight: '18px',
      whiteSpace: 'nowrap',
      cursor: 'default',
      maxWidth: 'min(260px, 42vw)',
      overflow: 'hidden',
    }
    const labelStyle = {
      minWidth: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
    const metaStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      flex: '0 0 auto',
    }

    function parseClock(value) {
      const match = /^(\d{2}):(\d{2})$/.exec(value)
      if (match === null) return null
      const hour = Number(match[1])
      const minute = Number(match[2])
      if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
      return hour * 60 + minute
    }

    function clockParts(date, timezone) {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(date)
      const value = (type) => Number(parts.find(part => part.type === type)?.value ?? 0)
      return {
        hour: value('hour'),
        minute: value('minute'),
        second: value('second'),
      }
    }

    function timeLabel(parts) {
      return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
    }

    function statusFor(date, settings) {
      const peak = settings.peak ?? DEFAULT_SETTINGS.peak
      const timezone = typeof peak.timezone === 'string' ? peak.timezone : DEFAULT_SETTINGS.peak.timezone
      const periods = Array.isArray(peak.periods) ? peak.periods : DEFAULT_SETTINGS.peak.periods
      const parts = clockParts(date, timezone)
      const exactMinutes = parts.hour * 60 + parts.minute + parts.second / 60

      for (const period of periods) {
        const start = parseClock(period.start)
        const end = parseClock(period.end)
        if (start === null || end === null || end <= start) continue
        if (exactMinutes >= start && exactMinutes < end) {
          return {
            peak: true,
            localTime: timeLabel(parts),
            timezone,
            end: period.end,
            minutesUntilOffPeak: Math.max(0, Math.ceil(end - exactMinutes)),
          }
        }
      }
      return {
        peak: false,
        localTime: timeLabel(parts),
        timezone,
        end: null,
        minutesUntilOffPeak: 0,
      }
    }

    function normalizeSettings(value) {
      if (value === null || typeof value !== 'object') return DEFAULT_SETTINGS
      const locale = value.locale === 'en' ? 'en' : 'zh'
      const peak = value.peak && typeof value.peak === 'object'
        ? {
            timezone: typeof value.peak.timezone === 'string'
              ? value.peak.timezone
              : DEFAULT_SETTINGS.peak.timezone,
            periods: Array.isArray(value.peak.periods)
              ? value.peak.periods
              : DEFAULT_SETTINGS.peak.periods,
          }
        : DEFAULT_SETTINGS.peak
      return {
        enabled: value.enabled !== false,
        mode: typeof value.mode === 'string' ? value.mode : DEFAULT_SETTINGS.mode,
        showRemainingPeakTime: value.showRemainingPeakTime !== false,
        locale,
        peak,
      }
    }

    function usePeakGuardSettings(rpc) {
      const [settings, setSettings] = React.useState(DEFAULT_SETTINGS)
      React.useEffect(() => {
        let alive = true
        const load = () => {
          rpc.call(RPC_CHANNEL, 'get', {}).then((result) => {
            if (!alive) return
            const value = result && result.ok ? result.value : undefined
            setSettings(normalizeSettings(value))
          }).catch(() => {
            // Keep the default settings if the Host half is still loading or
            // the connection resets. The guard itself remains Host-side.
          })
        }
        load()
        const timer = setInterval(load, SETTINGS_REFRESH_MS)
        return () => { alive = false; clearInterval(timer) }
      }, [])
      return settings
    }

    module.exports = {
      name: 'dsh-peak-guard',
      inject: ['slots', 'connection'],
      apply(ctx) {
        const rpc = ctx.connection.rpc

        function PeakGuardIndicator() {
          const [now, setNow] = React.useState(() => new Date())
          const settings = usePeakGuardSettings(rpc)

          React.useEffect(() => {
            const timer = setInterval(() => { setNow(new Date()) }, REFRESH_MS)
            return () => { clearInterval(timer) }
          }, [])

          const status = statusFor(now, settings)
          const text = LABELS[settings.locale] ?? LABELS.zh
          const enabled = settings.enabled && settings.mode !== 'off'
          const titleLines = [
            status.peak ? text.peakTitle : text.offTitle,
            `${text.current}: ${status.localTime} ${status.timezone}`,
            status.peak && status.end !== null ? `${text.peakEnd}: ${status.end}` : null,
            status.peak && settings.showRemainingPeakTime
              ? `${text.remaining}: ${status.minutesUntilOffPeak} ${text.minute}`
              : null,
            enabled ? null : text.guardOff,
            text.schedule,
          ].filter(Boolean)

          const meta = status.peak && settings.showRemainingPeakTime
            ? `${status.localTime} · ${status.minutesUntilOffPeak}${text.minute}`
            : status.localTime

          return React.createElement('span', {
            style: {
              ...badgeStyle,
              background: status.peak
                ? 'var(--dsw-alias-interactive-bg-hover-danger)'
                : 'var(--dsw-alias-bg-module-platform)',
              color: 'var(--dsw-alias-label-primary)',
              opacity: enabled ? 1 : 0.66,
            },
            title: titleLines.join('\n'),
            'aria-label': titleLines.join(' '),
          },
            React.createElement('span', { style: labelStyle }, status.peak ? text.peak : text.off),
            React.createElement('span', { style: metaStyle }, meta),
          )
        }

        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'peak-guard-status',
          order: -20,
        }, PeakGuardIndicator))
      },
    }

    return module.exports
  },
})
