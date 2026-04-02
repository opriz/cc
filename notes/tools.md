# Tools 系统解读

## 整体设计

工具系统是 Claude Code agentic loop 的"手"。Claude 通过 `tool_use` block 调用工具，工具执行后把结果作为 `tool_result` 返回给 Claude，循环继续。

所有工具都实现同一个 `Tool<Input, Output, Progress>` 接口，通过 `buildTool()` 工厂函数构建。

---

## Tool 接口核心方法

```typescript
type Tool<Input, Output, Progress> = {
  // === 身份 ===
  name: string
  aliases?: string[]          // 向后兼容的旧名称

  // === 执行 ===
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>
  description(input, options): Promise<string>   // 动态描述，发给 Claude
  prompt(options): Promise<string>               // 注入 system prompt 的工具说明

  // === Schema ===
  inputSchema: ZodSchema      // 用 Zod 定义，自动生成 JSON Schema 发给 API
  outputSchema?: ZodSchema

  // === 权限与安全 ===
  isEnabled(): boolean
  isReadOnly(input): boolean
  isDestructive?(input): boolean
  isConcurrencySafe(input): boolean    // false = 不能并行执行
  checkPermissions(input, context): Promise<PermissionResult>
  validateInput?(input, context): Promise<ValidationResult>
  preparePermissionMatcher?(input): Promise<(pattern: string) => boolean>

  // === 行为控制 ===
  interruptBehavior?(): 'cancel' | 'block'  // 用户发新消息时怎么处理
  maxResultSizeChars: number    // 超出则持久化到磁盘，Claude 收到文件路径
  shouldDefer?: boolean         // true = 需要先用 ToolSearch 才能调用
  alwaysLoad?: boolean          // true = 始终出现在 prompt，不 defer

  // === UI 渲染（React/Ink）===
  renderToolUseMessage(input, options): ReactNode       // 调用时显示什么
  renderToolResultMessage?(output, progress, options): ReactNode  // 结果显示
  renderToolUseProgressMessage?(progress, options): ReactNode     // 执行中进度
  renderToolUseRejectedMessage?(input, options): ReactNode        // 被拒绝时
  renderGroupedToolUse?(toolUses, options): ReactNode             // 多个并行时

  // === 辅助 ===
  userFacingName(input): string
  getActivityDescription?(input): string | null  // spinner 文案
  toAutoClassifierInput(input): unknown          // 安全分类器用
  mapToolResultToToolResultBlockParam(content, toolUseID): ToolResultBlockParam
}
```

---

## buildTool() 工厂函数

所有工具通过 `buildTool()` 构建，它提供安全的默认值（**fail-closed 原则**）：

```typescript
const TOOL_DEFAULTS = {
  isEnabled:         () => true,
  isConcurrencySafe: () => false,   // 默认不能并行（保守）
  isReadOnly:        () => false,   // 默认有写操作（保守）
  isDestructive:     () => false,
  checkPermissions:  () => ({ behavior: 'allow' }),  // 默认允许，具体工具可覆盖
  toAutoClassifierInput: () => '',  // 默认跳过安全分类
  userFacingName:    () => name,
}
```

工具定义只需要写差异部分：

```typescript
export const GlobTool = buildTool({
  name: 'Glob',
  inputSchema: z.object({ pattern: z.string(), path: z.string().optional() }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  async call(args, context) { ... },
  async description() { return '...' },
  // ... 其他方法
})
```

---

## 全部工具分类（45个）

### 文件操作
| 工具 | 读/写 | 说明 |
|------|------|------|
| `FileReadTool` | 只读 | 读文件内容，支持图片、PDF、Notebook |
| `FileWriteTool` | 写 | 创建/覆盖文件 |
| `FileEditTool` | 写 | 精确字符串替换（old_string → new_string） |
| `GlobTool` | 只读 | 按 glob 模式查找文件 |
| `GrepTool` | 只读 | 正则搜索文件内容（ripgrep） |
| `NotebookEditTool` | 写 | 编辑 Jupyter Notebook cell |

### 代码执行
| 工具 | 说明 |
|------|------|
| `BashTool` | 执行 shell 命令，有超时、沙箱、权限控制 |
| `PowerShellTool` | Windows 下的 Bash 替代 |
| `REPLTool` | 代码 REPL（当前 stub，disabled） |

### 网络
| 工具 | 说明 |
|------|------|
| `WebFetchTool` | 抓取网页，HTML 转 Markdown |
| `WebSearchTool` | 网络搜索 |
| `RemoteTriggerTool` | 调用远程触发器 API |

