import type { PipelineConfig } from '../types.js';

const FETCH_TIMEOUT_MS = 15_000;

export function normalizeCid(hash: string): string {
  return hash.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');
}

export function gatewayUrl(hash: string, gateway: string): string {
  return `${gateway.replace(/\/$/, '')}/ipfs/${normalizeCid(hash)}`;
}

/** Pinata first, then public mirrors — Pinata's gateway is the flaky part of a demo. */
export async function fetchIPFS(hash: string, config: PipelineConfig): Promise<Uint8Array> {
  const gateways = [config.pinataGateway, 'https://ipfs.io', 'https://cloudflare-ipfs.com'];
  const cid = normalizeCid(hash);
  const errors: string[] = [];

  for (const gateway of gateways) {
    try {
      const res = await fetch(gatewayUrl(cid, gateway), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        errors.push(`${gateway}: HTTP ${res.status}`);
        continue;
      }
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      errors.push(`${gateway}: ${String(err)}`);
    }
  }
  throw new Error(`IPFS fetch failed for ${cid}: ${errors.join(' | ')}`);
}

/** Sniffs the media type so Claude Vision gets the right `media_type`. */
export function detectMediaType(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (String.fromCharCode(...buf.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return 'image/jpeg';
}

/** Base64 without depending on Node's Buffer, so this runs on edge runtimes too. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
