import { Contract, JsonRpcProvider, Wallet, type ContractTransactionResponse } from 'ethers';
import {
  ClaimStatus,
  configFromEnv,
  estimatorAgent,
  extractorAgent,
  judgeAgent,
  needsHumanReview,
  signVerdict,
  verifierAgent,
  type EstimatedCost,
  type ExtractedData,
  type PipelineContext,
  type Verdict,
  type VerifiedData,
} from '@claimbot/pipeline';
import claimRegistryAbi from '@/lib/abis/ClaimRegistry.json';
import policyManagerAbi from '@/lib/abis/PolicyManager.json';

/**
 * Serverless-friendly orchestrator.
 *
 * The standalone backend runs the whole pipeline in one pass because it is a
 * long-lived process. A serverless invocation cannot: five Sepolia transactions
 * at roughly 15s of confirmation each blows past any function timeout. So each
 * call advances the claim by exactly one stage and returns, and the caller keeps
 * calling until the claim is terminal.
 *
 * The agents are the same code the backend runs — this is a different trigger,
 * not a different pipeline.
 */

interface VerdictView {
  approved: boolean;
  amount: string;
  confidence: number;
  reasoning: string;
}

export interface StageResult {
  claimId: number;
  from: ClaimStatus;
  to: ClaimStatus;
  done: boolean;
  txHash?: string;
  verdict?: VerdictView;
  /** True when the machine deferred to a human instead of auto-deciding. */
  needsReview?: boolean;
}

/** The three agent outputs plus the machine's provisional verdict, for a reviewer. */
export interface ClaimAnalysis {
  claimId: number;
  status: ClaimStatus;
  ready: boolean; // status === Judged, so a verdict can be submitted
  needsReview: boolean;
  confidence: number;
  provisional: VerdictView;
  extracted: ExtractedData;
  verified: VerifiedData;
  estimated: EstimatedCost;
  remainingCoverage: string;
}

interface OnChainClaim {
  policyId: bigint;
  claimant: string;
  evidenceIPFS: string;
  status: bigint;
}

