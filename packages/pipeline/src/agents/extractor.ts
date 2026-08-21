import { anthropicClient, parseJsonBlock, textOf } from '../services/anthropic.js';
import { detectMediaType, fetchIPFS, toBase64 } from '../services/ipfs.js';
import type { PipelineContext } from '../types.js';

export interface ExtractedData {
  vehicle_type: 'motorbike' | 'car' | 'unknown';
  license_plate: string | null;
  damage_locations: string[];
  affected_parts: string[];
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
  red_flags: string[];
  image_quality: 'good' | 'blurry' | 'edited_suspected';
  scene_description: string;
}

const SYSTEM_PROMPT = `You are a vehicle insurance loss adjuster in Vietnam with 15 years of experience.
Analyse the damage photo provided and return JSON matching the schema exactly. Rules:
- If the image is not a vehicle, set vehicle_type = "unknown" and confidence = 0
- If you see signs of photo editing or a re-photographed screen, add them to red_flags
- Severity follows the number of damaged parts and how badly they are damaged
- Return JSON only. No markdown, no explanation.`;

const USER_PROMPT = `Analyse this photo and return JSON matching this schema:
{
  "vehicle_type": "motorbike|car|unknown",
  "license_plate": "the plate number, or null",
  "damage_locations": ["front"|"rear"|"left"|"right"|"top"],
  "affected_parts": ["bumper"|"headlight"|"mirror"|"door"|"windshield"|"fender"|"seat"|"handlebar"|"exhaust"],
  "severity": "minor|moderate|severe",
  "confidence": 0-100,
  "red_flags": ["edited photo", "damage is inconsistent", ...],
  "image_quality": "good|blurry|edited_suspected",
  "scene_description": "short description of the scene in the photo"
}`;

const VEHICLE_TYPES = new Set(['motorbike', 'car', 'unknown']);
const SEVERITIES = new Set(['minor', 'moderate', 'severe']);
const QUALITIES = new Set(['good', 'blurry', 'edited_suspected']);

/** Trusts the model for judgement but not for shape — a bad field must not reach the chain. */
export function normalizeExtracted(raw: Partial<ExtractedData>): ExtractedData {
  const asStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0;

  return {
    vehicle_type: VEHICLE_TYPES.has(raw.vehicle_type as string)
      ? (raw.vehicle_type as ExtractedData['vehicle_type'])
      : 'unknown',
    license_plate: typeof raw.license_plate === 'string' && raw.license_plate.trim() !== ''
      ? raw.license_plate.trim()
      : null,
    damage_locations: asStrings(raw.damage_locations),
    affected_parts: asStrings(raw.affected_parts).map((p) => p.toLowerCase()),
    severity: SEVERITIES.has(raw.severity as string)
      ? (raw.severity as ExtractedData['severity'])
      : 'minor',
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    red_flags: asStrings(raw.red_flags),
    image_quality: QUALITIES.has(raw.image_quality as string)
      ? (raw.image_quality as ExtractedData['image_quality'])
      : 'good',
    scene_description: typeof raw.scene_description === 'string' ? raw.scene_description : '',
  };
}

const MOCK_RESULT: ExtractedData = {
  vehicle_type: 'motorbike',
  license_plate: '51-A1-2345',
  damage_locations: ['front', 'left'],
  affected_parts: ['headlight', 'mirror'],
  severity: 'moderate',
  confidence: 87,
  red_flags: [],
  image_quality: 'good',
  scene_description: 'Motorbike parked at the roadside, broken headlight and snapped left mirror, dry road surface.',
};

export async function extractorAgent(
  evidenceIPFS: string,
  { config, logger }: PipelineContext,
): Promise<ExtractedData> {
  if (config.mockAI) {
    logger.warn({ evidenceIPFS }, 'MOCK_AI enabled — extractor returning canned result');
    return MOCK_RESULT;
  }

  const imageData = await fetchIPFS(evidenceIPFS, config);
  const mediaType = detectMediaType(imageData);

  const response = await anthropicClient(config).messages.create({
    model: config.anthropicModel,
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: toBase64(imageData) },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });

  return normalizeExtracted(parseJsonBlock<Partial<ExtractedData>>(textOf(response)));
}
