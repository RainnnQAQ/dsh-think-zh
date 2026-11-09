# dsh-think-zh

让 DeepSeek Harness 用简体中文思考。

> **thinking / reasoning 是什么**
> 指模型在给出正式回答之前，先在内部写下的一段推理过程——列条件、试方案、自我纠错都在里面。界面上通常折叠成「思考过程」「推理过程」或一段灰色草稿，点开才看得到。这段内容默认是英文，本插件要求它改成简体中文。
>
> 顺带一提，它和「回答」是两回事：插件只约束思考用什么语言，不改变回答的内容与语言，也不影响代码、命令、路径、报错原文。

DeepSeek 的推理语言不受 API 参数控制（没有 `reasoning_language` 这类字段），只能靠提示词约束。本插件在系统提示与每轮运行时上下文中同时下指令，并在其他插件重写提示词装配时兜底补回，保证长对话、上下文压缩、预设切换之后规则仍然在。

代码、命令、路径、变量名、报错原文一律保持原样，不会被翻译。

[更新记录](CHANGELOG.md)

## 特性

- **系统提示注入**：会话开始即写入思考语言规则，排在提示词最后一段（`order: 10250`）
- **每轮运行时提醒**：贴近用户消息的短提醒（`order: 900`），抗长上下文与自动压缩
- **装配兜底**：监听 `system-prompt/assemble`，被其他插件整段重写时补回自己的段，关闭时精确移除
- **四档强度**：`soft` / `normal` / `hard` / `max`
- **可自定义正文**：整体替换内置文案
- **可视化控制面板**：设置页里开关、切强度、改正文，并预览实际注入的提示原文
- **多端可用**：桌面客户端、浏览器版、安卓 DSHA、headless、ACP、SDK
- **移动端适配**：40px 触控目标、16px 输入框、安全区留白、不依赖 `color-mix`

## 兼容性

| 端 | 思考注入 | 设置面板 | HTTP 接口 |
| --- | --- | --- | --- |
| 桌面客户端（`desktop`） | 支持 | 支持 | 支持 |
| 浏览器版（`web`） | 支持 | 支持 | 支持 |
| 安卓 DSHA（运行 `web` profile） | 支持 | 支持 | 支持 |
| Headless（`dsh headless "..."`） | 支持 | 无界面 | 无网关 |
| ACP（`dsh --profile acp`） | 支持 | 无界面 | 无网关 |
| SDK（`dsh --profile sdk`） | 支持 | 无界面 | 无网关 |
| SDK minimal | 支持 | 无界面 | 无网关 |

`systemPrompt` 由 `@deepseek-ai/dsh-base` 提供（`sdk-minimal` 自带一条）；HTTP 接口需要 `connection` 服务，只有 `@deepseek-ai/dsh-web-app` 提供，因此无界面的端会自动跳过接口注册。各端 profile 独立，运行时配置 `$DSH_HOME/think-zh.json` 共享。

## 安装

要求 DSH `>= 0.1.7-rc.2`、Node.js `>= 18`。

### 1. 放进 profile

```bash
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-think-zh
```

`<profile>` 取值：桌面客户端 `desktop`，浏览器版与安卓 DSHA `web`，其余见兼容性表。

Windows 上 `link:` 偶发 `EPERM: symlink` 时，手工创建符号链接：

```powershell
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-think-zh" `
  -Target "F:\path\to\dsh-think-zh"
