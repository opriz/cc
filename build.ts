import { build } from 'bun';
import { mkdir, readFile, writeFile, chmod } from 'fs/promises';

const VERSION = '2.1.87';
const BUILD_TIME = new Date().toISOString();

await mkdir('dist', { recursive: true });

const result = await build({
  entrypoints: ['./entrypoints/cli.tsx'],
  outdir: './dist',
  naming: 'cli.js',
  target: 'node',
  format: 'cjs',
  minify: false,
  sourcemap: 'none',
  // @ts-ignore - bun:bundle feature flags
  // Only enable features whose source files are complete in cc/
  features: [
    'COORDINATOR',
    'TEAMMATE',
    'BRIEF',
    'NOTEBOOK',
    'PLAN_MODE_V2',
    'SEND_MESSAGE',
    'SCHEDULE_CRON',
    'TODO_WRITE',
    'TASK_UPDATE',
    'ENTER_PLAN_MODE',
    'BRIDGE_MODE',
    'BUDDY',
    // Disabled - source files not present:
    // 'KAIROS' / 'PROACTIVE' / 'KAIROS_BRIEF' -> assistant/, proactive/
    // 'DAEMON'                 -> daemon/
    // 'BG_SESSIONS'            -> cli/bg.js
    // 'TEMPLATES'              -> cli/handlers/templateJobs.js
    // 'BYOC_ENVIRONMENT_RUNNER' -> environment-runner/
    // 'SELF_HOSTED_RUNNER'     -> self-hosted-runner/
    // 'CHICAGO_MCP'            -> utils/computerUse/
    // 'DUMP_SYSTEM_PROMPT'     -> (internal only)
    // 'VOICE_MODE'
  ],
  // Redirect native NAPI modules to pure TS/JS implementations
  // and stub out internal/unavailable packages
  alias: {
    'color-diff-napi': './native-ts/color-diff/index.ts',
    'sharp': './stubs/sharp.ts',
    'turndown': './stubs/turndown.ts',
    '@ant/claude-for-chrome-mcp': './stubs/ant-chrome-mcp.ts',
    '@anthropic-ai/bedrock-sdk': './stubs/bedrock-sdk.ts',
    '@anthropic-ai/foundry-sdk': './stubs/foundry-sdk.ts',
    '@anthropic-ai/vertex-sdk': './stubs/vertex-sdk.ts',
    '@anthropic-ai/mcpb': './stubs/mcpb.ts',
    '@anthropic-ai/sandbox-runtime': './stubs/sandbox-runtime.ts',
  },
  define: {
    'MACRO.VERSION': JSON.stringify(VERSION),
    'MACRO.BUILD_TIME': JSON.stringify(BUILD_TIME),
    'MACRO.PACKAGE_URL': JSON.stringify('@anthropic-ai/claude-code'),
    'MACRO.NATIVE_PACKAGE_URL': JSON.stringify('@anthropic-ai/claude-code'),
    'MACRO.ISSUES_EXPLAINER': JSON.stringify('report the issue at https://github.com/anthropics/claude-code/issues'),
    'MACRO.FEEDBACK_CHANNEL': JSON.stringify('https://github.com/anthropics/claude-code/issues'),
    'MACRO.VERSION_CHANGELOG': JSON.stringify(''),
  },
});

if (result.success) {
  const outFile = './dist/cli.js';
  const content = await readFile(outFile, 'utf8');
  await writeFile(outFile, '#!/usr/bin/env node\n' + content);
  await chmod(outFile, 0o755);
  const size = (result.outputs[0]?.size ?? 0) / 1024 / 1024;
  console.log(`✓ Built dist/cli.js (${size.toFixed(1)} MB)`);
} else {
  console.error('Build failed:');
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}
