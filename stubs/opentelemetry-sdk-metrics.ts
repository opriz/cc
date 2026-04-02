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