```

### 2. 登记到 profile

```bash
node install.mjs --list               # 查看本机 profile 与安装状态
node install.mjs --profile desktop    # 自动选择登记方式
```

`install.mjs` 支持两种登记方式，`auto` 模式下优先 bundle：

| 方式 | 写入位置 | 特点 |
| --- | --- | --- |
| `bundle` | profile `package.json` 的 `dependencies` + `dsh.profile.bundles` | 正规路径，插件页「已安装」开关生效 |
| `patch` | profile `cordis.patch.yml` 追加 `- insert:` 段 | 兜底路径，无 pnpm 或符号链接失败时可用 |

常用参数：

```bash
node install.mjs --all                # 所有 profile
node install.mjs --mode bundle        # 强制 bundle
node install.mjs --mode patch         # 强制 patch
node install.mjs --remove --profile web
```

脚本幂等：重复执行不会写入第二份；`--remove` 会同时清理两种登记。写入前自动备份 `.bak`。

### 3. 重启

桌面客户端退出重开；`dsh web` 重启进程；安卓 DSHA 在主页停止并重新启动 DSH。补丁层改动通常由 HMR 在数秒内热挂载，bundle 与依赖改动需要重启。

## 使用

### 设置面板

**设置 → 内置插件 → 中文思考**（`settings.plugins.tab`，id `think-zh`，order 50）：

- 总开关、强度、每轮提醒、代码原文保护，点击即写入 `$DSH_HOME/think-zh.json`，下一轮生效
- 自定义正文输入框，留空使用内置文案
- 「恢复默认」清空运行时覆盖
- 展开可查看当前实际注入的系统提示与每轮提醒原文

面板通过 Host 接口 `/api/think-zh/status|set|reset` 读写，配置落在 `$DSH_HOME/think-zh.json`。

### 配置文件

`$DSH_HOME/think-zh.json`，存在即覆盖插件默认值，可手工编辑，下一轮生效。

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关 |
| `strength` | string | `"hard"` | `soft` / `normal` / `hard` / `max` |
| `perTurn` | boolean | `true` | 是否每轮补运行时提醒 |
| `codeVerbatim` | boolean | `true` | 代码 / 命令 / 路径 / 报错不翻译 |
| `customText` | string | `""` | 非空则整体替换内置正文 |
| `sectionOrder` | number | `10250` | 系统提示段排序位，越大越靠后 |
| `contextOrder` | number | `900` | 运行时提醒排序位 |
| `verbose` | boolean | `false` | 输出注册日志 |

## 工作原理

| 层 | 名称 | 位置 | 作用 |
| --- | --- | --- | --- |
| 1 | `think-zh:thinking-language` | 系统提示 section，`order: 10250` | 声明思考必须使用简体中文，禁止英文推理开头，代码原文不翻译 |
| 2 | `think-zh:reminder` | 运行时上下文快照，`order: 900` | 每轮补充短提醒，抵抗长上下文、压缩与预设切换 |
| 3 | `system-prompt/assemble` 守卫 | 每次装配 | 其他插件重写装配结果时补回上述两段；关闭时移除自己的段并保留他人内容 |

三层共用同一份配置，把总开关关掉等同于卸载后的行为。

## 目录结构

```text
index.js          插件装配：提示段、运行时提醒、HTTP 接口、装配守卫
client.js         浏览器侧设置面板
lib/config.js     配置解析与状态读写
lib/prompt.js     提示文案生成
lib/router.js     /api/think-zh/* 接口
lib/assemble.js   装配守卫
lib/selftest.js   自检
test/probe.mjs    宿主接口探针
test/e2e.mjs      真实 cordis 服务端到端测试
install.mjs       profile 登记与撤销
cordis.patch.yml  bundle patch 默认配置
```

## 开发与测试

```bash
node index.js --selftest   # 39 项自检
node test/probe.mjs        # 21 项探针
node test/e2e.mjs          # 12 项端到端（需本机 DSH 安装）
```

端到端测试默认依次探测常见 DSH 安装位置，找不到时自动跳过；可用环境变量
`DSH_RUNTIME` 指向 `<dsh>/node_modules` 强制指定。

日志写在 `$DSH_HOME/think-zh.log`，排查加载问题先看这里。

## 常见问题

**装完没有任何变化**
profile 装错了。桌面客户端读 `desktop`，浏览器版与安卓 DSHA 读 `web`。用 `node install.mjs --list` 确认，再看 `$DSH_HOME/think-zh.log` 是否有 `apply 进入`。

**插件页「已安装」里看不到**
该页读取 profile 的 `package.json` 依赖清单。只建符号链接不登记依赖时插件能运行但不显示，执行 `node install.mjs --mode bundle --profile <profile>` 补齐。

**「已安装」里的开关是关闭状态**
该开关控制 `dsh.profile.bundles`。使用 patch 方式登记时插件不在该数组内，显示为关闭但运行正常。改用 bundle 方式后开关即真实生效。日常开关请使用设置面板，或直接改 `$DSH_HOME/think-zh.json`。

**设置面板不出现但注入生效**
部分移动端皮肤可能未声明 `settings.plugins.tab` 槽。此时直接编辑 `$DSH_HOME/think-zh.json`，改完下一轮生效。

## 贡献

提交前请保证三套测试全部通过，并保持代码无注释、UTF-8 编码、`type: module`。

## 许可证

[MIT](LICENSE)
