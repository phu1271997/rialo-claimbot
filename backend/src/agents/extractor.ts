import { config } from '../config.js';
import { MODEL, parseJsonBlock, requireAnthropic, textOf } from '../services/anthropic.js';
import { detectMediaType, fetchIPFS } from '../services/ipfs.js';
import { logger } from '../utils/logger.js';

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

const SYSTEM_PROMPT = `Bạn là chuyên viên giám định bảo hiểm xe tại Việt Nam với 15 năm kinh nghiệm.
Phân tích ảnh damage được cung cấp và trả về JSON đúng schema. Chú ý:
- Nếu ảnh không phải xe → vehicle_type = "unknown" và confidence = 0
- Nếu phát hiện dấu hiệu chỉnh sửa ảnh, chụp lại màn hình → thêm vào red_flags
- Severity dựa trên số part hư + độ hư
- Chỉ trả JSON, không markdown, không giải thích thêm`;

const USER_PROMPT = `Phân tích ảnh này và trả về JSON theo schema:
{
  "vehicle_type": "motorbike|car|unknown",
  "license_plate": "biển số hoặc null",
  "damage_locations": ["front"|"rear"|"left"|"right"|"top"],
  "affected_parts": ["bumper"|"headlight"|"mirror"|"door"|"windshield"|"fender"|"seat"|"handlebar"|"exhaust"],
  "severity": "minor|moderate|severe",
  "confidence": 0-100,
  "red_flags": ["ảnh chỉnh sửa", "damage không nhất quán", ...],
  "image_quality": "good|blurry|edited_suspected",
  "scene_description": "mô tả ngắn cảnh trong ảnh"
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
  scene_description: 'Xe máy đỗ bên đường, đèn trước vỡ và gương trái gãy, mặt đường khô.',
};

export async function extractorAgent(evidenceIPFS: string): Promise<ExtractedData> {
  if (config.MOCK_AI) {
    logger.warn({ evidenceIPFS }, 'MOCK_AI enabled — extractor returning canned result');
    return MOCK_RESULT;
  }

  const imageData = await fetchIPFS(evidenceIPFS);
  const mediaType = detectMediaType(imageData);

  const response = await requireAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData.toString('base64') },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });

  return normalizeExtracted(parseJsonBlock<Partial<ExtractedData>>(textOf(response)));
}
