import { describe, expect, it } from 'vitest';
import { AbiCoder, keccak256, verifyMessage, getBytes, Wallet } from 'ethers';
import { signVerdict, verdictPayloadHash, oracleAddress } from '../src/utils/signature.js';

const ORACLE_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

describe('verdictPayloadHash', () => {
  it('uses abi.encode, matching VerdictSignature.hash on-chain', () => {
    const expected = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'bool', 'uint256', 'uint8', 'string'],
        [7, true, 1_234_567n, 91, 'reason text'],
      ),
    );
    expect(verdictPayloadHash(7, true, 1_234_567n, 91, 'reason text')).toBe(expected);
  });

  it('changes when any field changes', () => {
    const base = verdictPayloadHash(1, true, 100n, 90, 'ok');
    expect(verdictPayloadHash(2, true, 100n, 90, 'ok')).not.toBe(base);
    expect(verdictPayloadHash(1, false, 100n, 90, 'ok')).not.toBe(base);
    expect(verdictPayloadHash(1, true, 101n, 90, 'ok')).not.toBe(base);
    expect(verdictPayloadHash(1, true, 100n, 91, 'ok')).not.toBe(base);
    expect(verdictPayloadHash(1, true, 100n, 90, 'ok!')).not.toBe(base);
  });

  it('is not vulnerable to the packed-encoding boundary shift', () => {
    // With abi.encodePacked these two would be trivially confusable via the
    // trailing dynamic string; abi.encode keeps them distinct.
    expect(verdictPayloadHash(1, true, 100n, 90, 'ab')).not.toBe(
      verdictPayloadHash(1, true, 100n, 90, 'a') + 'b',
    );
  });
});

describe('signVerdict', () => {
  it('produces an EIP-191 signature recoverable to the oracle address', async () => {
    const signature = await signVerdict(42, true, 18_000_000n, 87, 'APPROVED (confidence 87%)');
    const payloadHash = verdictPayloadHash(42, true, 18_000_000n, 87, 'APPROVED (confidence 87%)');

    const recovered = verifyMessage(getBytes(payloadHash), signature);
    expect(recovered).toBe(oracleAddress);
    expect(oracleAddress).toBe(new Wallet(ORACLE_PK).address);
  });

  it('does not verify against a tampered payload', async () => {
    const signature = await signVerdict(42, true, 1_000_000n, 90, 'ok');
    const tampered = verdictPayloadHash(42, true, 50_000_000n, 90, 'ok');
    expect(verifyMessage(getBytes(tampered), signature)).not.toBe(oracleAddress);
  });
});
