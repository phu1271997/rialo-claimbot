import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/** Pinata first, then public mirrors — Pinata's gateway is the flaky part of the demo. */
const GATEWAYS = [config.PINATA_GATEWAY, 'https://ipfs.io', 'https://cloudflare-ipfs.com'];

const FETCH_TIMEOUT_MS = 15_000;

export function normalizeCid(hash: string): string {
  return hash.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');
}

export function gatewayUrl(hash: string, gateway = config.PINATA_GATEWAY): string {
  return `${gateway.replace(/\/$/, '')}/ipfs/${normalizeCid(hash)}`;
}

export async function fetchIPFS(hash: string): Promise<Buffer> {
  const cid = normalizeCid(hash);
  const errors: string[] = [];

  for (const gateway of GATEWAYS) {
    const url = gatewayUrl(cid, gateway);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        errors.push(`${gateway}: HTTP ${res.status}`);
        continue;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      errors.push(`${gateway}: ${String(err)}`);
    }
  }

  logger.error({ cid, errors }, 'All IPFS gateways failed');
  throw new Error(`IPFS fetch failed for ${cid}: ${errors.join(' | ')}`);
}

/** Sniffs the media type so Claude Vision gets the right `media_type`. */
export function detectMediaType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'image/jpeg';
}
