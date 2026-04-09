# Claude Code 上下文工程 (Context Engineering)

本文档总结 Claude Code 中上下文管理的核心实现机制。

## 1. 系统提示词构建 (System Prompt Building)

### 1.1 系统提示词结构

系统提示词采用**分层优先级**构建（`utils/systemPrompt.ts`）：

```
优先级 0: Override System Prompt (环境变量设置，替换所有其他提示词)
优先级 1: Coordinator System Prompt (协调器模式)
优先级 2: Agent System Prompt (代理模式)
  - 主动模式：追加到默认提示词
  - 普通模式：替换默认提示词
优先级 3: Custom System Prompt (--system-prompt 参数)
优先级 4: Default System Prompt (标准 Claude Code 提示词)
+ appendSystemPrompt (始终追加在最后，除非 override 设置)
```

### 1.2 动态边界分隔

`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` (`constants/prompts.ts`) 是关键的缓存优化标记：

- **标记之前**：静态内容，可跨组织缓存 (`scope: 'global'`)
- **标记之后**：用户/会话特定内容，不应缓存

这允许 Anthropic 的全局缓存系统复用大部分系统提示词前缀。

### 1.3 系统提示词段落缓存

`systemPromptSections.ts` 实现了段落级别的缓存机制：

```typescript
// 缓存型段落（默认）
systemPromptSection(name, compute)  // 计算一次，缓存到 /clear 或 /compact

// 非缓存型段落（谨慎使用，会破坏提示词缓存）
DANGEROUS_uncachedSystemPromptSection(name, compute, reason)
```

## 2. 上下文压缩 (Context Compaction)

### 2.1 自动压缩 (Auto-compact)

`services/compact/autoCompact.ts` 实现了基于令牌阈值的自动压缩：

```typescript
// 有效上下文窗口 = 模型窗口 - 摘要输出预留
getEffectiveContextWindowSize(model)

// 自动压缩阈值 = 有效窗口 - 13K 缓冲区
getAutoCompactThreshold(model)

// 警告/错误阈值层级
- 警告阈值: 阈值 - 20K
- 错误阈值: 阈值 - 20K
- 阻塞限制: 有效窗口 - 3K
```

**连续失败熔断器**：超过 3 次连续失败则停止尝试，避免对不可恢复的上下文浪费 API 调用。

### 2.2 微压缩 (Micro-compact)

`services/compact/microCompact.ts` 提供了细粒度的工具结果清理：

**可压缩工具列表**：
- FileRead, FileEdit, FileWrite
- Bash (所有 shell 工具)
- Glob, Grep
- WebSearch, WebFetch

**两种实现路径**：

1. **缓存编辑路径** (`CACHED_MICROCOMPACT` feature):
   - 使用 Anthropic 缓存编辑 API
   - 不修改本地消息内容
   - 通过 `cache_edits` 块在 API 层删除工具结果
   - 保留缓存前缀的有效性

2. **基于时间的清理** (`timeBasedMicrocompact`):
   - 触发条件：距上次助手消息超过阈值（默认 5 分钟）
   - 清除除最近 N 个外的所有可压缩工具结果
   - 替换为 `[Old tool result content cleared]` 占位符

### 2.3 完整压缩 (Full Compact)

`services/compact/compact.ts` 生成对话摘要：

**压缩前准备**：
- 剥离图片块（避免压缩 API 调用超限）
- 按 API 轮次分组消息
- 执行预压缩钩子

**压缩后恢复**：
- 最多恢复 5 个文件读取结果
- 令牌预算：50K 总量 / 5K 每文件
- 技能重注入：25K 总量 / 5K 每技能

**压缩边界消息**：
```typescript
SystemCompactBoundaryMessage: {
  type: 'system',
  systemMessageType: 'compact_boundary',
  direction: 'above' | 'below',
  summaryForBelow?: string,  // 对后续消息的摘要
  filesRestored?: string[],   // 恢复的文件列表
}
```

## 3. 记忆系统 (Memory System)

### 3.1 记忆类型

四种受控记忆类型 (`memdir/memoryTypes.ts`)：

| 类型 | 作用域 | 用途 |
|------|--------|------|
| `user` | 私有 | 用户角色、技能、偏好 |
| `feedback` | 私有/团队 | 工作方式指导（正反反馈） |
| `project` | 团队优先 | 项目状态、截止日期、决策 |
| `reference` | 团队 | 外部系统指针（Linear、Slack、Grafana） |

**不应保存的内容**：
- 代码模式/架构（可通过 grep/git 推导）
- Git 历史（`git log` 为准）
- 调试解决方案（已在代码中）
- CLAUDE.md 已记录的内容
- 临时任务状态

### 3.2 文件结构

```
~/.claude/projects/<slug>/
├── memory/
│   ├── MEMORY.md          # 索引文件（无 frontmatter，单行条目）
│   ├── user_role.md       # 记忆文件（frontmatter + 内容）
│   ├── feedback_*.md
│   └── ...
└── team/                  # 团队共享记忆（TEAMMEM feature）
    └── memory/
```

**MEMORY.md 截断策略**：
- 行数限制：200 行
- 字节限制：25KB
- 优先按行截断，再按字节截断（在换行处切割）

### 3.3 CLAUDE.md 文件加载

`utils/claudemd.ts` 实现了分层加载策略：

**加载顺序**（后到者优先级高）：
1. Managed memory (`/etc/claude-code/CLAUDE.md`)
2. User memory (`~/.claude/CLAUDE.md`)
3. Project memory (`CLAUDE.md`, `.claude/CLAUDE.md`)
4. Local memory (`CLAUDE.local.md`)
5. 嵌套目录规则 (`.claude/rules/*.md`)

