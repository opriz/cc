# Claude Code 仓库概览

## 项目简介

**Claude Code** 是 Anthropic 官方开发的 AI 编程助手 CLI 工具，包名为 `@anthropic-ai/claude-code`，当前版本 **2.1.87**。它将 Claude AI 嵌入到终端工作流中，支持交互式对话、代码编写、Git 操作、任务自动化等场景。

- **语言**：TypeScript / TSX（含 React 组件）
- **运行时**：Node.js（构建工具为 Bun）
- **入口**：`entrypoints/cli.tsx` → 编译产物 `dist/cli.js`
- **注册命令**：`claude`

---

## 目录结构

```
cc/
├── assistant/                # Kairos 助手模式（长会话 + 日志记忆）
├── bootstrap/                # 启动初始化（session state、配置预加载）
├── bridge/                   # Bridge 模式（远程机器控制）
├── buddy/                    # 虚拟宠物伴侣（彩蛋功能）
├── cli/                      # CLI 处理器（print 模式、结构化 IO、transport）
├── commands/                 # 105+ 子命令实现
├── components/               # React/Ink 终端 UI 组件
├── constants/                # 常量配置
├── context/                  # React Context（通知、权限、会话等）
├── coordinator/              # 多 Agent 协调模式
├── entrypoints/              # 入口文件（CLI、MCP、SDK、沙箱等）
├── hooks/                    # React hooks（输入、权限、状态等）
├── ink/                      # 自定义 Ink 终端 UI 基础设施
├── keybindings/              # 键盘快捷键配置与处理
├── memdir/                   # 记忆系统（MEMORY.md、动态召回、memory 扫描）
├── migrations/               # 配置迁移脚本
├── moreright/                # 右侧面板 UI 组件
├── native-ts/                # 原生模块的纯 TS 替代实现（如 color-diff）
├── outputStyles/             # 输出格式化样式
├── plugins/                  # 插件系统（加载、版本管理）
├── query/                    # query loop 的子模块（config、deps、tokenBudget、stopHooks 等）
├── remote/                   # 远程会话支持
├── schemas/                  # Zod 数据校验 schema
├── screens/                  # 顶层页面组件（REPL、onboarding 等）
├── sdk/                      # SDK 类型导出
├── server/                   # 服务端组件
├── services/                 # 服务模块
│   ├── analytics/            # 事件上报、GrowthBook feature flags
│   ├── api/                  # Claude API 客户端、重试、日志
│   ├── compact/              # 上下文压缩（autoCompact、microCompact、snip）
│   ├── mcp/                  # MCP 服务器管理
│   ├── tools/                # 工具编排（runTools、StreamingToolExecutor）
│   └── ...
├── skills/                   # Skill 定义（bundled 内置 skill + 用户自定义）
├── state/                    # AppState 定义与管理
├── stubs/                    # 构建用桩文件（替换无法安装的私有/原生依赖）
├── tasks/                    # 后台任务管理
├── tools/                    # 45 个工具实现（Bash、文件、Web、MCP、Agent 等）
├── types/                    # TypeScript 类型定义
├── upstreamproxy/            # 上游代理支持
├── utils/                    # 工具函数
│   ├── hooks/                # PreToolUse/PostToolUse/Stop hooks 执行
│   ├── model/                # 模型选择与解析
│   ├── permissions/          # 权限检查逻辑
│   ├── settings/             # 配置读写
│   └── ...
├── vim/                      # 终端输入框的 Vim 模式实现
├── voice/                    # 语音功能
├── build.ts                  # Bun 构建配置（feature flags、alias 映射）
├── commands.ts               # 命令注册表
├── context.ts                # 顶层 context 工具函数
├── cost-tracker.ts           # API 调用费用追踪
├── history.ts                # 输入历史记录
├── main.tsx                  # 主路由与会话初始化（~800KB）
├── package.json              # 依赖与脚本
├── query.ts                  # 真正的 agentic loop（while true：调用 API → 执行工具 → 循环）
├── QueryEngine.ts            # 对话生命周期管理器，封装 agentic loop 外层逻辑
├── Task.ts                   # 任务数据模型
├── Tool.ts                   # 工具系统基础接口与 buildTool() 工厂函数
├── tools.ts                  # 工具注册表，按 feature flag 条件组装工具列表
├── tsconfig.json             # TypeScript 配置
└── dist/                     # 编译产物（dist/cli.js）
```

