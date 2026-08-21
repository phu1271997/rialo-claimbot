import type { ExtractedData } from './extractor.js';
import { checkVehicle, type DmvRecord } from '../services/mockDMV.js';
import { getWeatherAt } from '../services/weather.js';
import { extractEXIF } from '../services/exif.js';
import { fetchIPFS } from '../services/ipfs.js';
import type { PipelineContext } from '../types.js';

export interface VerifiedData {
  dmv_check: DmvRecord | null;
  weather_at_scene: { temp: number; conditions: string; matches_scene: boolean } | null;
  exif: {
    timestamp: number | null;
    gps: { lat: number; lng: number } | null;
    device: string | null;
    suspicious: boolean;
  };
  cross_check_score: number;
  issues: string[];
}

const WET_SCENE = /wet|rain|puddle|damp|soaked/i;
const RAINY_CONDITIONS = /rain|drizzle|thunderstorm/i;

/** Penalty weights. DMV validity dominates because it is the only hard identity signal. */
const PENALTY = {
  plateUnreadable: 25,
  plateInvalid: 40,
  noActiveInsurance: 30,
  exifSuspicious: 15,
  weatherMismatch: 15,
} as const;

export async function verifierAgent(
  extracted: ExtractedData,
  evidenceIPFS: string,
  { config, logger }: PipelineContext,
): Promise<VerifiedData> {
  const issues: string[] = [];
  let score = 100;

  // ── DMV cross-check ──
  let dmv: DmvRecord | null = null;
  if (extracted.license_plate) {
    try {
      dmv = await checkVehicle(extracted.license_plate);
      if (!dmv.plate_valid) {
        issues.push('Plate not found in the DMV registry');
        score -= PENALTY.plateInvalid;
      }
      if (!dmv.active_insurance) {
        issues.push('No active insurance on record');
        score -= PENALTY.noActiveInsurance;
      }
    } catch (err) {
      logger.warn({ err: String(err) }, 'DMV lookup failed');
      issues.push('DMV lookup failed');
      score -= PENALTY.plateInvalid;
    }
  } else {
    issues.push('Could not read a plate number from the photo');
    score -= PENALTY.plateUnreadable;
  }

  // ── EXIF ──
  let exif = { timestamp: null as number | null, gps: null as { lat: number; lng: number } | null, device: null as string | null };
  if (!config.mockAI) {
    try {
      exif = await extractEXIF(await fetchIPFS(evidenceIPFS, config));
    } catch (err) {
      logger.warn({ err: String(err) }, 'EXIF read failed — treated as missing metadata');
    }
  }

  const futureTimestamp = exif.timestamp !== null && exif.timestamp > Date.now();
  // Missing EXIF alone is not suspicious: messaging apps routinely strip it.
  const suspicious = futureTimestamp;

  if (!exif.timestamp) issues.push('Photo has no EXIF timestamp');
  if (futureTimestamp) {
    issues.push('EXIF timestamp is in the future');
    score -= PENALTY.exifSuspicious;
  }

  // ── Weather cross-check (bonus signal, only when GPS + time survive) ──
  let weather: VerifiedData['weather_at_scene'] = null;
  if (exif.gps && exif.timestamp && config.openWeatherKey) {
    try {
      const reading = await getWeatherAt(exif.gps.lat, exif.gps.lng, exif.timestamp, config);
      const sceneLooksWet = WET_SCENE.test(extracted.scene_description);
      const actuallyRained = RAINY_CONDITIONS.test(reading.conditions);
      const matches = sceneLooksWet === actuallyRained;

      weather = { temp: reading.temp, conditions: reading.conditions, matches_scene: matches };
      if (!matches) {
        issues.push('Scene in the photo does not match the recorded weather');
        score -= PENALTY.weatherMismatch;
      }
    } catch (err) {
      logger.warn({ err: String(err) }, 'Weather lookup failed — skipping cross-check');
    }
  }

  return {
    dmv_check: dmv,
    weather_at_scene: weather,
    exif: { ...exif, suspicious },
    cross_check_score: Math.max(0, Math.min(100, score)),
    issues,
  };
}
