import { configFromEnv, type PipelineContext } from '@claimbot/pipeline';
import { config } from './config.js';
import { logger } from './utils/logger.js';

/**
 * Adapts this service's validated config into the shape the shared pipeline
 * expects, so the agents stay free of any ambient environment access.
 */
export const pipelineContext: PipelineContext = {
  config: {
    ...configFromEnv(process.env),
    mockAI: config.MOCK_AI,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    anthropicModel: config.ANTHROPIC_MODEL,
    pinataGateway: config.PINATA_GATEWAY,
    openWeatherKey: config.OPENWEATHER_KEY,
  },
  logger,
};