---

## 模块重要性排序

| 优先级 | 模块 | 说明 |
|--------|------|------|
| ⭐⭐⭐⭐⭐ | `query.ts` | agentic loop 核心，所有 AI 行为从这里发生 |
| ⭐⭐⭐⭐⭐ | `QueryEngine.ts` | 对话生命周期管理，query.ts 的外层封装 |
| ⭐⭐⭐⭐⭐ | `Tool.ts` | 工具系统基础接口，所有工具的契约 |
| ⭐⭐⭐⭐⭐ | `services/api/` | Claude API 客户端，所有模型调用的入口 |
| ⭐⭐⭐⭐⭐ | `tools/` | 45 个工具实现，Agent 的执行能力 |
| ⭐⭐⭐⭐ | `main.tsx` | 命令注册与会话初始化，程序骨架 |
| ⭐⭐⭐⭐ | `utils/` | 权限、模型、配置、hooks 等横切基础设施 |
| ⭐⭐⭐⭐ | `services/compact/` | 上下文压缩，长会话的关键支撑 |
| ⭐⭐⭐⭐ | `memdir/` | 记忆系统，跨会话知识持久化 |
| ⭐⭐⭐⭐ | `state/` | AppState，全局状态的单一来源 |
| ⭐⭐⭐ | `entrypoints/` | CLI/SDK/MCP 入口，程序启动点 |
| ⭐⭐⭐ | `commands/` | 105+ 子命令，用户可见功能 |
| ⭐⭐⭐ | `services/mcp/` | MCP 客户端，外部工具扩展能力 |
| ⭐⭐⭐ | `services/tools/` | 工具编排与并发执行 |
| ⭐⭐⭐ | `query/` | query loop 子模块（tokenBudget、stopHooks 等） |
| ⭐⭐⭐ | `bootstrap/` | 启动初始化，session state 预加载 |
| ⭐⭐ | `components/` | 终端 UI 组件，交互体验层 |
| ⭐⭐ | `hooks/` | React hooks，UI 与业务逻辑桥接 |
| ⭐⭐ | `skills/` | Skill 系统，可复用工作流 |
| ⭐⭐ | `plugins/` | 插件系统，第三方扩展 |
| ⭐⭐ | `coordinator/` | 多 Agent 编排 |
| ⭐⭐ | `types/` | TypeScript 类型定义 |
| ⭐⭐ | `schemas/` | Zod schema |
| ⭐⭐ | `context/` | React Context |
| ⭐⭐ | `cli/` | print 模式、结构化 IO |
| ⭐ | `screens/` | 顶层页面组件 |
| ⭐ | `ink/` | 终端 UI 基础设施 |
| ⭐ | `tasks/` | 后台任务管理 |
| ⭐ | `vim/` | Vim 输入模式 |
| ⭐ | `bridge/` | 远程机器控制 |
| ⭐ | `assistant/` | Kairos 长会话模式 |
| ⭐ | `remote/` | 远程会话支持 |
| ⭐ | `server/` | 服务端组件 |
| ⭐ | `migrations/` | 配置迁移 |
| ⭐ | `keybindings/` | 键盘快捷键 |
| ⭐ | `constants/` | 常量配置 |
| ⭐ | `outputStyles/` | 输出样式 |
| ⭐ | `moreright/` | 右侧面板 UI |
| ⭐ | `native-ts/` | 原生模块 TS 替代 |
| ⭐ | `stubs/` | 构建用桩文件 |
| ⭐ | `sdk/` | SDK 类型导出 |
| ⭐ | `upstreamproxy/` | 上游代理 |
| ⭐ | `voice/` | 语音功能 |
| ⭐ | `buddy/` | 虚拟宠物（彩蛋） |

---

## 核心功能

### 运行模式

| 模式 | 说明 |
|------|------|
| **REPL 交互模式** | 终端内与 Claude 对话，支持上下文持久化 |
| **命令模式** | 独立子命令（commit、PR review 等） |
| **Agent 模式** | 后台自主执行任务 |
| **Plan 模式** | 结构化任务规划，需用户审批后执行 |
| **Bridge 模式** | 控制远程机器 |
| **Coordinator 模式** | 多 Agent 编排与协调 |

