export class SandboxViolationStore {
  getViolations() { return [] }
  addViolation(_v: unknown) {}
  clear() {}
}

export class SandboxManager {
  static isSupportedPlatform() { return false }
  static checkDependencies() { return Promise.resolve({ satisfied: false, missing: [] }) }
  static initialize(_config: unknown, _cb: unknown) { return Promise.resolve() }
  static updateConfig(_config: unknown) {}
  static reset() { return Promise.resolve() }
  static wrapWithSandbox(_opts: unknown, fn: () => unknown) { return fn() }
  static getFsReadConfig() { return null }
  static getFsWriteConfig() { return null }
  static getNetworkRestrictionConfig() { return null }
  static getIgnoreViolations() { return false }
  static getAllowUnixSockets() { return false }
  static getAllowLocalBinding() { return false }
  static getEnableWeakerNestedSandbox() { return false }
  static getProxyPort() { return null }
  static getSocksProxyPort() { return null }
  static getLinuxHttpSocketPath() { return null }
  static getLinuxSocksSocketPath() { return null }
  static waitForNetworkInitialization() { return Promise.resolve() }
  static getSandboxViolationStore() { return new SandboxViolationStore() }
  static annotateStderrWithSandboxFailures(_command: string, stderr: string) {
    return stderr
  }
  static cleanupAfterCommand() {}
}

export const SandboxRuntimeConfigSchema = {
  parse: (v: unknown) => v,
  safeParse: (v: unknown) => ({ success: true, data: v }),
}

// Type stubs — only used as type imports, never at runtime
export type FsReadRestrictionConfig = Record<string, unknown>
export type FsWriteRestrictionConfig = Record<string, unknown>
export type IgnoreViolationsConfig = Record<string, unknown>
export type NetworkHostPattern = string
export type NetworkRestrictionConfig = Record<string, unknown>
export type SandboxAskCallback = () => Promise<boolean>
export type SandboxDependencyCheck = Record<string, unknown>
export type SandboxRuntimeConfig = Record<string, unknown>
export type SandboxViolationEvent = Record<string, unknown>
