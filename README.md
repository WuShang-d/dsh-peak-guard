# dsh-peak-guard

Unofficial community plugin for DeepSeek Harness / DSH.

`dsh-peak-guard` protects DeepSeek API calls during peak pricing windows. When a user starts a new DSH turn on a DeepSeek provider during a configured peak period, the plugin stops before the model request is sent and asks for confirmation.

Peak schedules and pricing policies are controlled by DeepSeek and may change. Users should verify the latest official DeepSeek API pricing documentation.

## What it does

- Detects DeepSeek provider routes before a user-initiated turn reaches the model.
- Checks the current time in `Asia/Shanghai`, independent of the computer's locale or timezone.
- Requires an explicit confirmation during peak hours by default.
- Shows a session-header indicator for current DeepSeek peak/off-peak status.
- Supports a per-session bypass that resets for new sessions and app restarts.
- Prevents repeated prompts during internal agent continuations and same-turn retry recovery.
- Fails closed: if the confirmation UI is unavailable or errors, the turn is rejected before any DeepSeek request is sent.

## Why it exists

DeepSeek API peak pricing windows can make accidental runs more expensive. This plugin gives DSH users a clear, low-friction checkpoint before spending tokens during the default peak periods.

## Installation

From GitHub:

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "github:<owner>/dsh-peak-guard"
```

For reproducible installs, pin a commit:

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "github:<owner>/dsh-peak-guard#<commit-sha>"
```

From a local checkout:

```bash
npm install
npm run build
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "/absolute/path/to/dsh-peak-guard"
```

Verify the plugin appears in the profile:

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 --profile web --dump-config
```

## Usage

Default behavior:

1. User submits a new task/message.
2. `agent/pre-step` runs before the first model step is opened.
3. If the active provider is DeepSeek and the current `Asia/Shanghai` time is peak, DSH asks the user whether to continue.
4. `Run anyway` allows the original request to proceed unchanged.
5. `Cancel` rejects the turn before any model call.

The prompt also offers an optional per-session bypass. It is in-memory only and is not persisted globally.

The browser half also renders a compact indicator in `conversation.session.header.utilities`:

```text
🔴 高峰时段 17:23 · 37分钟
🟢 低谷时段 13:20
```

The indicator reads the same `peak-guard` settings through a private loopback RPC channel and refreshes every 15 seconds.

## Modes

- `off`: disables the plugin.
- `warn-only`: logs/sends a warning when possible, but does not block the request.
- `require-confirmation`: default; asks before a DeepSeek request in peak hours.
- `defer-to-off-peak`: accepted as a setting, but automatic scheduling is not implemented in this MVP. It currently asks the user to run now or cancel.

## Configuration

The plugin registers the `peak-guard` settings namespace and also accepts the same fields as Cordis plugin config.

```yaml
- id: peak-guard
  name: dsh-peak-guard
  config:
    enabled: true
    mode: require-confirmation
    showRemainingPeakTime: true
    allowSessionBypass: true
    locale: zh
    peak:
      timezone: Asia/Shanghai
      periods:
        - start: "09:00"
          end: "12:00"
        - start: "14:00"
          end: "18:00"
    providerMatching:
      providerIds:
        - deepseek
        - deepseek-official
      baseURLHosts:
        - api.deepseek.com
      modelIds:
        - deepseek-v4-flash
        - deepseek-v4-pro
```

## Peak schedule

Default timezone:

```text
Asia/Shanghai
```

Default peak periods are half-open intervals:

```text
09:00 <= time < 12:00
14:00 <= time < 18:00
```

So `09:00` is peak, while `12:00` and `18:00` are off-peak.

## Screenshots

No screenshots are included in this MVP. In DSH Web/Desktop, the confirmation is rendered through the native user-question composer UI.

## Compatibility

Designed for current DSH Web/Desktop compositions that provide:

- `agent/pre-step`
- `ctx.settings`
- `ctx.userQuestions`
- `ctx.connection`
- browser `slots`

Headless or incomplete compositions without a user-question provider fail closed during peak confirmation.

The plugin uses the official DSH DeepSeek provider route `deepseek-official`, and also supports `deepseek`, `api.deepseek.com`, and exact DeepSeek model IDs as fallback detection signals. It avoids broad `model.includes("deepseek")` matching.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Project layout:

```text
src/
  constants.ts    shared defaults
  peak-hours.ts   timezone-aware peak detection
  provider.ts     DeepSeek provider detection
  guard.ts        turn-level guard controller
  ui.ts           DSH userQuestions prompt adapter
  settings.ts     plugin settings schema
  index.ts        Cordis integration

tests/
  peak-hours.test.ts
  provider.test.ts
  guard.test.ts
```

## Known limitations

- Automatic defer-to-off-peak scheduling is not implemented in the MVP.
- The main gate uses `agent.options.provider/model` at `agent/pre-step`. If another plugin dynamically rewrites the route later in `agent/request`, this MVP may not see that final route.
- The native DSH user-question UI is used instead of a custom modal, so the session-bypass control is presented as a second optional question.
- `warn-only` uses available notification/toast services when present, otherwise logs a warning.

## License

MIT. This project is not affiliated with or endorsed by DeepSeek.

Acknowledgement: `lco117/dsh-peak-hours` helped confirm DSH's plugin shape and the half-open Beijing-time peak-window convention. That project is MIT licensed.
