import exifr from 'exifr';

export interface ExifData {
  timestamp: number | null;
  gps: { lat: number; lng: number } | null;
  device: string | null;
}

/**
 * Missing EXIF is normal, not fraud — WhatsApp, Messenger and Zalo all strip it.
 * The verifier treats this as a weak signal only.
 */
export async function extractEXIF(buf: Uint8Array): Promise<ExifData> {
  try {
    const data = await exifr.parse(buf, { gps: true });
    if (!data) return { timestamp: null, gps: null, device: null };

    const taken: unknown = data.DateTimeOriginal ?? data.CreateDate;
    const timestamp = taken instanceof Date ? taken.getTime() : null;

    return {
      timestamp,
      gps:
        typeof data.latitude === 'number' && typeof data.longitude === 'number'
          ? { lat: data.latitude, lng: data.longitude }
          : null,
      device: typeof data.Make === 'string' ? data.Make : null,
    };
  } catch {
    return { timestamp: null, gps: null, device: null };
  }
}
