export * from './types.js';

export { extractorAgent, normalizeExtracted, type ExtractedData } from './agents/extractor.js';
export { verifierAgent, type VerifiedData } from './agents/verifier.js';
export {
  estimatorAgent,
  ruleBasedEstimate,
  vndToUsdcSixDecimals,
  USD_VND_RATE,
  type EstimatedCost,
} from './agents/estimator.js';
export {
  judgeAgent,
  MIN_CONFIDENCE,
  MIN_CROSS_CHECK_SCORE,
  type Verdict,
  type JudgeInput,
} from './agents/judge.js';

export { checkVehicle, type DmvRecord } from './services/mockDMV.js';
export { fetchIPFS, gatewayUrl, normalizeCid, detectMediaType, toBase64 } from './services/ipfs.js';
export { extractEXIF, type ExifData } from './services/exif.js';
export { getWeatherAt, type WeatherReading } from './services/weather.js';
export { parseJsonBlock, textOf, anthropicClient } from './services/anthropic.js';

export { retry, sleep, type RetryOptions } from './utils/retry.js';
export { signVerdict, verdictPayloadHash } from './utils/signature.js';

/** Claim lifecycle states, mirroring ClaimRegistry.Status. */
export enum ClaimStatus {
  Submitted = 0,
  Extracting = 1,
  Verifying = 2,
  Estimating = 3,
  Judged = 4,
  Paid = 5,
  Rejected = 6,
  Refunded = 7,
  Disputed = 8,
}
