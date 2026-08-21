import { describe, expect, it } from 'vitest';
import { estimatorAgent, ruleBasedEstimate, USD_VND_RATE, vndToUsdcSixDecimals } from '@claimbot/pipeline';
import type { ExtractedData } from '@claimbot/pipeline';
import { testContext } from './context.js';

const extracted = (over: Partial<ExtractedData> = {}): ExtractedData => ({
  vehicle_type: 'motorbike',
  license_plate: '51-A1-2345',
  damage_locations: ['front'],
  affected_parts: ['headlight', 'mirror'],
  severity: 'moderate',
  confidence: 90,
  red_flags: [],
  image_quality: 'good',
  scene_description: '',
  ...over,
});

describe('ruleBasedEstimate', () => {
  it('sums the known part ranges at the moderate multiplier', () => {
    const { minTotal, maxTotal, breakdown } = ruleBasedEstimate(extracted());
    expect(minTotal).toBe(200_000 + 100_000);
    expect(maxTotal).toBe(800_000 + 400_000);
    expect(breakdown).toHaveLength(2);
  });

  it('scales with severity', () => {
    const minor = ruleBasedEstimate(extracted({ severity: 'minor' })).midpoint;
    const moderate = ruleBasedEstimate(extracted({ severity: 'moderate' })).midpoint;
    const severe = ruleBasedEstimate(extracted({ severity: 'severe' })).midpoint;
    expect(minor).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(severe);
  });

  it('falls back to a default range for unknown parts', () => {
    const { minTotal, maxTotal } = ruleBasedEstimate(
      extracted({ affected_parts: ['tail_fairing'], severity: 'moderate' }),
    );
    expect(minTotal).toBe(200_000);
    expect(maxTotal).toBe(800_000);
  });

  it('returns zero for no damaged parts', () => {
    const { minTotal, maxTotal, midpoint } = ruleBasedEstimate(extracted({ affected_parts: [] }));
    expect(minTotal).toBe(0);
    expect(maxTotal).toBe(0);
    expect(midpoint).toBe(0);
  });
});

describe('vndToUsdcSixDecimals', () => {
  it('converts at the configured rate with 6 decimals', () => {
    expect(vndToUsdcSixDecimals(USD_VND_RATE)).toBe(1_000_000); // 1 USDC
    expect(vndToUsdcSixDecimals(750_000)).toBe(30_000_000); // 750k VND = $30
  });
});

describe('estimatorAgent (MOCK_AI)', () => {
  it('returns the rule-based midpoint without calling an LLM', async () => {
    const result = await estimatorAgent(extracted(), testContext);
    expect(result.recommended_payout_vnd).toBe(750_000);
    expect(result.recommended_payout_usdc).toBe(vndToUsdcSixDecimals(750_000));
    expect(result.parts_breakdown).toHaveLength(2);
  });
});
