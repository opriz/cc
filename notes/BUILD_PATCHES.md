# 构建补丁文件说明

相比上游 `claude-code`，本仓库新增了 50 个文件以支持本地构建。这些文件分三类。

---

## 一、构建配置（4 个）

| 文件 | 作用 |
|------|------|
| `build.ts` | Bun 构建入口，指定 entrypoint、feature flags、alias 映射、宏替换 |
| `tsconfig.json` | TypeScript 编译配置 |
| `package.json` | 依赖声明与 npm scripts |
| `package-lock.json` | 依赖锁定文件 |

`build.ts` 是核心，它做了两件关键的事：
1. 通过 `features` 列表开启/关闭功能模块（死代码消除）
2. 通过 `alias` 把无法安装的私有包重定向到本地 stub

---

## 二、依赖 Stub（9 个）

上游代码依赖多个无法在外部安装的包（Anthropic 内部包、需要原生编译的包）。`stubs/` 目录提供空实现让构建通过。

| Stub 文件 | 替换的包 | 实现方式 |
|-----------|---------|---------|
| `stubs/bedrock-sdk.ts` | `@anthropic-ai/bedrock-sdk` | 空构造函数 |
| `stubs/vertex-sdk.ts` | `@anthropic-ai/vertex-sdk` | 空构造函数 |
| `stubs/foundry-sdk.ts` | `@anthropic-ai/foundry-sdk` | 空构造函数 |
| `stubs/mcpb.ts` | `@anthropic-ai/mcpb` | 仅导出类型 |
| `stubs/sandbox-runtime.ts` | `@anthropic-ai/sandbox-runtime` | 空导出 |
| `stubs/ant-chrome-mcp.ts` | `@ant/claude-for-chrome-mcp` | `BROWSER_TOOLS = []` |
| `stubs/sharp.ts` | `sharp`（原生图像处理） | 调用时抛错 |
| `stubs/turndown.ts` | `turndown`（HTML→Markdown） | 原样返回 HTML |
| `stubs/mcpb.ts` | `@anthropic-ai/mcpb` | 仅导出类型 |

---

## 三、功能桩（37 个）

对应 `build.ts` 中注释掉的 feature flags，这些功能的源码在上游仓库中不完整或未公开，用最小实现占位以通过编译。

| 文件/目录 | 对应功能 | 占位方式 |
|-----------|---------|---------|
| `tools/REPLTool/` | REPL 代码执行工具 | `isEnabled()` 返回 `false` |
| `tools/SleepTool/` | 等待/延时工具 | `isEnabled()` 返回 `false` |
| `tools/TungstenTool/` | 内部监控工具 | `isEnabled()` 返回 `false` |
| `tools/SuggestBackgroundPRTool/` | 后台 PR 建议 | `isEnabled()` 返回 `false` |
| `tools/VerifyPlanExecutionTool/` | 计划执行校验 | `isEnabled()` 返回 `false` |
| `tools/WorkflowTool/` | 工作流工具 | 仅导出常量 |
| `services/contextCollapse/` | 上下文折叠服务 | 所有函数返回空值/false |
| `services/compact/cachedMicrocompact.ts` | 缓存压缩服务 | 空实现 |
| `services/compact/snipCompact.ts` | 片段压缩服务 | 空实现 |
| `assistant/AssistantSessionChooser.ts` | Kairos 助手会话选择 | 空实现 |
| `commands/agents-platform/` | Agents 平台命令 | 空实现 |
| `commands/assistant/` | 助手命令 | 空实现 |
| `components/agents/SnapshotUpdateDialog.ts` | Agent 快照更新对话框 | 空实现 |
| `coreTypes.generated.ts` | 生成的核心类型 | `export {}` |
| `entrypoints/sdk/coreTypes.generated.ts` | SDK 核心类型 | 生成类型 |
| `entrypoints/sdk/runtimeTypes.ts` | SDK 运行时类型 | 类型定义 |
| `entrypoints/sdk/toolTypes.ts` | SDK 工具类型 | 类型定义 |
| `sdk/runtimeTypes.ts` | 运行时类型 | 类型定义 |
| `sdk/toolTypes.ts` | 工具类型 | 类型定义 |
| `global.d.ts` / `ink/global.d.ts` | 全局类型声明 | 类型声明 |
| `devtools.ts` / `ink/devtools.ts` | 开发工具 | 空实现 |
| `protectedNamespace.ts` | 受保护命名空间 | 空实现 |
| `utils/protectedNamespace.ts` | 同上（utils 路径） | 空实现 |
| `types/connectorText.ts` | 连接器文本类型 | 类型定义 |
| `utils/filePersistence/types.ts` | 文件持久化类型 | 类型定义 |
| `utils/ultraplan/prompt.txt` | Ultraplan 提示词 | 空文本 |
| `skills/bundled/verify/` | Verify skill | Skill 定义文件 |
| `verify/` | Verify skill（根路径） | 同上 |
| `cachedMicrocompact.ts` | 缓存微压缩（根路径） | 空实现 |
| `stubs/` 其余文件 | 见上表 | — |

---

## 功能影响评估

### 受影响（有实质降级）

**AWS Bedrock / GCP Vertex / Azure Foundry**
- 影响：**完全不可用**，调用 API 时直接报错
- 触发条件：设置了 `CLAUDE_CODE_USE_BEDROCK=1`、`CLAUDE_CODE_USE_VERTEX=1` 或 `CLAUDE_CODE_USE_FOUNDRY=1`
- 不影响：使用标准 `ANTHROPIC_API_KEY` 的用户

**sharp — 图片处理**
- 影响：读取图片、粘贴图片时图像处理失败（抛错）
- 说明：代码有 fallback，先尝试原生模块，原生模块不可用时才降级到 sharp，所以不一定必崩
- 受影响场景：`FileReadTool` 读大图、`imagePaste` 粘贴截图

**turndown — WebFetch HTML 转 Markdown**
- 影响：`WebFetchTool` 抓取网页时，HTML 不会被转换为 Markdown，原样返回
- 实际影响：Claude 仍能理解 HTML，但 token 消耗增加，解析效果略差

### 不受影响（正常使用）

| 功能 | 原因 |
|------|------|
| Anthropic API Key 直连 | 不经过任何 stub |
| 所有核心工具（Bash、文件、Git 等）| 无依赖 stub |
| MCP 服务器集成 | 不依赖 mcpb stub |
| 插件、Skill、Agent 系统 | 不依赖任何 stub |
| `mcpb` / `sandbox-runtime` / `ant-chrome-mcp` | 仅内部/沙箱场景触发，普通用户不涉及 |
