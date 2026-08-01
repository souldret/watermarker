import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { drawPreview } from '@/lib/watermark';
import { ImageIcon } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

/** Kompakt önizleme — sabit max boyut, ekranı boğmaz */
const PREVIEW_MAX_W = 220;
const PREVIEW_MAX_H = 280;
/** Slider sürükleme sırasında debounce süresi (ms) */
const PAINT_DEBOUNCE_MS = 40;

export default function PreviewCanvas() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const paintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSource = useAppStore((s) => s.logoSource);
  const logo2Source = useAppStore((s) => s.logo2Source);
  const settings = useAppStore((s) => s.settings);
  const previewImageUrl = useAppStore((s) => s.previewImageUrl);
  const previewPath = useAppStore((s) => s.previewPath);

  const paintNow = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;

    const boxW = Math.min(PREVIEW_MAX_W, Math.max(140, container?.clientWidth || PREVIEW_MAX_W));
    const boxH = Math.min(PREVIEW_MAX_H, Math.max(160, container?.clientHeight || PREVIEW_MAX_H));

    const img = imgRef.current;
    if (!img || !previewImageUrl || !img.naturalWidth || !img.naturalHeight) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = boxW;
        canvas.height = Math.round(boxW * 1.25);
        const styles = getComputedStyle(document.documentElement);
        const raw = styles.getPropertyValue('--ink-deep').trim() || '18 18 26';
        ctx.fillStyle = raw.includes(' ') ? `rgb(${raw})` : raw;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    try {
      drawPreview(
        canvas,
        img,
        img.naturalWidth,
        img.naturalHeight,
        logoSource,
        logo2Source,
        settings,
        boxW,
        boxH,
      );
    } catch {
      // Önizleme hatası UI'yi düşürmesin
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoSource, logo2Source, settings, previewImageUrl]);

  // Debounce wrapper — slider sürükleme gibi hızlı değişimlerde gereksiz yeniden çizimi önler
  const paint = useCallback(() => {
    if (paintTimerRef.current !== null) clearTimeout(paintTimerRef.current);
    paintTimerRef.current = setTimeout(() => {
      paintTimerRef.current = null;
      paintNow();
    }, PAINT_DEBOUNCE_MS);
  }, [paintNow]);

  useEffect(() => {
    imgRef.current = null;
    if (!previewImageUrl) {
      paintNow();
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      paintNow();
    };
    img.onerror = () => {
      if (cancelled) return;
      imgRef.current = null;
      paintNow();
    };
    img.src = previewImageUrl;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewImageUrl]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paintNow());
    });
    ro.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [paintNow]);

  const shortName = previewPath?.split('/').pop() || '';

  return (
    <section className="panel preview-panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('preview')}</h2>
        <span className="max-w-[55%] truncate text-[10px] text-ink-muted" title={shortName}>
          {shortName || t('pick_page')}
        </span>
      </div>
      <div
        ref={containerRef}
        className="preview-stage relative mx-auto flex h-[200px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-lg border border-ink-border bg-ink-deep sm:h-[220px]"
      >
        {!previewImageUrl && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-ink-muted">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <p className="text-[10px] leading-snug">{t('pick_page')}</p>
          </div>
        )}
        <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
      </div>
    </section>
  );
}
