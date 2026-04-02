import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'
export const SleepTool = buildTool({
  name: 'Sleep',
  async description() { return 'Sleep for a specified duration' },
  inputSchema: z.object({ duration_ms: z.number() }),
  isEnabled() { return true },
  isReadOnly() { return true },
  async call(args: { duration_ms: number }) {
    await new Promise(r => setTimeout(r, args.duration_ms))
    return { data: `Slept for ${args.duration_ms}ms` }
  },
  renderToolUseMessage() { return null },
  renderToolResultMessage() { return null },
})
