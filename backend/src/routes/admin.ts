import { Router, type NextFunction, type Request, type Response } from 'express';
import { claimRegistry } from '../contracts.js';
import { orchestratorState, pipelineRuns, processClaim } from '../orchestrator.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const adminRouter = Router();

/** Admin routes can re-trigger a paid pipeline run, so they are key-gated. */
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.ADMIN_API_KEY) {
    res.status(503).json({ error: 'Admin API disabled: ADMIN_API_KEY is not configured' });
    return;
  }
  const provided = req.header('x-admin-key');
  if (provided !== config.ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

adminRouter.use(requireAdminKey);

adminRouter.get('/runs', (_req, res) => {
  res.json(orchestratorState());
});

adminRouter.get('/runs/:claimId', (req, res) => {
  const claimId = Number(req.params.claimId);
  const run = pipelineRuns.get(claimId);
  if (!run) {
    res.status(404).json({ error: `No pipeline run recorded for claim ${claimId}` });
    return;
  }
  res.json(run);
});

adminRouter.post('/retry/:claimId', async (req, res) => {
  const claimId = Number(req.params.claimId);
  if (!Number.isInteger(claimId) || claimId <= 0) {
    res.status(400).json({ error: 'claimId must be a positive integer' });
    return;
  }

  try {
    const claim = await claimRegistry.claims(claimId);
    if (claim.claimant === '0x0000000000000000000000000000000000000000') {
      res.status(404).json({ error: `Claim ${claimId} does not exist` });
      return;
    }
    logger.warn({ claimId }, 'Admin requested pipeline retry');
    void processClaim(claimId, claim.evidenceIPFS as string);
    res.status(202).json({ status: 'accepted', claimId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
