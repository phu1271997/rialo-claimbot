export enum ClaimStatus {
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

export interface Claim {
  policyId: bigint;
  claimant: `0x${string}`;
  evidenceIPFS: string;
  description: string;
  submittedAt: bigint;
  deadline: bigint;
  status: ClaimStatus;
  approvedAmount: bigint;
  confidence: number;
  reasoning: string;
  verdictHash: `0x${string}`;
}

/** `claims(id)` returns a positional tuple; this maps it into something readable. */
export function toClaim(tuple: readonly unknown[] | undefined): Claim | undefined {
  if (!tuple || tuple.length < 11) return undefined;
  return {
    policyId: tuple[0] as bigint,
    claimant: tuple[1] as `0x${string}`,
    evidenceIPFS: tuple[2] as string,
    description: tuple[3] as string,
    submittedAt: tuple[4] as bigint,
    deadline: tuple[5] as bigint,
    status: Number(tuple[6]) as ClaimStatus,
    approvedAmount: tuple[7] as bigint,
    confidence: Number(tuple[8]),
    reasoning: tuple[9] as string,
    verdictHash: tuple[10] as `0x${string}`,
  };
}

export interface Policy {
  holder: `0x${string}`;
  vehicleHash: `0x${string}`;
  premium: bigint;
  coverage: bigint;
  startTime: bigint;
  endTime: bigint;
  claimsCount: bigint;
  totalPaidOut: bigint;
  active: boolean;
}

export function toPolicy(tuple: readonly unknown[] | undefined): Policy | undefined {
  if (!tuple || tuple.length < 9) return undefined;
  return {
    holder: tuple[0] as `0x${string}`,
    vehicleHash: tuple[1] as `0x${string}`,
    premium: tuple[2] as bigint,
    coverage: tuple[3] as bigint,
    startTime: tuple[4] as bigint,
    endTime: tuple[5] as bigint,
    claimsCount: tuple[6] as bigint,
    totalPaidOut: tuple[7] as bigint,
    active: tuple[8] as boolean,
  };
}

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  [ClaimStatus.Submitted]: 'Đã nộp',
  [ClaimStatus.Extracting]: 'Phân tích ảnh',
  [ClaimStatus.Verifying]: 'Xác minh',
  [ClaimStatus.Estimating]: 'Ước tính chi phí',
  [ClaimStatus.Judged]: 'Judge quyết định',
  [ClaimStatus.Paid]: 'Đã thanh toán',
  [ClaimStatus.Rejected]: 'Bị từ chối',
  [ClaimStatus.Refunded]: 'Hoàn phí (quá hạn)',
  [ClaimStatus.Disputed]: 'Đang tranh chấp',
};

export function isTerminal(status: ClaimStatus): boolean {
  return (
    status === ClaimStatus.Paid ||
    status === ClaimStatus.Rejected ||
    status === ClaimStatus.Refunded
  );
}
