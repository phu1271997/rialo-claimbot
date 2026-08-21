import { NextResponse } from 'next/server';
import { advanceClaim, orchestratorConfigured } from '@/server/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Advances a claim through the AI pipeline by one stage per call.
 *
 * The oracle key lives only in server env, so this route is the only thing that
 * can move a claim forward. It is idempotent: calling it on a finalized claim
 * returns the terminal state instead of erroring, and every write the pipeline
 * makes is guarded on-chain by the registry's forward-only status check.
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
    return NextResponse.json(await advanceClaim(claimId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A concurrent caller may have advanced the same stage first; that is not a
    // failure worth surfacing, the next poll will pick up the real state.
    const raced = /Cannot regress|InvalidStatus|nonce/i.test(message);
    return NextResponse.json({ error: message, raced }, { status: raced ? 409 : 500 });
  }
}
