/**
 * Configuration is injected rather than read from the ambient environment, so the
 * same pipeline runs inside the standalone backend and inside a serverless
 * function without either one dictating how the other loads its settings.
 */
export interface PipelineConfig {
  /** Skip every LLM call and return deterministic results. */
  mockAI: boolean;
  anthropicApiKey?: string | undefined;
  anthropicModel: string;
  pinataGateway: string;
  openWeatherKey?: string | undefined;
}

export interface Logger {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface PipelineContext {
  config: PipelineConfig;
  logger: Logger;
}

/** Discards everything; the default when a caller supplies no logger. */
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_PINATA_GATEWAY = 'https://gateway.pinata.cloud';

/** Builds a config from a plain environment record, applying the shared defaults. */
export function configFromEnv(env: Record<string, string | undefined>): PipelineConfig {
  const mockAI = env.MOCK_AI === 'true' || env.MOCK_AI === '1';
  return {
    mockAI,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    pinataGateway: env.PINATA_GATEWAY ?? DEFAULT_PINATA_GATEWAY,
    openWeatherKey: env.OPENWEATHER_KEY,
  };
}
