import { config } from '../config.js';
import { MODEL, parseJsonBlock, requireAnthropic, textOf } from '../services/anthropic.js';
import { logger } from '../utils/logger.js';
import type { ExtractedData } from './extractor.js';

export interface EstimatedCost {
  min_cost_vnd: number;
  max_cost_vnd: number;
  recommended_payout_vnd: number;
  recommended_payout_usdc: number; // 6 decimals
  reasoning: string;
  parts_breakdown: { part: string; cost: number }[];
}

/** Rough Vietnamese aftermarket part + labour ranges, in VND. */
const PART_PRICES_VND: Record<string, [number, number]> = {
  headlight: [200_000, 800_000],
  mirror: [100_000, 400_000],
  bumper: [500_000, 2_000_000],
  door: [800_000, 3_000_000],
  windshield: [1_500_000, 5_000_000],
  fender: [300_000, 1_500_000],
  seat: [400_000, 2_000_000],
  handlebar: [200_000, 1_000_000],
  exhaust: [500_000, 2_500_000],
};

const DEFAULT_RANGE: [number, number] = [200_000, 800_000];
export const USD_VND_RATE = 25_000;

const SEVERITY_MULTIPLIER: Record<ExtractedData['severity'], number> = {
  severe: 1.5,
  moderate: 1.0,
  minor: 0.6,
};

export function vndToUsdcSixDecimals(vnd: number): number {
  return Math.round((vnd / USD_VND_RATE) * 1_000_000);
}

export function ruleBasedEstimate(extracted: ExtractedData) {
  const multiplier = SEVERITY_MULTIPLIER[extracted.severity];
  const breakdown: { part: string; cost: number }[] = [];
  let minTotal = 0;
  let maxTotal = 0;

  for (const part of extracted.affected_parts) {
    const key = part.toLowerCase();
    const [lo, hi] = PART_PRICES_VND[key] ?? DEFAULT_RANGE;
    const min = lo * multiplier;
    const max = hi * multiplier;
    minTotal += min;
    maxTotal += max;
    breakdown.push({ part: key, cost: Math.round((min + max) / 2) });
  }

  return {
    minTotal: Math.round(minTotal),
    maxTotal: Math.round(maxTotal),
    midpoint: Math.round((minTotal + maxTotal) / 2),
    breakdown,
  };
}

interface SanityCheck {
  looks_reasonable: boolean;
  adjusted_vnd: number;
  reasoning: string;
}

export async function estimatorAgent(extracted: ExtractedData): Promise<EstimatedCost> {
  const { minTotal, maxTotal, midpoint, breakdown } = ruleBasedEstimate(extracted);

  let finalVnd = midpoint;
  let reasoning = `Priced from the parts table across ${breakdown.length} part(s), damage severity ${extracted.severity}.`;

  if (config.MOCK_AI) {
    logger.warn('MOCK_AI enabled — estimator skipping LLM sanity check');
  } else {
    try {
      const prompt = `Repair cost estimate for motorbike damage in Vietnam:
Parts: ${extracted.affected_parts.join(', ') || '(none)'}
Severity: ${extracted.severity}
Rule-based estimate: ${midpoint.toLocaleString('en-US')} VND (range ${minTotal.toLocaleString('en-US')} - ${maxTotal.toLocaleString('en-US')})

Say whether this figure is reasonable, then write a short reasoning (2 sentences, English).
Return JSON only, no markdown: {"looks_reasonable": true|false, "adjusted_vnd": number, "reasoning": "..."}`;

      const response = await requireAnthropic().messages.create({
        model: MODEL,
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const parsed = parseJsonBlock<SanityCheck>(textOf(response));
      if (typeof parsed.reasoning === 'string' && parsed.reasoning.trim()) {
        reasoning = parsed.reasoning.trim();
      }
      if (parsed.looks_reasonable === false && Number.isFinite(parsed.adjusted_vnd)) {
        // Cap the model's adjustment so a hallucinated number cannot inflate a payout.
        finalVnd = Math.round(Math.max(minTotal, Math.min(parsed.adjusted_vnd, maxTotal * 1.5)));
      }
    } catch (err) {
      // The rule-based number stands on its own; the LLM is a sanity check, not a dependency.
      logger.warn({ err: String(err) }, 'Estimator LLM sanity check failed — using rule-based value');
    }
  }

  return {
    min_cost_vnd: minTotal,
    max_cost_vnd: maxTotal,
    recommended_payout_vnd: finalVnd,
    recommended_payout_usdc: vndToUsdcSixDecimals(finalVnd),
    reasoning,
    parts_breakdown: breakdown,
  };
}
