import type { PipelineContext } from '@claimbot/pipeline';
import { silentLogger, DEFAULT_ANTHROPIC_MODEL, DEFAULT_PINATA_GATEWAY } from '@claimbot/pipeline';

/** Mock-AI context so agent tests never reach the network. */
export const testContext: PipelineContext = {
  config: {
    mockAI: true,
    anthropicModel: DEFAULT_ANTHROPIC_MODEL,
    pinataGateway: DEFAULT_PINATA_GATEWAY,
  },
  logger: silentLogger,
};
