import { Wallet } from 'ethers';
import { signVerdict as signWithWallet, verdictPayloadHash } from '@claimbot/pipeline';
import { config } from '../config.js';

const oracleWallet = new Wallet(config.ORACLE_PRIVATE_KEY);

export const oracleAddress = oracleWallet.address;

export { verdictPayloadHash };

/** Binds the shared signer to this process's oracle wallet. */
export async function signVerdict(
  claimId: number | bigint,
  approved: boolean,
  amount: bigint,
  confidence: number,
  reasoning: string,
): Promise<string> {
  return signWithWallet(oracleWallet, claimId, approved, amount, confidence, reasoning);
}
