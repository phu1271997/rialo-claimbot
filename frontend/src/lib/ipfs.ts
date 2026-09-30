const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud';

export function normalizeCid(hash: string): string {
  return hash.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');
}

/** Keyless-fallback evidence is served by this app, not a public gateway. */
function isLocalCid(cid: string): boolean {
  return cid.startsWith('local-');
}

export function ipfsUrl(hash: string): string {
  if (!hash) return '';
  const cid = normalizeCid(hash);
  if (isLocalCid(cid)) return `/ipfs/${cid}`;
  return `${GATEWAY.replace(/\/$/, '')}/ipfs/${cid}`;
}
