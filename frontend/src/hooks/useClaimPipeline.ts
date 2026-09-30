'use client';

import { useEffect, useRef, useState } from 'react';
import { ClaimStatus, isTerminal } from '@/types/claim';

/**
 * Drives the claim through the AI pipeline while its detail page is open.
 *
 * The orchestrator advances one stage per request because a serverless
 * invocation cannot hold open the five Sepolia confirmations a full run needs.
 * This keeps calling until the claim is terminal — or until the machine defers
 * to a human, at which point it stops and reports `needsReview` so the tracker
 * can show the manual-review state instead of spinning forever.
 */
export function useClaimPipeline(claimId: bigint | undefined, status: ClaimStatus | undefined) {
  const inFlight = useRef(false);
  const stop = useRef(false);
  const [needsReview, setNeedsReview] = useState(false);

  useEffect(() => {
    stop.current = false;
    setNeedsReview(false);
    return () => {
      stop.current = true;
    };
  }, [claimId]);

  useEffect(() => {
    if (claimId === undefined || status === undefined) return;
    if (isTerminal(status)) return;
    if (needsReview) return; // parked for a human — nothing more to drive
    if (inFlight.current) return;

    inFlight.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId: Number(claimId) }),
        });
        const data = (await res.json().catch(() => ({}))) as { needsReview?: boolean };
        if (data.needsReview && !stop.current) setNeedsReview(true);
      } catch {
        // Network hiccup: the next status poll re-triggers this effect.
      } finally {
        if (!stop.current) inFlight.current = false;
      }
    })();
  }, [claimId, status, needsReview]);

  return { needsReview };
}
