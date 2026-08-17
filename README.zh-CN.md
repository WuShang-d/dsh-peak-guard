# dsh-peak-guard

DeepSeek Harness / DSH 的非官方社区插件。

`dsh-peak-guard` 在 DeepSeek API 的计费高峰时段保护你的调用。当用户在配置的高峰时段内、通过 DeepSeek 提供商开启新的 DSH 回合时，插件会在模型请求发出之前拦截并请求确认。

高峰时段安排与定价策略由 DeepSeek 控制，可能随时变化。请以 DeepSeek 官方最新的 API 定价文档为准。

## 功能

- 在用户发起的回合到达模型之前，检测 DeepSeek 提供商路由。
- 使用 `Asia/Shanghai` 时区判断当前时间，与电脑的时区 / 区域设置无关。
- 默认在高峰时段要求明确确认。
- 在会话头部显示当前 DeepSeek 高峰 / 低谷状态指示器。
- 支持按会话的放行（bypass），新会话与应用重启后自动重置。
- 在内部智能体连续执行与同回合重试恢复期间，避免重复弹窗。
- 失败即关闭（fail closed）：若确认界面不可用或出错，在发送任何 DeepSeek 请求之前就拒绝该回合。

## 为什么需要它

DeepSeek API 的高峰定价时段可能让无意的运行变得昂贵。本插件为 DSH 用户提供一个清晰、低摩擦的检查点，避免在默认高峰时段内白白消耗 token。

## 安装

通过 GitHub 安装：

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "github:<owner>/dsh-peak-guard"
```

为了可复现的安装，可以固定到某个 commit：

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "github:<owner>/dsh-peak-guard#<commit-sha>"
```

从本地代码仓库安装：

```bash
npm install
npm run build
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add "/absolute/path/to/dsh-peak-guard"
```

验证插件已出现在 profile 中：

```bash
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 --profile web --dump-config
```

## 使用方式

默认行为：

1. 用户提交新任务 / 消息。
2. `agent/pre-step` 在第一个模型步骤开始之前执行。
3. 如果当前提供商是 DeepSeek，且当前 `Asia/Shanghai` 时间处于高峰，DSH 会询问用户是否继续。
4. 选择「仍然运行」（Run anyway）则原样放行原始请求。
5. 选择「取消」（Cancel）则在任何模型调用之前拒绝该回合。

提示框中还提供可选的按会话放行选项。它仅存在于内存中，不会全局持久化。

浏览器端还会在 `conversation.session.header.utilities` 中渲染一个紧凑的指示器：

```text
🔴 高峰时段 17:23 · 37分钟
🟢 低谷时段 13:20
```

指示器通过私有回环 RPC 通道读取同一份 `peak-guard` 设置，并每 15 秒刷新一次。

## 模式（Modes）

- `off`：禁用插件。
- `warn-only`：尽可能记录日志 / 发送警告，但不阻止请求。
- `require-confirmation`：默认模式；高峰时段发送 DeepSeek 请求前先询问。
- `defer-to-off-peak`：可作为设置项接受，但本 MVP 尚未实现自动调度。目前会询问用户立即运行或取消。

## 配置

插件注册了 `peak-guard` 设置命名空间，同时也接受与 Cordis 插件配置相同的字段。

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

## 高峰时段安排

默认时区：

```text
Asia/Shanghai
```

默认高峰时段为半开区间：

```text
09:00 <= time < 12:00
14:00 <= time < 18:00
```

也就是说，`09:00` 属于高峰，而 `12:00` 与 `18:00` 属于低谷。

## 截图

本 MVP 未包含截图。在 DSH Web/Desktop 中，确认提示通过原生的用户提问（user-question）合成器 UI 呈现。

## 兼容性

面向提供以下能力的当前 DSH Web/Desktop 组合设计：

- `agent/pre-step`
- `ctx.settings`
- `ctx.userQuestions`
- `ctx.connection`
- 浏览器端 `slots`

无头（headless）或不完整的组合若缺少用户提问提供方，在高峰确认时会失败即关闭。

插件使用官方 DSH DeepSeek 提供商路由 `deepseek-official`，同时支持 `deepseek`、`api.deepseek.com` 以及精确的 DeepSeek 模型 ID 作为兜底检测信号。插件避免使用宽泛的 `model.includes("deepseek")` 匹配。

## 开发

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

项目结构：

```text
src/
  constants.ts    共享默认值
  peak-hours.ts   时区感知的高峰检测
  provider.ts     DeepSeek 提供商检测
  guard.ts        回合级守卫控制器
  ui.ts           DSH userQuestions 提示适配器
  settings.ts     插件设置 schema
  index.ts        Cordis 集成

tests/
  peak-hours.test.ts
  provider.test.ts
  guard.test.ts
```

## 已知限制

- 自动的「延后至低谷时段」调度尚未在 MVP 中实现。
- 主闸门在 `agent/pre-step` 时读取 `agent.options.provider/model`。如果其他插件在更靠后的 `agent/request` 阶段动态改写路由，本 MVP 可能看不到最终路由。
- 使用原生 DSH 用户提问 UI 而非自定义弹窗，因此按会话放行控件以第二个可选问题呈现。
- `warn-only` 模式在存在可用通知 / toast 服务时使用之，否则仅记录警告日志。

## 许可证

MIT。本项目与 DeepSeek 无关联，亦未经其认可。

致谢：`lco117/dsh-peak-hours` 帮助确认了 DSH 的插件形态与半开区间的北京时间高峰窗口约定。该项目为 MIT 许可证。
