import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifierAgent } from '@claimbot/pipeline';
import type { ExtractedData } from '@claimbot/pipeline';
import { testContext } from './context.js';

const base: ExtractedData = {
  vehicle_type: 'motorbike',
  license_plate: '51-A1-2345', // ends in 5 -> valid in the mock DMV
  damage_locations: ['front'],
  affected_parts: ['headlight'],
  severity: 'minor',
  confidence: 88,
  red_flags: [],
  image_quality: 'good',
  scene_description: 'Dry road surface',
};

describe('verifierAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a full score when DMV validates the plate', async () => {
    const result = await verifierAgent(base, 'ipfs://QmTest', testContext);
    expect(result.dmv_check?.plate_valid).toBe(true);
    expect(result.dmv_check?.active_insurance).toBe(true);
    // MOCK_AI skips EXIF entirely, so the "no timestamp" issue is expected but unscored.
    expect(result.cross_check_score).toBe(100);
  });

  it('penalises an unreadable plate', async () => {
    const result = await verifierAgent({ ...base, license_plate: null }, 'ipfs://QmTest', testContext);
    expect(result.dmv_check).toBeNull();
    expect(result.issues).toContain('Could not read a plate number from the photo');
    expect(result.cross_check_score).toBe(75);
  });

  it('penalises a plate the DMV rejects', async () => {
    // Ends in 1 -> invalid in the mock DMV, which also implies no active insurance.
    const result = await verifierAgent({ ...base, license_plate: '51-A1-2341' }, 'ipfs://QmTest', testContext);
    expect(result.dmv_check?.plate_valid).toBe(false);
    expect(result.issues).toContain('Plate not found in the DMV registry');
    expect(result.issues).toContain('No active insurance on record');
    expect(result.cross_check_score).toBe(30);
  });

  it('never returns a score outside 0-100', async () => {
    const result = await verifierAgent({ ...base, license_plate: 'XX-0000-0' }, 'ipfs://QmTest', testContext);
    expect(result.cross_check_score).toBeGreaterThanOrEqual(0);
    expect(result.cross_check_score).toBeLessThanOrEqual(100);
  });

  it('flags a missing EXIF timestamp as an issue without scoring it', async () => {
    const result = await verifierAgent(base, 'ipfs://QmTest', testContext);
    expect(result.issues).toContain('Photo has no EXIF timestamp');
    expect(result.exif.suspicious).toBe(false);
  });
});
