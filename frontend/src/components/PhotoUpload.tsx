'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/cn';
import { Spinner } from './ui/Spinner';

const MAX_SIZE_MB = 2;

export function PhotoUpload({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const next = accepted[0];
      if (!next) return;

      setError(null);
      setCompressing(true);
      try {
        // Pinata and the vision model both choke on 12MP phone photos; shrink first.
        const compressed = await imageCompression(next, {
          maxSizeMB: MAX_SIZE_MB,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
        });
        onChange(new File([compressed], next.name, { type: compressed.type }));
      } catch {
        setError('Không nén được ảnh, thử ảnh khác nhé');
        onChange(null);
      } finally {
        setCompressing(false);
      }
    },
    [onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    multiple: false,
  });

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition',
          isDragActive ? 'border-accent bg-accent/5' : 'border-white/15 hover:border-white/30',
        )}
      >
        <input {...getInputProps()} />
        {compressing ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Đang nén ảnh…
          </div>
        ) : preview ? (
          // Blob preview of a user-selected file; next/image would need a remote loader.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Ảnh damage đã chọn" className="max-h-64 rounded-xl object-contain" />
        ) : (
          <div className="space-y-1">
            <div className="text-3xl">📷</div>
            <div className="font-medium">Kéo thả ảnh damage vào đây</div>
            <div className="text-sm text-slate-500">hoặc bấm để chọn — JPG/PNG, tự nén xuống {MAX_SIZE_MB}MB</div>
          </div>
        )}
      </div>

      {file && !compressing && (
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="truncate">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-red-400 hover:underline">
            Xoá
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
