import { getEvidence, isLocalCid } from '@/server/evidenceStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SNIFF: Array<[RegExp | ((b: Uint8Array) => boolean), string]> = [
  [(b) => b[0] === 0xff && b[1] === 0xd8, 'image/jpeg'],
  [(b) => b[0] === 0x89 && b[1] === 0x50, 'image/png'],
  [(b) => String.fromCharCode(...b.subarray(8, 12)) === 'WEBP', 'image/webp'],
];

function contentType(bytes: Uint8Array): string {
  for (const [test, type] of SNIFF) {
    if (typeof test === 'function' && test(bytes)) return type;
  }
  return 'application/octet-stream';
}

/**
 * Serves evidence stored by the keyless upload fallback, so the same server that
 * accepted the photo can hand it back to the AI pipeline (and to image previews)
 * as if it were an IPFS gateway. Real IPFS CIDs are not our concern here — they
 * resolve through public gateways — so we only answer for our own `local-` hashes.
 */
export async function GET(_req: Request, { params }: { params: { cid: string } }) {
  const cid = params.cid;
  if (!isLocalCid(cid)) {
    return new Response('Not a local evidence CID', { status: 404 });
  }

  const bytes = await getEvidence(cid);
  if (!bytes) {
    return new Response('Evidence not found on this server', { status: 404 });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': contentType(bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
