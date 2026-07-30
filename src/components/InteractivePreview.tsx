import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Maximize2, X, MousePointer2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { drawPreview } from '@/lib/watermark';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import type { CustomXY } from '@/lib/types';

/** Büyük interaktif önizleme — tıklayarak logo konumunu belirle */
export default function InteractivePreview() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const logoSource = useAppStore((s) => s.logoSource);
  const logo2Source = useAppStore((s) => s.logo2Source);
  const settings = useAppStore((s) => s.settings);
  const previewImageUrl = useAppStore((s) => s.previewImageUrl);
  const setLogo1CustomXY = useAppStore((s) => s.setLogo1CustomXY);
  const patchLogo2Settings = useAppStore((s) => s.patchLogo2Settings);

  const logo1XY = settings.logo1CustomXY;
  const logo2XY = settings.logo2?.customXY;

  // Hangi logo'yu konumlandırıyoruz
  const [pinTarget, setPinTarget] = useState<'logo1' | 'logo2' | null>(null);
  const [hoverXY, setHoverXY] = useState<{ x: number; y: number } | null>(null);

  const getMaxDims = () => {
    const container = containerRef.current;
    if (!container) return { maxW: 520, maxH: 720 };
    const rect = container.getBoundingClientRect();
    return {
      maxW: Math.max(200, rect.width - 4),
      maxH: Math.max(200, rect.height - 4),
    };
  };

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imgRef.current;
    if (!img || !previewImageUrl || !img.naturalWidth || !img.naturalHeight) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 520;
        canvas.height = 640;
        const styles = getComputedStyle(document.documentElement);
        const raw = styles.getPropertyValue('--ink-deep').trim() || '18 18 26';
        ctx.fillStyle = raw.includes(' ') ? `rgb(${raw})` : raw;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const { maxW, maxH } = getMaxDims();
    try {
      drawPreview(canvas, img, img.naturalWidth, img.naturalHeight, logoSource, logo2Source, settings, maxW, maxH);
    } catch {
      // önizleme hatası kritik değil
    }

    // Hover crosshair overlay
    if (pinTarget && hoverXY) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cx = hoverXY.x * canvas.width;
      const cy = hoverXY.y * canvas.height;
      ctx.save();
      ctx.strokeStyle = pinTarget === 'logo1' ? 'rgba(255,77,77,0.85)' : 'rgba(80,180,255,0.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, [previewImageUrl, logoSource, logo2Source, settings, pinTarget, hoverXY]);

  // Görsel yükle
  useEffect(() => {
    imgRef.current = null;
    if (!previewImageUrl) { paint(); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) { imgRef.current = img; paint(); } };
    img.onerror = () => { if (!cancelled) { imgRef.current = null; paint(); } };
    img.src = previewImageUrl;
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewImageUrl]);

  // Ayar/logo değişince yeniden çiz
  useEffect(() => { paint(); }, [paint]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); });
    ro.observe(container);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [paint]);

  // Canvas'a tıklama/fare koordinatı → 0-1 oranı (CSS px → canvas px → oran)
  const relativeXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>): CustomXY | null => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = Math.max(0, (e.clientX - rect.left) * scaleX);
    const py = Math.max(0, (e.clientY - rect.top) * scaleY);
    return {
      x: Math.min(1, Math.max(0, px / canvas.width)),
      y: Math.min(1, Math.max(0, py / canvas.height)),
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pinTarget) return;
    const xy = relativeXY(e);
    if (!xy) return;
    if (pinTarget === 'logo1') setLogo1CustomXY(xy);
    else patchLogo2Settings({ customXY: xy });
    setPinTarget(null);
    setHoverXY(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pinTarget) return;
    const xy = relativeXY(e);
    if (!xy) return;
    setHoverXY(xy);
  };

  const hasLogo1 = Boolean(logoSource);
  const hasLogo2 = Boolean(logo2Source) && Boolean(settings.logo2?.enabled);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title flex items-center gap-1.5">
          <Maximize2 className="h-3.5 w-3.5 text-seal" />
          {t('interactive_preview')}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Logo 1 konumlandır */}
          {hasLogo1 && (
            <button
              type="button"
              onClick={() => setPinTarget(pinTarget === 'logo1' ? null : 'logo1')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition',
                pinTarget === 'logo1'
                  ? 'border-seal bg-seal/15 text-seal'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:border-seal/40',
              )}
            >
              <MousePointer2 className="h-3 w-3" />
              {pinTarget === 'logo1' ? t('click_to_place') : t('pin_logo1')}
            </button>
          )}
          {/* Logo 2 konumlandır */}
          {hasLogo2 && (
            <button
              type="button"
              onClick={() => setPinTarget(pinTarget === 'logo2' ? null : 'logo2')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition',
                pinTarget === 'logo2'
                  ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:border-sky-400/40',
              )}
            >
              <MousePointer2 className="h-3 w-3" />
              {pinTarget === 'logo2' ? t('click_to_place') : t('pin_logo2')}
            </button>
          )}
          {/* Serbest konumları sıfırla */}
          {(logo1XY || logo2XY) && (
            <button
              type="button"
              onClick={() => { setLogo1CustomXY(null); patchLogo2Settings({ customXY: null }); }}
              className="inline-flex items-center gap-1 rounded-md border border-ink-border bg-ink-deep px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink-text"
            >
              <X className="h-3 w-3" />
              {t('reset_pin')}
            </button>
          )}
        </div>
      </div>

      {/* Aktif pin modu açıklaması */}
      {pinTarget && (
        <div className={cn(
          'mb-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]',
          pinTarget === 'logo1'
            ? 'border-seal/40 bg-seal/10 text-seal'
            : 'border-sky-400/40 bg-sky-400/10 text-sky-300',
        )}>
          <Crosshair className="h-3.5 w-3.5" />
          {pinTarget === 'logo1' ? t('pin_logo1_hint') : t('pin_logo2_hint')}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-ink-border bg-ink-deep"
        style={{ minHeight: '320px', maxHeight: '680px' }}
      >
        {!previewImageUrl && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-ink-muted">
            <Maximize2 className="h-8 w-8 opacity-25" />
            <p className="text-xs">{t('pick_page')}</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverXY(null)}
          className={cn(
            'block h-full w-full object-contain',
            pinTarget ? 'cursor-crosshair' : 'cursor-default',
          )}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        {/* Sabit konum imleri */}
        {logo1XY && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${logo1XY.x * 100}%`, top: `${logo1XY.y * 100}%` }}
          >
            <div className="h-3 w-3 rounded-full border-2 border-seal bg-seal/50 shadow" />
          </div>
        )}
        {logo2XY && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${logo2XY.x * 100}%`, top: `${logo2XY.y * 100}%` }}
          >
            <div className="h-3 w-3 rounded-full border-2 border-sky-400 bg-sky-400/50 shadow" />
          </div>
        )}
      </div>

      {/* Aktif serbest konum bilgisi */}
      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-ink-muted">
        {logo1XY && (
          <span className="rounded bg-seal/10 px-1.5 py-0.5 text-seal">
            L1 ({(logo1XY.x * 100).toFixed(0)}%, {(logo1XY.y * 100).toFixed(0)}%)
          </span>
        )}
        {logo2XY && (
          <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-sky-300">
            L2 ({(logo2XY.x * 100).toFixed(0)}%, {(logo2XY.y * 100).toFixed(0)}%)
          </span>
        )}
        {!logo1XY && !logo2XY && (
          <span>{t('using_grid_pos')}</span>
        )}
      </div>
    </section>
  );
}