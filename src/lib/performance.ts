/**
 * Performance monitoring and optimization utilities
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 100;

/**
 * Record a performance metric
 */
export function recordMetric(name: string, value: number): void {
  metrics.push({
    name,
    value,
    timestamp: Date.now(),
  });

  // Keep only the most recent metrics
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Measure async operation performance
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    recordMetric(name, duration);
  }
}

/**
 * Debounce function for performance optimization
 * Returns a debounced function and a cancel function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): [(...args: Parameters<T>) => void, () => void] {
  let timeout: NodeJS.Timeout | null = null;

  const executedFunction = (...args: Parameters<T>) => {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return [executedFunction, cancel];
}

/**
 * Throttle function for performance optimization
 * Returns a throttled function and a cancel function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): [(...args: Parameters<T>) => void, () => void] {
  let inThrottle: boolean = false;
  let timeout: NodeJS.Timeout | null = null;

  const executedFunction = (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      timeout = setTimeout(() => {
        inThrottle = false;
        timeout = null;
      }, limit);
    }
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    inThrottle = false;
  };

  return [executedFunction, cancel];
}

/**
 * Memoize expensive computations
 */
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Get performance metrics summary
 */
export function getMetricsSummary() {
  const summary = new Map<string, { count: number; total: number; avg: number }>();

  metrics.forEach((metric) => {
    const existing = summary.get(metric.name) || { count: 0, total: 0, avg: 0 };
    existing.count++;
    existing.total += metric.value;
    existing.avg = existing.total / existing.count;
    summary.set(metric.name, existing);
  });

  return Object.fromEntries(summary);
}

