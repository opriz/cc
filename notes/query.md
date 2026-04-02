# query.ts 解读

## 整体定位

`query.ts` 是真正的 **agentic loop 核心**，也是 Claude Code 最复杂的文件之一。

- `QueryEngine.submitMessage()` 调用 `query()`，`query()` 调用 `queryLoop()`
- `queryLoop()` 是一个 `while(true)` 循环，每次迭代 = 一次 API 调用 + 工具执行
- 循环只有在 Claude 不再返回 `tool_use`（或遇到终止条件）时才退出

---

## 调用链

```
QueryEngine.submitMessage()
  └── query()                    # 薄包装，负责命令生命周期通知
        └── queryLoop()          # 真正的 while(true) 循环
              ├── 上下文压缩预处理
              ├── callModel()    # 调用 Claude API（流式）
              ├── 工具执行
              └── continue / return
```

---

## 每次循环迭代做什么

### 1. 上下文预处理（发请求前）

每次迭代开始时，对消息历史做一系列处理，目的是控制 token 数量：

```
getMessagesAfterCompactBoundary()   # 只取压缩边界之后的消息
  → applyToolResultBudget()         # 裁剪过大的工具返回值
  → snipCompactIfNeeded()           # HISTORY_SNIP: 删除旧的中间 turn
  → microcompact()                  # 微压缩: 合并重复的小工具调用
  → contextCollapse()               # 折叠不重要的历史段落
  → autocompact()                   # 超阈值时触发完整摘要压缩
```

这一层是 Claude Code 内存管理的核心，比 OpenClaw 复杂得多。

### 2. 调用 Claude API（流式）

```typescript
for await (const message of deps.callModel({ messages, systemPrompt, tools, ... })) {
  // 流式消费每个 content block
  if (message.type === 'assistant') {
    assistantMessages.push(message)
    if (有 tool_use block) {
      toolUseBlocks.push(...)
      needsFollowUp = true
    }
  }
  yield message  // 透传给上层
}
```

关键：`needsFollowUp = true` 是决定循环是否继续的信号——有 `tool_use` 就继续，没有就准备退出。

**Streaming Tool Executor（可选）**：如果开启，工具可以在 Claude 还在流式输出时就开始并行执行，而不是等 Claude 说完再执行。

### 3. 错误恢复（无工具调用时）

如果 `needsFollowUp = false`（Claude 没有调用工具），检查是否是可恢复的错误：

| 错误类型 | 恢复策略 |
|---------|---------|
| `prompt_too_long`（413） | 先尝试 context collapse drain，再尝试 reactive compact |
| `max_output_tokens` | 先尝试升级到 64k tokens 重试，再注入 meta 消息让 Claude 继续，最多 3 次 |
| 媒体文件过大 | reactive compact 删除图片/PDF 后重试 |
| API 错误 | 执行 stop failure hooks，返回 |

这些恢复路径都通过 `state = next; continue` 实现——重置状态，跳回 `while(true)` 顶部重试。

### 4. 工具执行

```typescript
const toolUpdates = streamingToolExecutor
  ? streamingToolExecutor.getRemainingResults()   // 流式并行执行
  : runTools(toolUseBlocks, ...)                  // 串行执行

for await (const update of toolUpdates) {
  yield update.message   // 透传工具结果给上层
  toolResults.push(...)  // 收集结果，准备喂回 API
}
```

### 5. 附件注入（工具执行后）

工具执行完后，在把结果喂回 Claude 之前，还会注入额外的上下文：

- **queued commands**：用户在 Claude 执行工具期间发来的新消息
- **memory prefetch**：相关的 memory 文件内容（后台预取，这里消费）
- **skill discovery**：发现的新 skill 定义

### 6. 决定是否继续

```typescript
// 检查 maxTurns
if (maxTurns && nextTurnCount > maxTurns) {
  yield createAttachmentMessage({ type: 'max_turns_reached', ... })
  return { reason: 'max_turns' }
}

// 继续下一轮
state = {
  messages: [...messagesForQuery, ...assistantMessages, ...toolResults],
  turnCount: nextTurnCount,
  ...
}
// while(true) 自动进入下一轮
```

---

## 循环状态（State 对象）

每次迭代之间通过 `state` 对象传递可变状态，`continue` 时重新赋值：

```typescript
type State = {
  messages: Message[]                  // 当前消息历史
  toolUseContext: ToolUseContext        // 工具执行上下文
  autoCompactTracking: ...             // 压缩追踪状态
  maxOutputTokensRecoveryCount: number // 已恢复次数（最多3次）
  hasAttemptedReactiveCompact: boolean // 防止无限 compact 循环
  maxOutputTokensOverride: number      // 升级到64k时设置
  pendingToolUseSummary: Promise<...>  // 上一轮工具摘要（Haiku生成）
  stopHookActive: boolean              // stop hook 是否激活
  turnCount: number                    // 当前 turn 计数
  transition: Continue | undefined     // 上一次 continue 的原因（调试用）
}
```

---

## 终止条件（return）

| 原因 | 触发场景 |
|------|---------|
| `completed` | 正常结束（Claude 没有调用工具，stop hooks 通过） |
| `blocking_limit` | context 超过硬限制且无法压缩 |
| `prompt_too_long` | 413 错误且所有恢复手段用尽 |
| `image_error` | 图片/媒体文件问题且无法恢复 |
| `max_turns` | 达到最大 turn 数 |
| `aborted_streaming` | 用户中断（流式阶段） |
| `aborted_tools` | 用户中断（工具执行阶段） |
| `hook_stopped` | hook 明确阻止继续 |
| `stop_hook_prevented` | stop hook 阻止 |
| `model_error` | API 抛出未处理异常 |

---

## 与 OpenClaw 的对比

**最大区别：上下文管理**

OpenClaw 的 agentic loop 通常只是简单地把所有消息历史传给 API。`query.ts` 在每次迭代前做了 5 层上下文处理（snip → microcompact → contextCollapse → autocompact → toolResultBudget），这是支撑长会话的关键。

**Stop Hooks**

每次 Claude 不再调用工具时，会先过一遍 stop hooks（`handleStopHooks`）——这些 hook 可以注入新的 user 消息让 Claude 继续工作，而不是立即结束。这相当于一个外部的"继续条件"检查层。

**Streaming Tool Execution**

工具可以在 Claude 还在流式输出时就开始执行（`StreamingToolExecutor`），减少等待时间。OpenClaw 通常是等 Claude 说完再执行工具。

**多层错误恢复**

`max_output_tokens` 有 3 次自动恢复机会，`prompt_too_long` 有 collapse drain + reactive compact 两层恢复，而不是直接报错。

---

## 关键依赖

| 模块 | 职责 |
|------|------|
| `deps.callModel()` | 调用 Claude API，流式返回消息 |
| `runTools()` / `StreamingToolExecutor` | 执行工具调用 |
| `deps.autocompact()` | 触发自动上下文压缩 |
| `deps.microcompact()` | 微压缩（合并小工具调用） |
| `handleStopHooks()` | 执行 stop hooks，决定是否继续 |
| `getAttachmentMessages()` | 收集 memory、queued commands 等附件 |