**规则文件**：
- **无条件规则**：全局生效
- **条件规则**：通过 frontmatter `glob:` 模式匹配目标文件路径

**@include 指令**：
```markdown
# 支持语法
@./relative/path
@~/home/path
@/absolute/path
@path  (等同于 @./path)

# 仅适用于叶子文本节点（不在代码块内）
# 防止循环引用
```

## 4. 上下文分析 (Context Analysis)

### 4.1 令牌计数策略

`utils/analyzeContext.ts` 实现了多级令牌计数：

1. **API 计数** (首选): Anthropic 官方令牌计数 API
2. **Haiku 回退**: 当 API 返回 null 时使用 Haiku 模型估算
3. **粗略估算**: 基于字符数的快速估算 (4/3 系数保守估计)

**工具定义令牌计数**：减去 500 令牌 API 开销（每个工具调用包含的固定开销）

### 4.2 上下文数据分类

```typescript
ContextData {
  categories: ContextCategory[]     // 分类令牌统计
  totalTokens: number
  maxTokens: number
  percentage: number               // 使用率百分比
  gridRows: GridSquare[][]         // 可视化网格
  memoryFiles: MemoryFile[]        // 记忆文件列表
  mcpTools: McpTool[]              // MCP 工具统计
  deferredBuiltinTools?: DeferredBuiltinTool[]  // 延迟加载工具
  systemTools?: SystemToolDetail[] // 系统工具详情
  systemPromptSections?: SystemPromptSectionDetail[] // 系统提示词段落
  agents: Agent[]                  // 代理定义
  skills?: SkillInfo               // 技能统计
  messageBreakdown?: {             // 消息详细分解
    toolCallTokens, toolResultTokens,
    attachmentTokens, assistantMessageTokens,
    userMessageTokens, toolCallsByType, attachmentsByType
  }
}
```

### 4.3 上下文可视化

使用颜色编码的网格系统：
- 每格代表 1% 上下文窗口
- 颜色对应不同类别（系统提示词、工具、消息等）
- 填充度显示该格的填充比例

## 5. 消息处理管道

### 5.1 消息规范化

`utils/messages.ts` 提供了多种消息转换：

- `normalizeMessagesForAPI()`: 转换为 API 格式
- `stripImagesFromMessages()`: 剥离图片（用于压缩）
- `ensureToolResultPairing()`: 确保 tool_use/tool_result 配对
- `createCompactBoundaryMessage()`: 创建压缩边界

### 5.2 粘贴内容处理

历史记录中的粘贴内容管理 (`history.ts`)：

```typescript
// 引用格式
[Pasted text #1 +10 lines]  // 多行文本
[Image #2]                  // 图片

// 存储策略
- 小内容 (<1KB): 内联存储
- 大内容: 哈希引用，异步写入 paste store
```

### 5.3 附件系统

`utils/attachments.ts` 支持多种附件类型：

- 文件附件 (`file_attachment`)
- 代理列表变更 (`agent_listing_delta`)
- MCP 指令 (`mcp_instructions`)
- 延迟工具加载 (`deferred_tools_delta`)
- 记忆头 (`memory_header`)
- 工具引用 (`tool_reference`)

## 6. 会话历史与恢复

### 6.1 历史记录存储

`history.ts` 实现了基于行的事务日志：

```typescript
LogEntry {
  display: string               // 显示文本
  pastedContents: Record<number, StoredPastedContent>
  timestamp: number
  project: string               // 项目路径
  sessionId?: string
}
```

**存储特性**：
- 全局历史文件：`~/.claude/history.jsonl`
- 文件锁定防止并发冲突
- 100 条目去重窗口
- 当前会话优先排序

### 6.2 远程会话历史

`assistant/sessionHistory.ts` 支持从云端获取历史：

```typescript
fetchLatestEvents(ctx, limit)   // 获取最新事件
fetchOlderEvents(ctx, beforeId) // 分页获取旧事件
```

## 7. 关键设计原则

### 7.1 缓存优化策略

1. **静态前缀缓存**：SYSTEM_PROMPT_DYNAMIC_BOUNDARY 之前的所有内容可全局缓存
2. **段落级缓存**：systemPromptSection 避免重复计算
3. **缓存编辑 API**：微压缩通过 cache_edits 而非内容修改来保留前缀缓存

### 7.2 降级策略

```
API 令牌计数失败
  → Haiku 模型估算
    → 字符数粗略估算 (× 4/3)
```

### 7.3 熔断机制

- **自动压缩**：连续 3 次失败后停止尝试
- **时间触发微压缩**：空闲 5 分钟后清除旧工具结果

### 7.4 安全边界

- 阻塞限制在有效窗口 -3K 令牌
- 始终保留 13K 自动压缩缓冲区
- 20K 警告/错误阈值提前预警

## 8. 相关文件索引

| 文件路径 | 职责 |
|---------|------|
| `constants/prompts.ts` | 系统提示词构建主入口 |
| `constants/systemPromptSections.ts` | 系统提示词段落缓存管理 |
| `utils/systemPrompt.ts` | 有效系统提示词组装 |
| `utils/context.ts` | 系统和用户上下文获取 |
| `utils/analyzeContext.ts` | 上下文分析和令牌统计 |
| `services/compact/autoCompact.ts` | 自动压缩触发逻辑 |
| `services/compact/microCompact.ts` | 微压缩/缓存编辑 |
| `services/compact/compact.ts` | 完整对话压缩 |
| `memdir/memdir.ts` | 记忆系统主逻辑 |
| `memdir/memoryTypes.ts` | 记忆类型定义和行为规范 |
| `utils/claudemd.ts` | CLAUDE.md 文件加载和处理 |
| `utils/messages.ts` | 消息规范化处理 |
| `history.ts` | 历史记录管理 |
