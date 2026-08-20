import { logger } from './logger.js';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

/** Exponential backoff with jitter. Throws the last error once attempts are exhausted. */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 1000, label = 'task' } = options;
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts - 1;
      logger.warn({ label, attempt: i + 1, attempts, err: String(err) }, 'retry: attempt failed');
      if (isLast) break;
      const delay = baseDelayMs * 2 ** i + Math.floor(Math.random() * 250);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
