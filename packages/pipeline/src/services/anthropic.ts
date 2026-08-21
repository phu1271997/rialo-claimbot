import Anthropic from '@anthropic-ai/sdk';
import type { PipelineConfig } from '../types.js';

export function anthropicClient(config: PipelineConfig): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured (set MOCK_AI to run without it)');
  }
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

/**
 * LLMs sometimes wrap JSON in prose or a markdown fence despite instructions.
 * Pull out the first object rather than trusting the whole response.
 */
export function parseJsonBlock<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(match[0]) as T;
  } catch (err) {
    throw new Error(`LLM returned malformed JSON: ${String(err)}`);
  }
}

export function textOf(response: Anthropic.Message): string {
  const block = response.content.find((c) => c.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in LLM response');
  return block.text;
}
