import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'

export const TungstenTool = buildTool({
  name: 'Tungsten',
  async description() { return 'Internal tool (not available)' },
  inputSchema: z.object({ input: z.string().optional() }),
  userFacingName() { return 'Tungsten' },
  isEnabled() { return false },
  isReadOnly() { return true },
  async call(_args: { input?: string }) {
    return { data: 'Not available' }
  },
  renderToolUseMessage() { return null },
  renderToolResultMessage() { return null },
})
