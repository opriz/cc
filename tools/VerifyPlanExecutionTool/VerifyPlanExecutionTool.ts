import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'
export const VerifyPlanExecutionTool = buildTool({
  name: 'VerifyPlanExecution',
  async description() { return '' },
  inputSchema: z.object({}),
  isEnabled() { return false },
  async call() { return { data: '' } },
  renderToolUseMessage() { return null },
  renderToolResultMessage() { return null },
})
