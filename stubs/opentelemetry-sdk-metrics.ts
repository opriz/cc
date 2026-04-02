export enum AggregationTemporality { CUMULATIVE = 0, DELTA = 1 }
export type MetricData = Record<string, unknown>
export type DataPoint<T = unknown> = { attributes: Record<string, unknown>; value: T }
export type PushMetricExporter = { export: (metrics: unknown, cb: (result: unknown) => void) => void; shutdown: () => Promise<void> }
export type ResourceMetrics = Record<string, unknown>

export class MeterProvider {
  constructor(_opts?: unknown) {}
  getMeter(_name: string) { return { createCounter: () => ({ add: () => {} }), createHistogram: () => ({ record: () => {} }), createGauge: () => ({ record: () => {} }) } }
  addMetricReader(_reader: unknown) {}
  shutdown() { return Promise.resolve() }
}
export class PeriodicExportingMetricReader {
  constructor(_opts?: unknown) {}
}
export class ConsoleMetricExporter {
  constructor(_opts?: unknown) {}
  export(_metrics: unknown, _cb: (result: unknown) => void) {}
  shutdown() { return Promise.resolve() }
}
