export const BROWSER_TOOLS: unknown[] = []
export type ClaudeForChromeContext = Record<string, unknown>
export type Logger = { log: (...args: unknown[]) => void }
export type PermissionMode = string
export function createClaudeForChromeMcpServer(_opts: unknown) {
  return { connect: async () => {} }
}