### 主要子命令（共 105+）

| 类别 | 示例命令 |
|------|---------|
| 会话管理 | `init`、`resume`、`login`、`logout`、`status` |
| Git / GitHub | `commit`、`branch`、`review`、`autofix-pr`、`pr_comments` |
| 代码辅助 | `doctor`、`clear`、`cost`、`memory`、`context` |
| 配置 | `config`、`settings`、`keybindings`、`theme` |
| 高级功能 | `plan`、`skills`、`tasks`、`bridge`、`mcp` |

### 工具系统（共 49 个）

AI 在执行任务时可调用的工具：

| 工具 | 功能 |
|------|------|
| `BashTool` | 执行 Shell 命令 |
| `FileReadTool` | 读取文件内容 |
| `FileWriteTool` | 写入 / 创建文件 |
| `FileEditTool` | 精确编辑文件片段 |
| `GlobTool` | 按模式查找文件 |
| `GrepTool` | 正则搜索文件内容 |
| `WebFetchTool` | 抓取网页内容 |
| `WebSearchTool` | 网络搜索 |
| `WebBrowserTool` | 浏览器自动化 |
| `MCPTool` | 调用 MCP 服务器 |
| `AgentTool` | 派生子 Agent |
| `SkillTool` | 执行注册的 Skill |
| `TaskCreateTool` | 创建任务 |
| `NotebookEditTool` | 编辑 Jupyter Notebook |

---

## 技术架构

### UI 层

使用 **React + Ink** 在终端中渲染交互式 UI，支持输入框、对话框、进度条、代码高亮等组件，实现了类似 Web 应用的组件化开发体验。

### 工具权限系统

每个工具调用都经过权限检查，支持四种模式：

- `auto` — 自动允许低风险操作
- `ask` — 高风险操作前询问用户
- `allow` — 全部允许
- `deny` — 全部拒绝

### MCP（Model Context Protocol）

内置完整的 MCP 客户端，可连接外部 MCP 服务器来扩展工具能力，支持服务器生命周期管理、资源发现和命令执行。

### 认证体系

支持多种认证方式：

- **OAuth**（claude.ai）
- **AWS Bedrock**（STS / SSO）
- **Azure Identity**
- **GCP 凭证**
- **GitHub CLI** 集成

### 插件与 Skill 系统

- **插件**：可扩展核心功能，支持版本管理
- **Skill**：可复用的工作流单元，用户可自定义并通过 `/skill-name` 触发

### 状态持久化

- 会话状态快照，支持中断恢复（`resume` 命令）
- 凭证通过 macOS Keychain 安全存储
- 支持 MDM（Mobile Device Management）企业策略

---

## 构建与开发

```bash
# 开发模式（直接运行 TypeScript）
npm run dev

# 生产构建（输出 dist/cli.js）
npm run build
```

**构建工具**：Bun，目标平台 Node.js CommonJS。支持 10+ 个特性开关（Feature Flags），在构建时通过死代码消除开启或关闭 COORDINATOR、KAIROS、BRIDGE_MODE 等大型功能模块。

**主要依赖**：

| 包 | 用途 |
|----|------|
| `@anthropic-ai/sdk` | Claude API 客户端 |
| `@modelcontextprotocol/sdk` | MCP 协议支持 |
| `react` + `ink` | 终端 UI 渲染 |
| `commander` | CLI 参数解析 |
| `zod` | Schema 校验 |
| `@opentelemetry/*` | 可观测性 / 链路追踪 |
| `ws` | WebSocket 支持 |
| `marked` + `highlight.js` | Markdown 与代码高亮 |

---

## 扩展性设计

1. **插件系统**：第三方插件可注册新命令和工具
2. **MCP 服务器**：通过标准协议接入任意外部服务
3. **自定义 Skill**：用户定义可复用的工作流，在对话中直接调用
4. **Feature Flags**：构建时按需裁剪功能，适配不同部署场景
5. **多 Agent 协调**：Coordinator 模式支持多个 Agent 并行协作完成复杂任务
