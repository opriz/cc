# QueryEngine.ts 解读

## 整体定位

`QueryEngine` 是**一次对话的生命周期管理器**，封装了从"用户输入"到"最终结果"的完整流程。

- 一个实例对应一个会话
- 每次调用 `submitMessage()` 是这个会话里的一个新 turn
- 核心职责：把底层的 `query()`（真正的 agentic loop）包一层，处理会话状态、持久化、权限追踪、预算控制等横切关注点

---

## 核心状态

```typescript
class QueryEngine {
  private mutableMessages: Message[]      // 整个会话的消息历史（memory 的实现）
  private abortController: AbortController // 中断控制
  private permissionDenials: []           // 被拒绝的工具调用记录
  private totalUsage: NonNullableUsage    // 累计 token 用量
  private discoveredSkillNames: Set       // 本轮发现的 skill（用于 telemetry）
  private loadedNestedMemoryPaths: Set    // 已加载的嵌套 memory 路径
}
```

`mutableMessages` 贯穿整个生命周期，每个 turn 的消息都 push 进去，这就是 memory 的实现方式。

---

## `submitMessage()` 执行流程

这是一个 `AsyncGenerator`，用 `yield` 流式输出消息，调用方可以边执行边消费结果。

```
1. 初始化
   ├── 包装 canUseTool（追踪权限拒绝）
   ├── 构建 system prompt（默认 + 自定义 + memory mechanics）
   └── 处理 orphaned permission（遗留的未处理权限请求）

2. 处理用户输入
   └── processUserInput() — 解析 /slash 命令、附件、普通文本
       ├── 如果是 /slash 命令 → 本地执行，不走 API，直接 yield 结果返回
       └── 如果是普通 prompt → 继续往下

3. 持久化用户消息（写 transcript）

4. 加载 skills 和 plugins（仅读缓存，不走网络）

5. yield systemInitMessage（告知 SDK 当前工具/模型/权限配置）

6. 核心 agentic loop
   └── for await (message of query(...))  ← 真正的循环在 query.ts
       ├── assistant 消息 → push + yield
       ├── user 消息（tool result）→ push + yield + turnCount++
       ├── stream_event → 累计 token 用量，可选 yield 流式事件
       ├── progress → push + yield（工具执行进度）
       ├── system/compact_boundary → 内存压缩，释放旧消息
       └── attachment/max_turns_reached → yield error result，return

7. 预算检查（每条消息后）
   ├── maxBudgetUsd 超限 → yield error_max_budget_usd，return
   └── structured output 重试超限 → yield error_max_structured_output_retries，return

8. 最终 yield result
   ├── success → 提取最后一条 assistant 文本
   └── error_during_execution → 包含诊断信息
```

---

## 消息类型

比 OpenClaw 标准的 `user/assistant/tool` 更丰富：

| 类型 | 说明 |
|------|------|
| `assistant` | Claude 的回复，含 text / tool_use / thinking block |
| `user` | 用户输入或 tool_result |
| `progress` | 工具执行中的实时进度 |
| `stream_event` | 流式 token 事件（message_start / message_delta / message_stop） |
| `attachment` | 结构化附件（structured output、max_turns 信号、queued_command 等） |
| `system/compact_boundary` | 上下文压缩边界，压缩后旧消息从内存释放 |
| `tombstone` | 消息删除控制信号，直接跳过 |

---

## 与 OpenClaw agentic loop 的对比

**agentic loop 在 `query.ts`，不在这里**

`QueryEngine` 只是外壳。真正的"发请求 → 收 tool_use → 执行工具 → 把结果喂回去"循环在 `query.ts`。这里只消费 `query()` 的输出并做持久化/预算控制。

**生成器模式（AsyncGenerator）**

整个 `submitMessage` 是 `async function*`，每条消息通过 `yield` 流出。调用方可以流式处理，不需要等全部完成再拿结果——对长任务的 UI 实时更新很关键。

**内置预算控制**

```typescript
if (maxBudgetUsd !== undefined && getTotalCost() >= maxBudgetUsd) {
  yield { type: 'result', subtype: 'error_max_budget_usd', ... }
  return
}
```

每条消息处理完都检查一次，超限立即终止。OpenClaw 没有内置，需要自己实现。

**三态权限系统**

`canUseTool` 是注入进来的函数，每次工具调用前都会问"能不能用"，结果是 `allow / ask / deny` 三态。被拒绝的调用记录在 `permissionDenials` 里，最终附在 result 里返回给调用方。

**上下文压缩（compact）**

当消息历史过长时，`system/compact_boundary` 触发压缩，旧消息从 `mutableMessages` 中释放（GC），只保留压缩边界之后的消息。这是长会话内存管理的关键机制。

---

## 终止条件

`submitMessage()` 在以下情况提前终止（`return`）：

| 条件 | result subtype |
|------|---------------|
| `/slash` 命令（不需要 API） | `success` |
| 达到最大 turn 数 | `error_max_turns` |
| 超过 USD 预算 | `error_max_budget_usd` |
| structured output 重试超限 | `error_max_structured_output_retries` |
| 最后一条消息不是合法的结束状态 | `error_during_execution` |
| 正常完成 | `success` |

---

## 下一步

`QueryEngine` 把真正的循环委托给 `query.ts`（`import { query } from './query.js'`）。那里才是 tool_use 的核心：Claude 返回 `tool_use` block → 执行工具 → 把 `tool_result` 喂回去 → 循环直到 `stop_reason === 'end_turn'`。
