import { AbiCoder, Wallet, getBytes, keccak256 } from 'ethers';

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
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bool', 'uint256', 'uint8', 'string'],
      [claimId, approved, amount, confidence, reasoning],
    ),
  );
}

/** EIP-191 `personal_sign` over the payload hash, matching ECDSA + MessageHashUtils on-chain. */
export async function signVerdict(
  wallet: Wallet,
  claimId: number | bigint,
  approved: boolean,
  amount: bigint,
  confidence: number,
  reasoning: string,
): Promise<string> {
  const payloadHash = verdictPayloadHash(claimId, approved, amount, confidence, reasoning);
  return wallet.signMessage(getBytes(payloadHash));
}
