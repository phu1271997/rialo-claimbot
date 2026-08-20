const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud';

export function normalizeCid(hash: string): string {
  return hash.replace(/^ipfs:\/\//, '').replace(/^\/ipfs\//, '');
}

export function ipfsUrl(hash: string): string {
  if (!hash) return '';
  return `${GATEWAY.replace(/\/$/, '')}/ipfs/${normalizeCid(hash)}`;
}
