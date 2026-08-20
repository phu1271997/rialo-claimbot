import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Server-side proxy so PINATA_JWT never reaches the browser.
 */
export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: 'IPFS upload chưa được cấu hình: thiếu PINATA_JWT trên server.' },
      { status: 503 },
    );
  }

  let file: File | null;
  try {
    const formData = await req.formData();
    const entry = formData.get('file');
    file = entry instanceof File ? entry : null;
  } catch {
    return NextResponse.json({ error: 'Request không hợp lệ' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'Thiếu file trong request' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Định dạng không hỗ trợ: ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Ảnh vượt quá 5MB' }, { status: 413 });
  }

  const pinataForm = new FormData();
  pinataForm.append('file', file);
  pinataForm.append('pinataMetadata', JSON.stringify({ name: `claimbot-${Date.now()}` }));

  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Pinata từ chối upload (HTTP ${res.status})`, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { IpfsHash?: string };
    if (!data.IpfsHash) {
      return NextResponse.json({ error: 'Pinata không trả về IpfsHash' }, { status: 502 });
    }

    return NextResponse.json({ ipfsHash: data.IpfsHash });
  } catch (err) {
    return NextResponse.json(
      { error: 'Không kết nối được Pinata', detail: String(err).slice(0, 200) },
      { status: 502 },
    );
  }
}
