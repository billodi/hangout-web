type CounterMap = Map<string, number>;
type HistogramMap = Map<string, { count: number; sum: number; max: number }>;

const counters: CounterMap = new Map();
const histograms: HistogramMap = new Map();

export function incrementMetric(name: string, value = 1) {
  counters.set(name, (counters.get(name) ?? 0) + value);
}

export function observeMetric(name: string, value: number) {
  const prev = histograms.get(name) ?? { count: 0, sum: 0, max: 0 };
  histograms.set(name, {
    count: prev.count + 1,
    sum: prev.sum + value,
    max: Math.max(prev.max, value),
  });
}

export function snapshotMetrics() {
  return {
    counters: Object.fromEntries(counters.entries()),
    histograms: Object.fromEntries(
      [...histograms.entries()].map(([key, row]) => [
        key,
        {
          count: row.count,
          sum: row.sum,
          max: row.max,
          avg: row.count > 0 ? row.sum / row.count : 0,
        },
      ]),
    ),
  };
}

