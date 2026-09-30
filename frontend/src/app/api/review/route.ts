import { NextResponse } from 'next/server';
import { orchestratorConfigured, submitHumanVerdict } from '@/server/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * A human reviewer's final decision on a low-confidence claim. Admin-gated: the
 * oracle key lives on the server, and only a holder of ADMIN_API_KEY may direct
 * it to sign a verdict. The contract still enforces the coverage cap.
 */
export async function POST(req: Request) {
  if (!orchestratorConfigured()) {
    return NextResponse.json(
      { error: 'Orchestrator is not configured on this deployment' },
      { status: 503 },
    );
  }

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return NextResponse.json(
      { error: 'Human review is not enabled: ADMIN_API_KEY is not set on the server.' },
      { status: 503 },
    );
  }
  if (req.headers.get('x-admin-key') !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let claimId: number;
  let approved: boolean;
  let amountUsdc: bigint;
  let reasoning: string;
  try {
    const body = (await req.json()) as {
      claimId?: unknown;
      approved?: unknown;
      amountUsdc?: unknown;
      reasoning?: unknown;
    };
    claimId = Number(body.claimId);
    approved = body.approved === true;
    amountUsdc = BigInt(String(body.amountUsdc ?? '0'));
    reasoning = typeof body.reasoning === 'string' ? body.reasoning : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
  }

  if (!Number.isInteger(claimId) || claimId <= 0) {
    return NextResponse.json({ error: 'claimId must be a positive integer' }, { status: 400 });
  }
  if (approved && amountUsdc <= 0n) {
    return NextResponse.json({ error: 'An approved claim needs a positive amount' }, { status: 400 });
  }

  try {
    return NextResponse.json(await submitHumanVerdict(claimId, approved, amountUsdc, reasoning));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const raced = /Cannot regress|InvalidStatus|not awaiting|nonce/i.test(message);
    return NextResponse.json({ error: message, raced }, { status: raced ? 409 : 500 });
  }
}
