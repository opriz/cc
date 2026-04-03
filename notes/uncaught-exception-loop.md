# uncaughtException 处理器中的无限循环 bug

## 问题现象

某个孤儿 `claude` 进程（PID `96147`）在终端断开后 CPU 占用 100%，持续空转近 3 小时。火焰图显示主线程全部时间花在 V8 的 `ErrorUtils::Construct` → `CaptureSimpleStackTrace` → `TranslatedState::Init` 上，即反复构造 Error 对象并捕获堆栈。

## 根因

`utils/gracefulShutdown.ts:301` 的 `uncaughtException` 处理器存在两类缺陷：

1. **未防御非 Error 输入**  
   `error` 不一定是 `Error` 实例（可能是 `null`、`undefined`、字符串等）。直接访问 `error.name` / `error.message` 会抛出新的 `TypeError`，而 Node.js 规范规定：若 `uncaughtException` 处理器自身抛错，会再次触发 `uncaughtException` 事件。

2. **处理器内部无 try-catch 兜底**  
   即使 `error` 是正常对象，调用 `logEvent` 会进入 analytics 链路（`shouldSampleEvent` → `getDynamicConfig_CACHED_MAY_BE_STALE` → `logExposureForFeature` → `getUserAttributes` 等）。该链路在任何一环同步抛错时，都会在处理器内部再次触发 `uncaughtException`，形成无限递归。

当终端断开（SIGHUP / TTY revoked）时，Ink 的 stdout 写入抛错 → `uncaughtException` 触发 → 处理器自身抛错 → 再次触发 `uncaughtException` → 死循环。

## 修复方案

对 `uncaughtException` 和 `unhandledRejection` 两个处理器都做以下处理：

- 用 `instanceof Error` 和 `typeof` 防御非标准错误对象
- 将整个处理器逻辑包裹在 `try-catch` 中，防止日志/ analytics 链路的二次抛错再次引爆事件

```typescript
process.on('uncaughtException', error => {
  try {
    const errorName =
      error instanceof Error
        ? error.name
        : typeof error === 'string'
          ? 'string'
          : 'unknown'
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 2000)
        : String(error).slice(0, 2000)
    logForDiagnosticsNoPII('error', 'uncaught_exception', {
      error_name: errorName,
      error_message: errorMessage,
    })
    logEvent('tengu_uncaught_exception', {
      error_name:
        errorName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  } catch {
    // Prevent logging failures from re-triggering uncaughtException
  }
})
```

## 影响面

- 主要影响长期运行会话在终端陡然断开时的进程退出行为
- 修复前：进程可能变成孤儿并无限空转，CPU 跑满
- 修复后：错误被正确记录（或静默丢弃），进程不会陷入自循环

## 相关文件

- `utils/gracefulShutdown.ts`（已修复）
- `utils/process.ts`（EPIPE 处理，相关但非根因）
