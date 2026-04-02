export class OTLPMetricExporter {
  constructor(_opts?: unknown) {}
  export(_metrics: unknown, _cb: (result: unknown) => void) {}
  shutdown() { return Promise.resolve() }
}
export class OTLPLogExporter {
  constructor(_opts?: unknown) {}
  export(_logs: unknown, _cb: (result: unknown) => void) {}
  shutdown() { return Promise.resolve() }
}
export class OTLPTraceExporter {
  constructor(_opts?: unknown) {}
  export(_spans: unknown, _cb: (result: unknown) => void) {}
  shutdown() { return Promise.resolve() }
}
export class PrometheusExporter {
  constructor(_opts?: unknown) {}
  export(_metrics: unknown, _cb: (result: unknown) => void) {}
  shutdown() { return Promise.resolve() }
}