interface RegistryWrites {
  claims(id: number): Promise<OnChainClaim>;
  updateStatus(id: number, status: number): Promise<ContractTransactionResponse>;
  submitVerdict(
    id: number,
    approved: boolean,
    amount: bigint,
    confidence: number,
    reasoning: string,
    signature: string,
  ): Promise<ContractTransactionResponse>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured on the server`);
  return value;
}

export function orchestratorConfigured(): boolean {
  return Boolean(
    process.env.RPC_URL &&
      process.env.ORACLE_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_CLAIM_REGISTRY &&
      process.env.NEXT_PUBLIC_POLICY_MANAGER,
  );
}

function context(): PipelineContext {
  return {
    config: configFromEnv(process.env),
    // Capturing logs is the platform's job; the pipeline just needs a sink.
    logger: {
      debug: () => {},
      info: (o, m) => console.log(m ?? '', o),
      warn: (o, m) => console.warn(m ?? '', o),
      error: (o, m) => console.error(m ?? '', o),
    },
  };
}

function wired() {
  const provider = new JsonRpcProvider(required('RPC_URL'));
  // Accept the key with or without an 0x prefix; both are valid representations.
  const oracle = new Wallet(`0x${required('ORACLE_PRIVATE_KEY').replace(/^0x/, '')}`, provider);

  const registry = new Contract(
    required('NEXT_PUBLIC_CLAIM_REGISTRY'),
    claimRegistryAbi,
    oracle,
  ) as unknown as RegistryWrites;

  const policyManager = new Contract(
    required('NEXT_PUBLIC_POLICY_MANAGER'),
    policyManagerAbi,
    provider,
  ) as unknown as { remainingCoverage(id: bigint): Promise<bigint> };

  return { oracle, registry, policyManager };
}

/** Advances one claim by a single stage. Safe to call repeatedly and concurrently. */
export async function advanceClaim(claimId: number): Promise<StageResult> {
  const { oracle, registry, policyManager } = wired();
  const ctx = context();

  const claim = await registry.claims(claimId);
  if (claim.claimant === '0x0000000000000000000000000000000000000000') {
    throw new Error(`Claim ${claimId} does not exist`);
  }

  const from = Number(claim.status) as ClaimStatus;
  if (from >= ClaimStatus.Paid) {
    return { claimId, from, to: from, done: true };
  }

  // Statuses 0→4 are just markers so the UI can show progress. The agent work
  // happens at Judged, where all three outputs are needed together.
  if (from < ClaimStatus.Judged) {
    const to = (from + 1) as ClaimStatus;
    const tx = await registry.updateStatus(claimId, to);
    await tx.wait();
    return { claimId, from, to, done: false, txHash: tx.hash };
  }

  // Judged: run the agents once, then either auto-decide or defer to a human.
  const { verdict, review } = await runAgents(claim, policyManager, ctx);

  if (review) {
    // Low confidence with no fraud signal. Leave the claim at Judged and wait
    // for a human verdict via submitHumanVerdict. No transaction is sent, so
    // this stays safe to call repeatedly.
    return {
      claimId,
      from,
      to: from,
      done: false,
      needsReview: true,
      verdict: toVerdictView(verdict),
    };
  }

  const tx = await finalize(oracle, registry, claimId, verdict);
  await tx.wait();

  return {
    claimId,
    from,
    to: verdict.approved ? ClaimStatus.Paid : ClaimStatus.Rejected,
    done: true,
    txHash: tx.hash,
    verdict: toVerdictView(verdict),
  };
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function toVerdictView(v: Verdict): VerdictView {
  return {
    approved: v.approved,
    amount: v.amount.toString(),
    confidence: v.confidence,
    reasoning: v.reasoning,
  };
}

interface CoverageReader {
  remainingCoverage(id: bigint): Promise<bigint>;
}

/** Runs the three agents plus the deterministic judge, and flags review need. */
async function runAgents(
  claim: OnChainClaim,
  policyManager: CoverageReader,
  ctx: PipelineContext,
) {
  const evidence = claim.evidenceIPFS;
  const extracted: ExtractedData = await extractorAgent(evidence, ctx);
  const verified = await verifierAgent(extracted, evidence, ctx);
  const estimated = await estimatorAgent(extracted, ctx);
  const remainingCoverage = await policyManager.remainingCoverage(claim.policyId);
  const input = { extracted, verified, estimated, remainingCoverage };
  return {
    extracted,
    verified,
    estimated,
    remainingCoverage,
    verdict: judgeAgent(input),
    review: needsHumanReview(input),
  };
}

async function finalize(
  oracle: Wallet,
  registry: RegistryWrites,
  claimId: number,
  verdict: Verdict,
): Promise<ContractTransactionResponse> {
  const signature = await signVerdict(
    oracle,
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning,
  );
  return registry.submitVerdict(
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning,
    signature,
  );
}

/** Read-only: run the agents and return the analysis without touching the chain. */
export async function analyzeClaim(claimId: number): Promise<ClaimAnalysis> {
  const { registry, policyManager } = wired();
  const ctx = context();

  const claim = await registry.claims(claimId);
  if (claim.claimant === ZERO_ADDRESS) throw new Error(`Claim ${claimId} does not exist`);

  const status = Number(claim.status) as ClaimStatus;
  const { extracted, verified, estimated, remainingCoverage, verdict, review } = await runAgents(
    claim,
    policyManager,
    ctx,
  );

  return {
    claimId,
    status,
    ready: status === ClaimStatus.Judged,
    needsReview: review,
    confidence: verdict.confidence,
    provisional: toVerdictView(verdict),
    extracted,
    verified,
    estimated,
    remainingCoverage: remainingCoverage.toString(),
  };
}

/** Finalizes a claim from a human reviewer's decision. Only valid at Judged. */
export async function submitHumanVerdict(
  claimId: number,
  approved: boolean,
  amountUsdc: bigint,
  reasoning: string,
): Promise<StageResult> {
  const { oracle, registry, policyManager } = wired();

  const claim = await registry.claims(claimId);
  if (claim.claimant === ZERO_ADDRESS) throw new Error(`Claim ${claimId} does not exist`);

  const status = Number(claim.status) as ClaimStatus;
  if (status !== ClaimStatus.Judged) {
    throw new Error(`Claim ${claimId} is not awaiting a verdict (status ${status})`);
  }

  let amount = approved ? amountUsdc : 0n;
  if (approved) {
    const remaining = await policyManager.remainingCoverage(claim.policyId);
    if (amount > remaining) amount = remaining;
    if (amount <= 0n) {
      throw new Error('Approved amount must be positive and within the remaining coverage');
    }
  }

  const reason =
    reasoning.trim() ||
    (approved ? 'Approved by a human reviewer after manual inspection.' : 'Rejected by a human reviewer after manual inspection.');
  // A human decided, so confidence is recorded as full.
  const verdict: Verdict = { approved, amount, confidence: 100, reasoning: reason };

  const tx = await finalize(oracle, registry, claimId, verdict);
  await tx.wait();

  return {
    claimId,
    from: ClaimStatus.Judged,
    to: approved ? ClaimStatus.Paid : ClaimStatus.Rejected,
    done: true,
    txHash: tx.hash,
    verdict: toVerdictView(verdict),
  };
}
