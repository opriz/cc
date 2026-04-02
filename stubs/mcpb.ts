export type McpbManifest = Record<string, unknown>
export type McpbUserConfigurationOption = Record<string, unknown>
export async function getMcpConfigForManifest(_manifest: unknown) { return null }
export const McpbManifestSchema = {
  safeParse: (v: unknown) => ({ success: true, data: v as McpbManifest }),
  parse: (v: unknown) => v as McpbManifest,
}
