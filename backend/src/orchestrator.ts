import type { Log } from 'ethers';
import { claimRegistry, oracleSigner, policyManager, provider } from './contracts.js';
import { oracleTxQueue } from './utils/txQueue.js';
import { extractorAgent } from './agents/extractor.js';
import { verifierAgent } from './agents/verifier.js';
import { estimatorAgent } from './agents/estimator.js';
import { judgeAgent } from './agents/judge.js';
import { signVerdict } from './utils/signature.js';
import { logger } from './utils/logger.js';
import { retry } from './utils/retry.js';
import { config } from './config.js';

export enum Status {
  Submitted = 0,
  Extracting = 1,
  Verifying = 2,
  Estimating = 3,
  Judged = 4,
  Paid = 5,
  Rejected = 6,
  Refunded = 7,
  Disputed = 8,
}

export interface PipelineRecord {
  claimId: number;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'done' | 'failed';
  verdict?: { approved: boolean; amount: string; confidence: number; reasoning: string };
  error?: string;
  txHash?: string;
}

/** In-memory run log — enough for /health and the admin endpoints in an MVP. */
export const pipelineRuns = new Map<number, PipelineRecord>();
const inFlight = new Set<number>();

const txQueue = oracleTxQueue(oracleSigner);

let lastScannedBlock = 0;
let pollTimer: NodeJS.Timeout | null = null;

export function orchestratorState() {
  return {
    lastScannedBlock,
    inFlight: [...inFlight],
    runs: [...pipelineRuns.values()].slice(-25),
  };
}

export async function startOrchestrator(): Promise<void> {
  const startBlock = config.START_BLOCK ?? (await provider.getBlockNumber());
  lastScannedBlock = startBlock;

  logger.info(
    { registry: await claimRegistry.getAddress(), startBlock, pollMs: config.POLL_INTERVAL_MS },
    'Orchestrator starting',
  );

  await recoverPendingClaims();

  // HTTP polling rather than a WebSocket subscription: ethers v6 WS reconnect
  // drops events silently, and a missed ClaimSubmitted costs a real payout.
  pollTimer = setInterval(() => {
    void pollForClaims();
  }, config.POLL_INTERVAL_MS);
}

export function stopOrchestrator(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function pollForClaims(): Promise<void> {
  try {
    const head = await provider.getBlockNumber();
    if (head <= lastScannedBlock) return;

    const from = lastScannedBlock + 1;
    const to = head;
    const logs = await claimRegistry.queryFilter(
      claimRegistry.filters.ClaimSubmitted!(),
      from,
      to,
    );
    lastScannedBlock = to;

    for (const entry of logs) {
      const parsed = claimRegistry.interface.parseLog(entry as unknown as Log);
      if (!parsed) continue;
      const claimId = Number(parsed.args.claimId as bigint);
      const evidenceIPFS = parsed.args.evidenceIPFS as string;
      logger.info({ claimId, block: entry.blockNumber }, 'ClaimSubmitted observed');
      void processClaim(claimId, evidenceIPFS);
    }
  } catch (err) {
    logger.error({ err: String(err) }, 'Poll cycle failed; will retry next tick');
  }
}

/** On restart, pick up claims that were mid-pipeline when the process died. */
async function recoverPendingClaims(): Promise<void> {
  try {
    const active: bigint[] = await claimRegistry.getActiveClaims();
    logger.info({ count: active.length }, 'Scanning active claims for recovery');

    for (const raw of active) {
      const claimId = Number(raw);
      const claim = await claimRegistry.claims(claimId);
      const status = Number(claim.status) as Status;
      if (status >= Status.Judged) continue;

      logger.info({ claimId, status }, 'Recovering stalled claim');
      void processClaim(claimId, claim.evidenceIPFS as string);
    }
  } catch (err) {
    logger.error({ err: String(err) }, 'Recovery scan failed');
  }
}

export async function processClaim(claimId: number, evidenceIPFS: string): Promise<void> {
  if (inFlight.has(claimId)) {
    logger.debug({ claimId }, 'Claim already in flight — skipping duplicate trigger');
    return;
  }
  inFlight.add(claimId);

  const record: PipelineRecord = { claimId, startedAt: Date.now(), status: 'running' };
  pipelineRuns.set(claimId, record);

  try {
    // A claim can be triggered twice (startup recovery plus the first poll cycle).
    // The contract rejects the duplicate anyway; bail early so it doesn't cost gas.
    const current = await claimRegistry.claims(claimId);
    if (Number(current.status) >= Status.Paid) {
      logger.info({ claimId, status: Number(current.status) }, 'Claim already finalized — skipping');
      pipelineRuns.delete(claimId);
      return;
    }

    logger.info({ claimId }, '── pipeline start ──');

    await advanceStatus(claimId, Status.Extracting);
    const extracted = await retry(() => extractorAgent(evidenceIPFS), { label: `extractor:${claimId}` });
    logger.info({ claimId, extracted }, 'Extractor done');

    await advanceStatus(claimId, Status.Verifying);
    const verified = await retry(() => verifierAgent(extracted, evidenceIPFS), { label: `verifier:${claimId}` });
    logger.info({ claimId, verified }, 'Verifier done');

    await advanceStatus(claimId, Status.Estimating);
    const estimated = await retry(() => estimatorAgent(extracted), { label: `estimator:${claimId}` });
    logger.info({ claimId, estimated }, 'Estimator done');

    await advanceStatus(claimId, Status.Judged);

    const claim = await claimRegistry.claims(claimId);
    const remainingCoverage: bigint = await policyManager.remainingCoverage(claim.policyId);

    const verdict = judgeAgent({ extracted, verified, estimated, remainingCoverage });
    logger.info({ claimId, verdict: { ...verdict, amount: verdict.amount.toString() } }, 'Judge done');

    const signature = await signVerdict(
      claimId,
      verdict.approved,
      verdict.amount,
      verdict.confidence,
      verdict.reasoning,
    );

    const receipt = await txQueue.send(`submitVerdict:${claimId}`, (nonce) =>
      claimRegistry.submitVerdict(
        claimId,
        verdict.approved,
        verdict.amount,
        verdict.confidence,
        verdict.reasoning,
        signature,
        { nonce },
      ),
    );
    logger.info({ claimId, txHash: receipt?.hash }, 'Verdict submitted');

    record.status = 'done';
    record.finishedAt = Date.now();
    record.txHash = receipt?.hash;
    record.verdict = {
      approved: verdict.approved,
      amount: verdict.amount.toString(),
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
    };
    logger.info({ claimId, ms: record.finishedAt - record.startedAt }, '✅ pipeline complete');
  } catch (err) {
    record.status = 'failed';
    record.finishedAt = Date.now();
    record.error = String(err);
    // Chainlink Automation refunds the claim once the deadline passes, so a
    // failed pipeline degrades to a refund rather than a stuck claim.
    logger.error({ claimId, err: String(err) }, 'Pipeline failed — Automation will refund at deadline');
  } finally {
    inFlight.delete(claimId);
  }
}

async function advanceStatus(claimId: number, status: Status): Promise<void> {
  const claim = await claimRegistry.claims(claimId);
  if (Number(claim.status) >= status) {
    logger.debug({ claimId, status }, 'Status already at or past target — skipping');
    return;
  }
  await txQueue.send(`updateStatus:${claimId}:${status}`, (nonce) =>
    claimRegistry.updateStatus(claimId, status, { nonce }),
  );
}