### Agent 与任务
| 工具 | 说明 |
|------|------|
| `AgentTool` | 派生子 Agent，核心 multi-agent 工具 |
| `TaskCreateTool` | 创建任务 |
| `TaskUpdateTool` | 更新任务状态 |
| `TaskListTool` | 列出任务 |
| `TaskGetTool` | 获取任务详情 |
| `TaskOutputTool` | 获取后台任务输出 |
| `TaskStopTool` | 停止后台任务 |
| `SendMessageTool` | 向用户发送消息 |
| `ScheduleCronTool` | 创建定时任务 |
| `SleepTool` | 等待（当前 stub，disabled） |

### MCP
| 工具 | 说明 |
|------|------|
| `MCPTool` | 调用 MCP 服务器工具 |
| `ListMcpResourcesTool` | 列出 MCP 资源 |
| `ReadMcpResourceTool` | 读取 MCP 资源 |
| `McpAuthTool` | MCP 认证 |

### Plan 模式
| 工具 | 说明 |
|------|------|
| `EnterPlanModeTool` | 进入 Plan 模式 |
| `ExitPlanModeTool` | 退出 Plan 模式（用户审批） |
| `VerifyPlanExecutionTool` | 校验计划执行（stub） |

### Worktree
| 工具 | 说明 |
|------|------|
| `EnterWorktreeTool` | 创建并进入 git worktree |
| `ExitWorktreeTool` | 退出 worktree |

### UI 交互
| 工具 | 说明 |
|------|------|
| `AskUserQuestionTool` | 向用户提问（选项式） |
| `TodoWriteTool` | 写 Todo 列表（更新侧边面板） |
| `BriefTool` | 生成简报 |
| `ConfigTool` | 读写配置 |

### 开发辅助
| 工具 | 说明 |
|------|------|
| `LSPTool` | 语言服务器协议集成 |
| `SkillTool` | 执行注册的 Skill |
| `ToolSearchTool` | 搜索 deferred 工具 |
| `SyntheticOutputTool` | 结构化输出（JSON Schema 模式） |

### 内部/实验性
| 工具 | 说明 |
|------|------|
| `TungstenTool` | 内部监控（stub） |
| `SuggestBackgroundPRTool` | 后台 PR 建议（stub） |
| `WorkflowTool` | 工作流（stub） |
| `TeamCreateTool` / `TeamDeleteTool` | 团队管理 |

---

## 权限系统

每次工具调用走这个流程：

```
validateInput()          # 工具自定义的输入校验（前置拦截）
  ↓
canUseTool()             # 通用权限检查（mode + rules + hooks）
  ├── 'allow'  → 直接执行
  ├── 'ask'    → 弹出权限对话框，等用户确认
  └── 'deny'   → 拒绝，返回错误给 Claude
  ↓
call()                   # 实际执行
```

`PermissionMode` 有四种：
- `default` — 危险操作问用户，安全操作自动允许
- `acceptEdits` — 文件编辑自动允许，其他危险操作仍问
- `bypassPermissions` — 全部允许（沙箱/CI 用）
- `plan` — 只读操作允许，写操作拒绝

工具可以通过 `checkPermissions()` 实现自定义逻辑，也可以通过 `preparePermissionMatcher()` 支持 hook 规则里的模式匹配（如 `Bash(git *)`）。

---

## 并发与中断

**并发安全**：`isConcurrencySafe()` 返回 `true` 的工具可以并行执行（如 GlobTool、GrepTool、FileReadTool）。`false` 的工具串行执行（如 BashTool、FileWriteTool）。

**中断行为**：用户发新消息时：
- `cancel` — 立即停止工具，丢弃结果（适合搜索类）
- `block` — 继续执行，新消息等工具完成（默认，适合写操作）

**结果大小限制**：`maxResultSizeChars` 超出时，结果持久化到磁盘，Claude 收到文件路径而不是完整内容。`Infinity` 表示永不持久化（FileReadTool 自己管理大小）。

---

## Deferred Tools（工具延迟加载）

当工具数量多时，把不常用的工具标记为 `shouldDefer: true`，不在初始 prompt 里发送完整 schema，只发一个占位描述。Claude 需要先调用 `ToolSearchTool` 搜索并加载具体工具，再调用它。

这减少了 prompt token 消耗，但增加了一次 round-trip。`alwaysLoad: true` 的工具始终出现在初始 prompt 里，不受 defer 影响。

---

## 工具文件结构

每个工具目录通常包含：

```
tools/BashTool/
  ├── BashTool.tsx         # 工具主体实现
  ├── prompt.ts            # system prompt 里的工具说明文本
  ├── UI.tsx               # React 渲染组件
  ├── bashPermissions.ts   # 权限逻辑
  └── ...                  # 其他辅助模块
```

UI 渲染（`renderToolUseMessage` 等）直接在工具定义里，工具自己负责如何在终端显示——这是 Claude Code 工具系统和普通 tool-use 框架最大的区别之一。
