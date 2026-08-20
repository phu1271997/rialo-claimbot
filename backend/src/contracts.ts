import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet, type ContractTransactionResponse } from 'ethers';
import { config } from './config.js';
import { logger } from './utils/logger.js';

import ClaimRegistryABI from './abis/ClaimRegistry.json' with { type: 'json' };
import PolicyManagerABI from './abis/PolicyManager.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));

interface Deployments {
  chainId?: number;
  claimRegistry: string;
  policyManager: string;
  payoutVault?: string;
  claimAutomation?: string;
  usdc?: string;
}

function loadDeployments(): Deployments {
  // Env overrides win, so Railway can point at a redeploy without a rebuild.
  if (config.CLAIM_REGISTRY_ADDRESS && config.POLICY_MANAGER_ADDRESS) {
    return {
      claimRegistry: config.CLAIM_REGISTRY_ADDRESS,
      policyManager: config.POLICY_MANAGER_ADDRESS,
    };
  }

  const candidates = [
    resolve(here, '../../contracts/deployments/sepolia.json'),
    resolve(here, '../contracts/deployments/sepolia.json'),
    resolve(process.cwd(), '../contracts/deployments/sepolia.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      logger.info({ path }, 'Loaded deployment addresses');
      return JSON.parse(readFileSync(path, 'utf8')) as Deployments;
    }
  }
  throw new Error(
    'No deployment addresses found. Run the deploy script, or set CLAIM_REGISTRY_ADDRESS and POLICY_MANAGER_ADDRESS.',
  );
}

export const deployments = loadDeployments();

export const provider = new JsonRpcProvider(config.RPC_URL);
export const oracleSigner = new Wallet(config.ORACLE_PRIVATE_KEY, provider);

/** On-chain claim tuple as ethers returns it (indexed + named). */
export interface OnChainClaim {
  policyId: bigint;
  claimant: string;
  evidenceIPFS: string;
  description: string;
  submittedAt: bigint;
  deadline: bigint;
  status: bigint;
  approvedAmount: bigint;
  confidence: bigint;
  reasoning: string;
  verdictHash: string;
}

/**
 * ethers types dynamic contract members as `BaseContract[key]`, which is
 * `ContractMethod | undefined`. Declaring the surface we actually call keeps
 * strict mode useful instead of forcing non-null assertions at every call site.
 */
export type ClaimRegistryContract = Contract & {
  claims(claimId: number | bigint): Promise<OnChainClaim>;
  getActiveClaims(): Promise<bigint[]>;
  getUserClaims(user: string): Promise<bigint[]>;
  updateStatus(
    claimId: number | bigint,
    status: number,
    overrides?: { nonce?: number },
  ): Promise<ContractTransactionResponse>;
  submitVerdict(
    claimId: number | bigint,
    approved: boolean,
    amount: bigint,
    confidence: number,
    reasoning: string,
    signature: string,
    overrides?: { nonce?: number },
  ): Promise<ContractTransactionResponse>;
};

export type PolicyManagerContract = Contract & {
  isActive(policyId: number | bigint): Promise<boolean>;
  remainingCoverage(policyId: number | bigint): Promise<bigint>;
};

export const claimRegistry = new Contract(
  deployments.claimRegistry,
  ClaimRegistryABI,
  oracleSigner,
) as ClaimRegistryContract;

export const policyManager = new Contract(
  deployments.policyManager,
  PolicyManagerABI,
  provider,
) as PolicyManagerContract;
