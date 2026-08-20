import { Router } from 'express';
import { claimRegistry, provider } from '../contracts.js';
import { oracleAddress } from '../utils/signature.js';
import { orchestratorState } from '../orchestrator.js';
import { config } from '../config.js';

export const healthRouter = Router();

const startedAt = Date.now();

healthRouter.get('/', async (_req, res) => {
  try {
    const [blockNumber, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);
    const state = orchestratorState();

    res.json({
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      chainId: Number(network.chainId),
      blockNumber,
      lastScannedBlock: state.lastScannedBlock,
      lagBlocks: blockNumber - state.lastScannedBlock,
      inFlight: state.inFlight,
      oracle: oracleAddress,
      claimRegistry: await claimRegistry.getAddress(),
      mockAI: config.MOCK_AI,
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: String(err) });
  }
});
