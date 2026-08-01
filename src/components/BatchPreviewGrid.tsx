/**
 * BatchPreviewGrid.tsx
 * Seçili seriden 4-6 farklı sayfayı aynı anda watermark uygulanmış
 * thumbnail olarak gösterir. Kullanıcı "tek sayfada iyi görünen ayar
 * diğerlerinde nasıl duruyor" sorusunu global ayar değiştirmeden görebilir.
 */
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { Grid3x3, ImageIcon } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { drawPreview } from '@/lib/watermark';
import { useI18n } from '@/hooks/useI18n';

const THUMB_MAX_W = 160;
const THUMB_MAX_H = 220;
const PAINT_DEBOUNCE_MS = 80;

/** 4-6 temsili sayfa seç: ilk, son, ortalar ve en uzun/en kısa oranlı */
function selectRepresentativePages(
  chapters: { name: string; images: { name: string; path: string; file: File }[] }[],
  maxCount = 5,
): { name: string; file: File }[] {
  const all = chapters.flatMap((c) =>
    c.images.map((img) => ({ name: img.name, file: img.file })),
  );
  if (all.length === 0) return [];
  if (all.length <= maxCount) return all;

  const selected: typeof all = [];
  // İlk
  selected.push(all[0]);
  // Son
  if (all.length > 1) selected.push(all[all.length - 1]);
  // Orta
  const mid = Math.floor(all.length / 2);
  if (!selected.includes(all[mid])) selected.push(all[mid]);
  // Çeyrekler
  const q1 = Math.floor(all.length * 0.25);
  const q3 = Math.floor(all.length * 0.75);
  if (!selected.includes(all[q1])) selected.push(all[q1]);
  if (!selected.includes(all[q3])) selected.push(all[q3]);

  return selected.slice(0, maxCount);
}

interface ThumbCanvasProps {
  file: File;
  label: string;
}

function ThumbCanvas({ file, label }: ThumbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logoSource = useAppStore((s) => s.logoSource);
  const logo2Source = useAppStore((s) => s.logo2Source);
  const settings = useAppStore((s) => s.settings);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth || !img.naturalHeight) return;
    try {
      drawPreview(
        canvas, img,
        img.naturalWidth, img.naturalHeight,
        logoSource, logo2Source, settings,
        THUMB_MAX_W, THUMB_MAX_H,
      );
    } catch {
      // thumbnail hatası kritik değil
    }
  }, [logoSource, logo2Source, settings]);

  const debouncedPaint = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      paint();
    }, PAINT_DEBOUNCE_MS);
  }, [paint]);

  // Görsel yükle
  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      paint();
    };
    img.onerror = () => { imgRef.current = null; };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Ayar değişince yeniden çiz
  useEffect(() => { debouncedPaint(); }, [debouncedPaint]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded border border-ink-border bg-ink-deep"
        style={{ width: THUMB_MAX_W, minHeight: 60 }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>
      <span
        className="max-w-[160px] truncate text-center text-[10px] text-ink-muted"
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

export default function BatchPreviewGrid() {
  const { t } = useI18n();
  const chapters = useAppStore((s) => s.chapters);

  const pages = useMemo(
    () => selectRepresentativePages(chapters, 5),
    // Bölüm listesi değişince yeniden hesapla (referans karşılaştırması yeterli)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapters.length, chapters.map((c) => c.images.length).join(',')],
  );

  if (pages.length === 0) return null;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title flex items-center gap-1.5">
          <Grid3x3 className="h-3.5 w-3.5 text-seal" />
          {t('batch_preview_grid') ?? 'Toplu Önizleme'}
        </h2>
        <span className="text-[10px] text-ink-muted">
          {pages.length} {t('batch_preview_pages') ?? 'sayfa'}
        </span>
      </div>

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-3 pt-1">
          {pages.map((p, i) => (
            <ThumbCanvas key={`${p.name}-${i}`} file={p.file} label={p.name} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-ink-muted">
          <ImageIcon className="h-6 w-6 opacity-30" />
          <p className="text-xs">{t('pick_page')}</p>
        </div>
      )}
    </section>
  );
}