import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Keyless, content-addressed fallback for evidence photos.
 *
 * The product path pins to IPFS through Pinata. But Pinata needs an account, and
 * a demo — or a local test with no credentials — should still work end to end.
 * So when `PINATA_JWT` is absent, `/api/upload` writes the bytes here instead and
 * hands back a content hash that behaves like a CID: `submitClaim` stores
 * `ipfs://<hash>` on-chain, and the pipeline reads it back through the `/ipfs`
 * route on this same server (see `EVIDENCE_GATEWAY`).
 *
 * The store lives in the OS temp dir so it survives across requests within a
 * single server process without polluting the repo. It is not durable across a
 * cold serverless start — which is exactly why real deployments set PINATA_JWT.
 */
const STORE_DIR = join(tmpdir(), 'claimbot-evidence');

/** CIDv0-shaped names are 46 chars of base58; ours are hex, so tag them to avoid confusion. */
const PREFIX = 'local-';

function pathFor(cid: string): string {
  // Guard against traversal — a CID is only ever our own hex hash.
  const safe = cid.replace(/[^a-zA-Z0-9-]/g, '');
  return join(STORE_DIR, safe);
}

export function isLocalCid(cid: string): boolean {
  return cid.startsWith(PREFIX);
}

/** Stores bytes under their SHA-256 and returns the CID-like hash. Idempotent. */
export async function putEvidence(bytes: Uint8Array): Promise<string> {
  const digest = createHash('sha256').update(bytes).digest('hex');
  const cid = `${PREFIX}${digest}`;
  await mkdir(STORE_DIR, { recursive: true });
  const dest = pathFor(cid);
  if (!existsSync(dest)) {
    await writeFile(dest, bytes);
  }
  return cid;
}

/** Reads bytes back for a local CID, or null if this server never stored it. */
export async function getEvidence(cid: string): Promise<Uint8Array | null> {
  const src = pathFor(cid);
  if (!existsSync(src)) return null;
  return new Uint8Array(await readFile(src));
}
