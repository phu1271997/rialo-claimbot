import { NextResponse } from 'next/server';
import { analyzeClaim, orchestratorConfigured } from '@/server/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Read-only: returns the three agent outputs and the machine's provisional
 * verdict for a claim, without submitting anything on-chain. Powers the human
 * review console. Safe to call on any claim.
 */
export async function POST(req: Request) {
  if (!orchestratorConfigured()) {
    return NextResponse.json(
      { error: 'Orchestrator is not configured on this deployment' },
      { status: 503 },
    );
  }

  let claimId: number;
  try {
    const body = (await req.json()) as { claimId?: unknown };
    claimId = Number(body.claimId);
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with claimId' }, { status: 400 });
  }

  if (!Number.isInteger(claimId) || claimId <= 0) {
    return NextResponse.json({ error: 'claimId must be a positive integer' }, { status: 400 });
  }

  try {
    return NextResponse.json(await analyzeClaim(claimId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
