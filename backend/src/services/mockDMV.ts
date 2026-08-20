import { sleep } from '../utils/retry.js';

export interface DmvRecord {
  plate_valid: boolean;
  active_insurance: boolean;
  owner_verified: boolean;
}

/**
 * Stand-in for the Vietnamese vehicle registry, which has no public API.
 * Deterministic on the plate so demo runs are reproducible.
 * Production swaps this for the Chainlink Functions call in VehicleVerifier.sol.
 */
export async function checkVehicle(plate: string): Promise<DmvRecord> {
  await sleep(300);

  const normalized = plate.replace(/[^0-9A-Za-z]/g, '');
  const lastChar = normalized.slice(-1);
  const valid = ['5', '6', '7', '8', '9'].includes(lastChar);

  return { plate_valid: valid, active_insurance: valid, owner_verified: valid };
}
