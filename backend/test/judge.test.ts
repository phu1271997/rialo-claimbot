import { describe, expect, it } from 'vitest';
import { judgeAgent, MIN_CONFIDENCE, MIN_CROSS_CHECK_SCORE } from '../src/agents/judge.js';
import type { ExtractedData } from '../src/agents/extractor.js';
import type { VerifiedData } from '../src/agents/verifier.js';
import type { EstimatedCost } from '../src/agents/estimator.js';

const extracted = (over: Partial<ExtractedData> = {}): ExtractedData => ({
  vehicle_type: 'motorbike',
  license_plate: '51-A1-2345',
  damage_locations: ['front'],
  affected_parts: ['headlight', 'mirror'],
  severity: 'moderate',
  confidence: 90,
  red_flags: [],
  image_quality: 'good',
  scene_description: 'Motorbike with a broken headlight',
  ...over,
});

const verified = (over: Partial<VerifiedData> = {}): VerifiedData => ({
  dmv_check: { plate_valid: true, active_insurance: true, owner_verified: true },
  weather_at_scene: null,
  exif: { timestamp: Date.now(), gps: null, device: 'Apple', suspicious: false },
  cross_check_score: 100,
  issues: [],
  ...over,
});

const estimated = (over: Partial<EstimatedCost> = {}): EstimatedCost => ({
  min_cost_vnd: 300_000,
  max_cost_vnd: 1_200_000,
  recommended_payout_vnd: 750_000,
  recommended_payout_usdc: 30_000,
  reasoning: 'Reasonable against prevailing parts prices.',
  parts_breakdown: [{ part: 'headlight', cost: 500_000 }],
  ...over,
});

describe('judgeAgent', () => {
  it('approves a clean claim and carries the estimated amount', () => {
    const v = judgeAgent({ extracted: extracted(), verified: verified(), estimated: estimated() });
    expect(v.approved).toBe(true);
    expect(v.amount).toBe(30_000n);
    expect(v.confidence).toBe(90);
    expect(v.reasoning).toContain('APPROVED');
  });

  it('rejects on any red flag before anything else', () => {
    const v = judgeAgent({
      extracted: extracted({ red_flags: ['edited photo'] }),
      verified: verified(),
      estimated: estimated(),
    });
    expect(v.approved).toBe(false);
    expect(v.amount).toBe(0n);
    expect(v.reasoning).toContain('Red flags');
  });

  it('rejects when the vehicle type is unknown', () => {
    const v = judgeAgent({
      extracted: extracted({ vehicle_type: 'unknown' }),
      verified: verified(),
      estimated: estimated(),
    });
    expect(v.approved).toBe(false);
  });

  it('rejects when the image looks edited', () => {
    const v = judgeAgent({
      extracted: extracted({ image_quality: 'edited_suspected' }),
      verified: verified(),
      estimated: estimated(),
    });
    expect(v.approved).toBe(false);
    expect(v.reasoning).toContain('signs of editing');
  });

  it('rejects below the cross-check threshold', () => {
    const v = judgeAgent({
      extracted: extracted(),
      verified: verified({
        cross_check_score: MIN_CROSS_CHECK_SCORE - 1,
        issues: ['Plate not found in the DMV registry'],
      }),
      estimated: estimated(),
    });
    expect(v.approved).toBe(false);
    expect(v.reasoning).toContain('Verification score');
  });

  it('rejects below the confidence threshold', () => {
    const v = judgeAgent({
      extracted: extracted({ confidence: MIN_CONFIDENCE - 1 }),
      verified: verified(),
      estimated: estimated(),
    });
    expect(v.approved).toBe(false);
    expect(v.reasoning).toContain('Confidence');
  });

  it('takes the lower of extractor confidence and cross-check score', () => {
    const v = judgeAgent({
      extracted: extracted({ confidence: 95 }),
      verified: verified({ cross_check_score: 80 }),
      estimated: estimated(),
    });
    expect(v.confidence).toBe(80);
  });

  it('rejects when no repair cost could be estimated', () => {
    const v = judgeAgent({
      extracted: extracted(),
      verified: verified(),
      estimated: estimated({ recommended_payout_usdc: 0 }),
    });
    expect(v.approved).toBe(false);
  });

  it('clamps the payout to the remaining coverage', () => {
    const v = judgeAgent({
      extracted: extracted(),
      verified: verified(),
      estimated: estimated({ recommended_payout_usdc: 90_000_000 }),
      remainingCoverage: 20_000_000n,
    });
    expect(v.approved).toBe(true);
    expect(v.amount).toBe(20_000_000n);
    expect(v.reasoning).toContain('Capped');
  });

  it('rejects when coverage is fully exhausted', () => {
    const v = judgeAgent({
      extracted: extracted(),
      verified: verified(),
      estimated: estimated(),
      remainingCoverage: 0n,
    });
    expect(v.approved).toBe(false);
    expect(v.reasoning).toContain('coverage is fully exhausted');
  });
});
