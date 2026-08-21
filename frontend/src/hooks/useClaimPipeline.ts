'use client';

import { useEffect, useRef } from 'react';
import { ClaimStatus, isTerminal } from '@/types/claim';

/**
 * Drives the claim through the AI pipeline while its detail page is open.
 *
 * The orchestrator advances one stage per request because a serverless
 * invocation cannot hold open the five Sepolia confirmations a full run needs.
 * This keeps calling until the claim is terminal.
 *
 * It reports nothing to the UI on purpose: the status tracker already reflects
 * on-chain state, and a second progress indicator for the same thing would only
 * be noise. Failures are left to the tracker too — a stalled claim is refunded
 * by Chainlink Automation at the deadline.
 */
export function useClaimPipeline(claimId: bigint | undefined, status: ClaimStatus | undefined) {
  const inFlight = useRef(false);
  const stop = useRef(false);

  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, [claimId]);

  useEffect(() => {
    if (claimId === undefined || status === undefined) return;
    if (isTerminal(status)) return;
    if (inFlight.current) return;

    inFlight.current = true;
    void (async () => {
      try {
        await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId: Number(claimId) }),
        });
      } catch {
        // Network hiccup: the next status poll re-triggers this effect.
      } finally {
        if (!stop.current) inFlight.current = false;
      }
    })();
  }, [claimId, status]);
}
