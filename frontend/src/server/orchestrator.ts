import { Contract, JsonRpcProvider, Wallet, type ContractTransactionResponse } from 'ethers';
import {
  ClaimStatus,
  configFromEnv,
  estimatorAgent,
  extractorAgent,
  judgeAgent,
  signVerdict,
  verifierAgent,
  type ExtractedData,
  type PipelineContext,
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

export interface StageResult {
  claimId: number;
  from: ClaimStatus;
  to: ClaimStatus;
  done: boolean;
  txHash?: string;
  verdict?: { approved: boolean; amount: string; confidence: number; reasoning: string };
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

  const evidence = claim.evidenceIPFS;
  const extracted: ExtractedData = await extractorAgent(evidence, ctx);
  const verified = await verifierAgent(extracted, evidence, ctx);
  const estimated = await estimatorAgent(extracted, ctx);

  const remainingCoverage = await policyManager.remainingCoverage(claim.policyId);
  const verdict = judgeAgent({ extracted, verified, estimated, remainingCoverage });

  const signature = await signVerdict(
    oracle,
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning,
  );

  const tx = await registry.submitVerdict(
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning,
    signature,
  );
  await tx.wait();

  return {
    claimId,
    from,
    to: verdict.approved ? ClaimStatus.Paid : ClaimStatus.Rejected,
    done: true,
    txHash: tx.hash,
    verdict: {
      approved: verdict.approved,
      amount: verdict.amount.toString(),
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
    },
  };
}
