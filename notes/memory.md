# 记忆工程解读

## 整体架构

Claude Code 的记忆系统分三层：

```
System Prompt（每次会话加载）
  └── MEMORY.md 索引（始终注入，最多200行）

Relevant Memory Prefetch（每个 turn 动态召回）
  └── Sonnet 选择 ≤5 个相关 topic 文件 → 注入为 attachment

Memory Files（持久化存储）
  └── ~/.claude/projects/<project>/memory/*.md
```

---

## 存储位置

```
~/.claude/projects/<sanitized-git-root>/memory/
  ├── MEMORY.md              # 索引文件，始终加载
  ├── user_role.md           # 具体 memory 文件
  ├── feedback_testing.md
  └── ...
```

路径解析优先级：
1. `CLAUDE_COWORK_MEMORY_PATH_OVERRIDE` 环境变量（Cowork 专用）
2. `settings.json` 里的 `autoMemoryDirectory`（仅信任来源：policy/local/user，不含 projectSettings）
3. 默认：`~/.claude/projects/<sanitized-git-root>/memory/`

**安全设计**：`projectSettings`（仓库内的 `.claude/settings.json`）被明确排除，防止恶意仓库将 memory 目录指向 `~/.ssh` 等敏感路径。

---

## Memory 文件格式

每个 memory 文件有 frontmatter：

```markdown
---
name: 文件名称
description: 一行描述（用于 Sonnet 召回时判断相关性）
type: user | feedback | project | reference
---

具体内容...
```

`MEMORY.md` 是索引，不是 memory 本身，每行一条指针：
```
- [标题](file.md) — 一行说明
```

---

## 四种 Memory 类型

| 类型 | 存什么 | 何时读 |
|------|--------|--------|
| `user` | 用户角色、偏好、知识背景 | 需要了解用户时 |
| `feedback` | 用户对 Claude 行为的纠正或确认 | 避免重复错误 |
| `project` | 项目上下文、决策、截止日期 | 理解任务背景时 |
| `reference` | 外部系统的位置指针（Linear、Grafana 等） | 需要查外部资源时 |

**不存的内容**：代码模式、架构、git 历史、调试方案、临时任务状态——这些可以从代码或 git 直接获取。

---

## MEMORY.md 的加载方式

每次会话启动时，`loadMemoryPrompt()` 把 MEMORY.md 内容注入 system prompt：

```typescript
// memdir.ts
export async function loadMemoryPrompt(): Promise<string | null> {
  // 普通模式：注入 buildMemoryLines() + MEMORY.md 内容
  // KAIROS 模式：改为 append-only 日志模式
  // TEAMMEM 模式：同时加载个人 + 团队两个目录
}
```

**截断保护**：
- 行数上限：200 行（超出截断并附警告）
- 字节上限：25,000 bytes
- 超出时提示 Claude 精简索引条目

---

## 动态召回（Relevant Memory Prefetch）

这是记忆系统最精巧的部分。每个 turn 开始时，在 Claude 还在流式输出的同时，**后台并行**用 Sonnet 检索相关 memory：

### 流程

```
query.ts 进入 while(true)
  ↓
startRelevantMemoryPrefetch(messages, toolUseContext)
  ├── 取最后一条用户消息作为查询
  ├── 后台启动 Promise（不阻塞主流程）
  └── 返回 handle（含 settledAt 时间戳）

↓ 同时进行：Claude API 流式调用（5-30秒）

工具执行完毕后：
  ├── 检查 prefetch 是否已 settled
  ├── 如果 settled → 消费结果，注入为 attachment
  └── 如果未 settled → 跳过（下一轮再试）
```

### Sonnet 召回逻辑

```
scanMemoryFiles()          # 扫描所有 .md 文件，读 frontmatter（只读前30行）
  ↓
formatMemoryManifest()     # 格式化为文本列表：[type] filename (timestamp): description
  ↓
sideQuery(Sonnet)          # 问 Sonnet：哪些 memory 对这个查询有用？
  ↓
返回 ≤5 个文件路径
  ↓
readMemoriesForSurfacing() # 读取文件内容，注入为 <system-reminder> attachment
```

Sonnet 的系统提示明确要求：
- 只选"明确有用"的，不确定就不选
- 最多 5 个
- 如果用户最近在用某工具，不要选该工具的参考文档（因为已经在用了）
- 但**要**选关于该工具的 warning/gotcha（正在用时最需要）

### 去重机制

- `alreadySurfaced`：本次会话已经注入过的 memory 路径，不重复选
- `readFileState`：模型已经通过 FileReadTool 读过的文件，不重复注入
- compact 后自然重置（旧 attachment 消失，可以重新召回）

### 限流

- 单条 memory 文件：最多 100 行 / 10KB
- 整个会话：`MAX_SESSION_BYTES`（防止 memory 撑爆 context）
- 单词提示（无空格）：不触发召回

---

## 写入时机

Claude 决定写 memory 时，直接调用 `Write` 工具写文件。系统提示里有完整的两步指引：

1. 写 topic 文件（带 frontmatter）
2. 在 `MEMORY.md` 里加一行索引

**`EXTRACT_MEMORIES` 后台 Agent**（可选功能）：会话结束后，后台运行一个专门的 Agent 检查对话，自动提取值得记忆的内容写入 memory 目录。主 Agent 没写的，它来补。

---

## 三种运行模式

| 模式 | 触发条件 | 写入方式 |
|------|---------|---------|
| **普通模式** | 默认 | 主 Agent 直接写文件，MEMORY.md 作索引 |
| **KAIROS 模式** | `feature('KAIROS')` + 长会话 | append-only 日志（`logs/YYYY/MM/YYYY-MM-DD.md`），夜间 `/dream` skill 蒸馏成 MEMORY.md |
| **TEAMMEM 模式** | `feature('TEAMMEM')` | 个人目录 + 团队共享目录，两套 memory 并存 |

---

## 与 OpenClaw 的对比

OpenClaw 的 memory 通常是简单的 key-value 存储或单文件追加。Claude Code 的设计要复杂得多：

- **索引 + topic 文件分离**：MEMORY.md 是轻量索引，详细内容在独立文件，避免一次性加载所有内容
- **Sonnet 语义召回**：不是简单的关键词匹配，而是用 LLM 判断相关性
- **异步预取**：召回在 Claude 流式输出期间并行进行，零额外延迟
- **类型分类**：user/feedback/project/reference 四种类型，引导 Claude 存什么、怎么用
- **安全边界**：memory 目录有写权限白名单，防止被恶意仓库劫持
