import { AbiCoder, Wallet, getBytes, keccak256 } from 'ethers';
import { config } from '../config.js';

const oracleWallet = new Wallet(config.ORACLE_PRIVATE_KEY);

export const oracleAddress = oracleWallet.address;

/**
 * Must stay byte-identical to `VerdictSignature.hash` in the contract, which uses
 * `abi.encode` — NOT `abi.encodePacked`. Packed encoding of a trailing dynamic
 * string is ambiguous, so both sides use the padded ABI encoding.
 */
export function verdictPayloadHash(
  claimId: number | bigint,
  approved: boolean,
  amount: bigint,
  confidence: number,
  reasoning: string,
): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'bool', 'uint256', 'uint8', 'string'],
    [claimId, approved, amount, confidence, reasoning],
  );
  return keccak256(encoded);
}

/** EIP-191 `personal_sign` over the payload hash, matching ECDSA + MessageHashUtils on-chain. */
export async function signVerdict(
  claimId: number | bigint,
  approved: boolean,
  amount: bigint,
  confidence: number,
  reasoning: string,
): Promise<string> {
  const payloadHash = verdictPayloadHash(claimId, approved, amount, confidence, reasoning);
  return oracleWallet.signMessage(getBytes(payloadHash));
}
