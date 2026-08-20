import type { ExtractedData } from './extractor.js';
import type { VerifiedData } from './verifier.js';
import type { EstimatedCost } from './estimator.js';

export interface Verdict {
  approved: boolean;
  amount: bigint; // USDC, 6 decimals
  confidence: number; // 0-100
  reasoning: string;
}

export interface JudgeInput {
  extracted: ExtractedData;
  verified: VerifiedData;
  estimated: EstimatedCost;
  /** Remaining policy coverage in USDC 6dp; the contract enforces this too. */
  remainingCoverage?: bigint;
}

export const MIN_CROSS_CHECK_SCORE = 50;
export const MIN_CONFIDENCE = 70;

/**
 * Deterministic aggregation — deliberately not an LLM call. The verdict is the
 * value that moves money, so it must be reproducible and auditable from the
 * three agent outputs alone.
 */
export function judgeAgent(input: JudgeInput): Verdict {
  const { extracted, verified, estimated, remainingCoverage } = input;
  const confidence = Math.min(extracted.confidence, verified.cross_check_score);

  const reject = (reasoning: string): Verdict => ({
    approved: false,
    amount: 0n,
    confidence,
    reasoning,
  });

  if (extracted.red_flags.length > 0) {
    return reject(`REJECT: Red flags: ${extracted.red_flags.join(', ')}`);
  }

  if (extracted.vehicle_type === 'unknown') {
    return reject('REJECT: Không xác định được loại xe trong ảnh');
  }

  if (extracted.image_quality === 'edited_suspected') {
    return reject('REJECT: Ảnh có dấu hiệu bị chỉnh sửa');
  }

  if (verified.cross_check_score < MIN_CROSS_CHECK_SCORE) {
    return reject(
      `REJECT: Verification score thấp (${verified.cross_check_score}/100). Issues: ${verified.issues.join('; ')}`,
    );
  }

  if (confidence < MIN_CONFIDENCE) {
    return reject(`REJECT: Confidence quá thấp (${confidence}/100), cần review thủ công`);
  }

  if (estimated.recommended_payout_usdc <= 0) {
    return reject('REJECT: Không ước tính được chi phí sửa chữa');
  }

  // Clamp to remaining coverage so the on-chain AmountExceedsCoverage revert
  // becomes a defence-in-depth check rather than the primary control.
  let amount = BigInt(estimated.recommended_payout_usdc);
  let capped = false;
  if (remainingCoverage !== undefined && amount > remainingCoverage) {
    amount = remainingCoverage;
    capped = true;
  }

  if (amount <= 0n) {
    return reject('REJECT: Policy đã dùng hết hạn mức bồi thường');
  }

  const reasoning = [
    `APPROVED (confidence ${confidence}%).`,
    `Damage: ${extracted.severity}, parts: ${extracted.affected_parts.join(', ') || 'n/a'}.`,
    `Estimated: ${estimated.recommended_payout_vnd.toLocaleString('vi-VN')} VND.`,
    capped ? 'Đã giới hạn theo hạn mức còn lại của policy.' : '',
    estimated.reasoning,
  ]
    .filter(Boolean)
    .join(' ');

  return { approved: true, amount, confidence, reasoning };
}
