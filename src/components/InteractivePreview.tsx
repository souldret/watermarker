import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { Crosshair, Maximize2, X, MousePointer2, Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { buildEdgeAnchorXY, calcLogoRect, calcLogo2Rect, drawPreview, resolveLogo1CustomXY } from '@/lib/watermark';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import type { CustomXY } from '@/lib/types';

/** Önizleme debounce süresi (slider gibi hızlı değişimlerde yeniden çizimi sınırlar) */
const PAINT_DEBOUNCE_MS = 40;

/** Büyük interaktif önizleme — tıklayarak logo konumunu belirle */
function InteractivePreview() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const logoSource = useAppStore((s) => s.logoSource);
  const logo2Source = useAppStore((s) => s.logo2Source);
  const settings = useAppStore((s) => s.settings);
  const previewImageUrl = useAppStore((s) => s.previewImageUrl);
  const previewPath = useAppStore((s) => s.previewPath);
  const setLogo1CustomXY = useAppStore((s) => s.setLogo1CustomXY);
  const clearLogo1PageOverride = useAppStore((s) => s.clearLogo1PageOverride);
  const patchLogo2Settings = useAppStore((s) => s.patchLogo2Settings);
  const patchSettings = useAppStore((s) => s.patchSettings);

  const customXYMode = settings.customXYMode ?? 'edge-anchor';
  const pageOverride = previewPath ? settings.logo1CustomXYOverrides?.[previewPath] : undefined;
  const [pinScope, setPinScope] = useState<'global' | 'page'>('global');

  const logo1XY = resolveLogo1CustomXY(settings, previewPath);
  const logo2XY = settings.logo2?.customXY;

  const [outputScale, setOutputScale] = useState(false);
  const outputScaleRef = useRef(false);
  outputScaleRef.current = outputScale;

  // Hangi logo'yu konumlandırıyoruz
  const [pinTarget, setPinTarget] = useState<'logo1' | 'logo2' | null>(null);
  const [hoverXY, setHoverXY] = useState<{ x: number; y: number } | null>(null);

  // Sürükleme: konum veya köşeden boyut
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'move' | 'resize' | null>(null);
  const dragEndedRef = useRef(false);
  const [ghostXY, setGhostXY] = useState<{ x: number; y: number } | null>(null);
  const [ghostSize, setGhostSize] = useState<number | null>(null);

  // Container boyutu — sadece ResizeObserver tetiklendiğinde güncellenir.
  // Her paintNow çağrısında getBoundingClientRect() çağırmak layout thrashing'e
  // yol açabildiği için (senkron reflow), bu değer bir ref'te cache'lenir.
  const maxDimsRef = useRef<{ maxW: number; maxH: number }>({ maxW: 520, maxH: 720 });

  const recalcMaxDims = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // maxH, uzun görsellerde scale hesabında kullanılmıyor (scroll ile handle edilir)
    // Yalnızca aşırı uzun şeritlerde alt sınır için iletilir
    maxDimsRef.current = {
      maxW: Math.max(200, rect.width - 4),
      maxH: Math.max(200, rect.height - 4),
    };
  }, []);

  const paintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Sadece hover/ghost crosshair overlay'ini çizer — watermark'ı YENİDEN
   * ÇİZMEZ. Bu ayrım kritik: fare hareketi (mousemove) yüksek frekansta
   * tetiklendiği için, her hareket için tam bir watermark render'ı (calcLogoRects,
   * drawImage vb.) yapmak CPU'yu gereksiz yere yorar. Overlay, base çizimin
   * ÜZERİNE eklenir; bu yüzden base'in bozulmaması için her overlay çağrısından
   * önce base yeniden çizilmeli — ancak bu maliyetli taban çizimi yalnızca
   * previewImageUrl/logo/settings değiştiğinde (drawBase) yapılır, hover'da
   * sadece son çizilmiş taban üzerine overlay eklenir (offscreen cache).
   */
  const baseSnapshotRef = useRef<OffscreenCanvas | HTMLCanvasElement | null>(null);

  const snapshotBase = (source: HTMLCanvasElement) => {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const snap = new OffscreenCanvas(source.width, source.height);
        const sctx = snap.getContext('2d');
        if (!sctx) return;
        sctx.drawImage(source, 0, 0);
        baseSnapshotRef.current = snap;
        return;
      }
      const snap = document.createElement('canvas');
      snap.width = source.width;
      snap.height = source.height;
      const sctx = snap.getContext('2d');
      if (!sctx) return;
      sctx.drawImage(source, 0, 0);
      baseSnapshotRef.current = snap;
    } catch {
      baseSnapshotRef.current = null;
    }
  };

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Taban görüntüyü (watermark render sonucu) snapshot'tan geri yükle —
    // getImageData büyük önizlemede CPU'yu kilitler; drawImage GPU kopyası kullanır.
    if (baseSnapshotRef.current) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(baseSnapshotRef.current, 0, 0);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const overlayXY = ghostXY || hoverXY;
    if (!pinTarget || !overlayXY) return;

    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const cssH = parseFloat(canvas.style.height) || canvas.height;
    const cx = overlayXY.x * cssW;
    const cy = overlayXY.y * cssH;
    const color = pinTarget === 'logo1' ? 'rgba(255,77,77,0.85)' : 'rgba(80,180,255,0.85)';
    const colorFill = pinTarget === 'logo1' ? 'rgba(255,77,77,0.25)' : 'rgba(80,180,255,0.25)';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / dpr;

    if (isDraggingRef.current && ghostXY) {
      // Sürükleme: crosshair yerine ghost logo kutusu göster
      const logo = pinTarget === 'logo1' ? logoSource : logo2Source;
      const pct = (ghostSize ?? (pinTarget === 'logo1' ? settings.sizePercent : settings.logo2?.sizePercent)) || 15;
      const ghostW = logo ? Math.round(cssW * (pct / 100)) : 40;
      const ghostH = logo ? Math.round(ghostW * (logo.height / Math.max(1, logo.width))) : 24;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(cx - ghostW / 2, cy - ghostH / 2, ghostW, ghostH);
      ctx.fillStyle = colorFill;
      ctx.fillRect(cx - ghostW / 2, cy - ghostH / 2, ghostW, ghostH);
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      // Normal crosshair
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cssH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cssW, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }, [pinTarget, hoverXY, ghostXY, ghostSize, logoSource, logo2Source, settings.sizePercent, settings.logo2]);

  // Çekirdek çizim fonksiyonu — watermark tabanını yeniden hesaplar (ağır).
  // Sadece previewImageUrl/logo/settings değiştiğinde çağrılmalı — hover/ghost
  // değişiminde ÇAĞRILMAZ (bkz. drawOverlay).
  const paintNow = useCallback(() => {
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
      baseSnapshotRef.current = null;
      return;
    }
    recalcMaxDims();
    const { maxW, maxH } = maxDimsRef.current;
    try {
      drawPreview(
        canvas, img, img.naturalWidth, img.naturalHeight,
        logoSource, logo2Source, settings, maxW, maxH, previewPath,
        outputScaleRef.current,
      );
    } catch {
      // önizleme hatası kritik değil
    }

    if (canvas.width > 0 && canvas.height > 0) snapshotBase(canvas);
    else baseSnapshotRef.current = null;

    drawOverlay();
  }, [previewImageUrl, previewPath, logoSource, logo2Source, settings, outputScale, recalcMaxDims, drawOverlay]);

  // Debounce wrapper — slider gibi hızlı ayar değişimlerinde gereksiz yeniden çizimi önler
  const paint = useCallback(() => {
    if (paintTimerRef.current !== null) clearTimeout(paintTimerRef.current);
    paintTimerRef.current = setTimeout(() => {
      paintTimerRef.current = null;
      paintNow();
    }, PAINT_DEBOUNCE_MS);
  }, [paintNow]);

  // Görsel yükle — URL değişince anında çiz (debounce yok)
  useEffect(() => {
    imgRef.current = null;
    if (!previewImageUrl) { paintNow(); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) { imgRef.current = img; paintNow(); } };
    img.onerror = () => { if (!cancelled) { imgRef.current = null; paintNow(); } };
    img.src = previewImageUrl;
    return () => {
      cancelled = true;
      // Decode edilmekte olan büyük görsel verisini serbest bırak.
      img.onload = null;
      img.onerror = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewImageUrl]);

  // Ayar/logo değişince debounced yeniden çiz (ağır: watermark taban render'ı)
  useEffect(() => { paint(); }, [paint]);

  // Hover/ghost/pinTarget değişince SADECE overlay'i yeniden çiz — watermark
  // tabanı yeniden hesaplanmaz (bkz. drawOverlay yorumu). Fare hareketi gibi
  // yüksek frekanslı olaylarda bu ayrım kritik performans farkı yaratır.
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // Resize observer — container boyutu değiştiğinde cache'i güncelle + anında çiz
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        recalcMaxDims();
        paintNow();
      });
    });
    ro.observe(container);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [paintNow, recalcMaxDims]);

  // Canvas'a tıklama/fare koordinatı → 0-1 oranı (CSS px → canvas px → oran)
  // DPR-aware: canvas.width/height fiziksel piksel, rect.width/height CSS piksel
  const relativeXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 1 || canvas.height < 1) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    // CSS piksel cinsinden koordinat (DPR bağımsız)
    const cssX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const cssY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    return {
      x: Math.min(1, Math.max(0, cssX / rect.width)),
      y: Math.min(1, Math.max(0, cssY / rect.height)),
    };
  }, []);

  /** Koordinat → CustomXY dönüştürücü */
  const buildCustomXY = useCallback((ratio: { x: number; y: number }): CustomXY => {
    const img = imgRef.current;
    if (customXYMode === 'edge-anchor' && img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return buildEdgeAnchorXY(ratio.x, ratio.y, img.naturalWidth, img.naturalHeight);
    }
    return { x: ratio.x, y: ratio.y, mode: 'ratio' };
  }, [customXYMode]);

  /** Konumu uygula; sizePercent verilirse sayfa pin'ine boyut da yazılır */
  const applyXY = useCallback((
    ratio: { x: number; y: number },
    target: 'logo1' | 'logo2',
    sizePercent?: number,
  ) => {
    const xy = buildCustomXY(ratio);
    if (sizePercent !== undefined) xy.sizePercent = Math.min(100, Math.max(2, Math.round(sizePercent)));
    if (target === 'logo1') setLogo1CustomXY(xy, pinScope);
    else patchLogo2Settings({ customXY: xy, ...(sizePercent !== undefined ? { sizePercent: xy.sizePercent, sizeMode: 'percent' as const } : {}) });
  }, [buildCustomXY, setLogo1CustomXY, patchLogo2Settings, pinScope]);

  const currentSizePercent = useCallback((target: 'logo1' | 'logo2') => {
    if (target === 'logo1') {
      return pageOverride?.sizePercent ?? settings.sizePercent;
    }
    return settings.logo2?.sizePercent ?? 10;
  }, [pageOverride, settings.sizePercent, settings.logo2]);

  /** Köşe tutamacı: çizilen logonun sağ-altı (önizleme oranında) */
  const handleCorner = useCallback((target: 'logo1' | 'logo2', center: { x: number; y: number }) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return { x: Math.min(1, center.x + 0.08), y: Math.min(1, center.y + 0.08) };
    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const cssH = parseFloat(canvas.style.height) || canvas.height;
    const logo = target === 'logo1' ? logoSource : logo2Source;
    if (!logo || cssW < 1 || cssH < 1) return { x: center.x, y: center.y };
    const sized = target === 'logo1'
      ? calcLogoRect(cssW, cssH, logo.width, logo.height, 'mc', {
          ...settings,
          marginPx: 0,
          sizePercent: currentSizePercent('logo1'),
          sizeMode: pageOverride?.sizePercent ? 'percent' : settings.sizeMode,
        }, { x: center.x, y: center.y, mode: 'ratio' })
      : calcLogo2Rect(cssW, cssH, logo.width, logo.height, 'mc', {
          ...settings.logo2,
          sizePercent: currentSizePercent('logo2'),
          customXY: { x: center.x, y: center.y, mode: 'ratio' },
        }, 0);
    return {
      x: Math.min(1, (sized.x + sized.w) / cssW),
      y: Math.min(1, (sized.y + sized.h) / cssH),
    };
  }, [currentSizePercent, logoSource, logo2Source, pageOverride, settings]);

  const nearCorner = (ratio: { x: number; y: number }, corner: { x: number; y: number }) => {
    return Math.hypot(ratio.x - corner.x, ratio.y - corner.y) < 0.045;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pinTarget) return;
    const ratio = relativeXY(e);
    if (!ratio) return;
    const center = pinTarget === 'logo1' ? logo1XY : logo2XY;
    const corner = center ? handleCorner(pinTarget, center) : null;
    dragModeRef.current = corner && nearCorner(ratio, corner) ? 'resize' : 'move';
    isDraggingRef.current = true;
    setGhostXY(center ? { x: center.x, y: center.y } : ratio);
    setGhostSize(null);
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragEndedRef.current) {
      dragEndedRef.current = false;
      return;
    }
    if (!pinTarget) return;
    if (isDraggingRef.current) return;
    const ratio = relativeXY(e);
    if (!ratio) return;
    applyXY(ratio, pinTarget);
    setPinTarget(null);
    setHoverXY(null);
    setGhostXY(null);
  };

  const moveFrameRef = useRef(0);
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pinTarget) return;
    const xy = relativeXY(e);
    if (!xy) return;
    if (moveFrameRef.current) cancelAnimationFrame(moveFrameRef.current);
    moveFrameRef.current = requestAnimationFrame(() => {
      moveFrameRef.current = 0;
      if (!isDraggingRef.current) {
        setHoverXY(xy);
        return;
      }
      if (dragModeRef.current === 'resize') {
        const center = ghostXY || (pinTarget === 'logo1' ? logo1XY : logo2XY);
        if (!center) return;
        const dx = Math.abs(xy.x - center.x) * 2;
        setGhostSize(Math.min(100, Math.max(2, Math.round(dx * 100))));
        return;
      }
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pinTarget || !isDraggingRef.current) return;
    const ratio = relativeXY(e);
    const mode = dragModeRef.current;
    const centerNow = ghostXY || (pinTarget === 'logo1' ? logo1XY : logo2XY);
    isDraggingRef.current = false;
    dragModeRef.current = null;
    dragEndedRef.current = true;
    setGhostXY(null);
    setGhostSize(null);
    if (!ratio) return;
    if (mode === 'resize') {
      const center = centerNow || ratio;
      const dx = Math.abs(ratio.x - center.x) * 2;
      const size = Math.min(100, Math.max(2, Math.round(dx * 100)));
      applyXY({ x: center.x, y: center.y }, pinTarget, size);
    } else {
      applyXY(ratio, pinTarget, pinScope === 'page' && pinTarget === 'logo1' ? (pageOverride?.sizePercent ?? settings.sizePercent) : undefined);
    }
    setPinTarget(null);
    setHoverXY(null);
  };

  const handleMouseLeave = () => {
    setHoverXY(null);
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragModeRef.current = null;
      setGhostXY(null);
      setGhostSize(null);
    }
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
              onClick={() => {
                setPinScope('global');
                setPinTarget(pinTarget === 'logo1' && pinScope === 'global' ? null : 'logo1');
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition',
                pinTarget === 'logo1' && pinScope === 'global'
                  ? 'border-seal bg-seal/15 text-seal'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:border-seal/40',
              )}
            >
              <MousePointer2 className="h-3 w-3" />
              {pinTarget === 'logo1' && pinScope === 'global' ? t('click_to_place') : t('pin_logo1')}
            </button>
          )}
          {hasLogo1 && previewPath && (
            <button
              type="button"
              onClick={() => {
                const next = pinTarget === 'logo1' && pinScope === 'page' ? null : 'logo1';
                setPinScope('page');
                setPinTarget(next);
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition',
                pinTarget === 'logo1' && pinScope === 'page'
                  ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:border-amber-400/40',
              )}
            >
              {t('pin_this_page')}
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
          {hasLogo1 && (
            <button
              type="button"
              onClick={() => setOutputScale((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition',
                outputScale
                  ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:border-emerald-400/40',
              )}
            >
              {outputScale ? t('preview_output_on') : t('preview_output')}
            </button>
          )}
          {/* Serbest konumları sıfırla */}
          {(logo1XY || logo2XY) && (
            <button
              type="button"
              onClick={() => {
                setLogo1CustomXY(null);
                if (previewPath) clearLogo1PageOverride(previewPath);
                patchLogo2Settings({ customXY: null });
              }}
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
          {pinTarget === 'logo1'
            ? (pinScope === 'page' ? t('pin_page_size_hint') : t('resize_hint'))
            : t('pin_logo2_hint')}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full overflow-y-auto overflow-x-hidden rounded-lg border border-ink-border bg-ink-deep"
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className={cn(
            'block',
            pinTarget
              ? isDraggingRef.current
                ? 'cursor-grabbing'
                : 'cursor-crosshair'
              : 'cursor-default',
          )}
          style={{ display: 'block' }}
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

      {/* Mod seçici + aktif serbest konum bilgisi */}
      <div className="mt-1.5 space-y-1.5">
        {/* Konum modu seçici */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-muted">{t('position_mode')}:</span>
          {(['edge-anchor', 'ratio'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchSettings({ customXYMode: m })}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition',
                customXYMode === m
                  ? m === 'edge-anchor'
                    ? 'bg-seal/20 text-seal'
                    : 'bg-ink-elevated text-ink-text'
                  : 'text-ink-muted hover:text-ink-text',
              )}
            >
              {m === 'edge-anchor' ? t('edge_distance') : t('ratio_01')}
            </button>
          ))}
        </div>

        {/* Mod açıklama notu */}
        <div className="flex items-start gap-1 text-[10px] text-ink-muted">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {customXYMode === 'edge-anchor' ? (
            <span>{t('edge_mode_hint')}</span>
          ) : (
            <span>{t('ratio_mode_hint')}</span>
          )}
        </div>

        {/* Koordinat özeti */}
        <div className="flex flex-wrap gap-2 text-[10px] text-ink-muted">
          {logo1XY && (
            <span className="rounded bg-seal/10 px-1.5 py-0.5 text-seal">
              {logo1XY.mode === 'edge-anchor' && logo1XY.anchorX
                ? `L1 ${logo1XY.anchorX[0]}${logo1XY.anchorY?.[0] ?? ''} +${Math.round(logo1XY.offsetXPx ?? 0)}/${Math.round(logo1XY.offsetYPx ?? 0)}px`
                : `L1 (${(logo1XY.x * 100).toFixed(0)}%, ${(logo1XY.y * 100).toFixed(0)}%)`}
            </span>
          )}
          {logo2XY && (
            <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-sky-300">
              {logo2XY.mode === 'edge-anchor' && logo2XY.anchorX
                ? `L2 ${logo2XY.anchorX[0]}${logo2XY.anchorY?.[0] ?? ''} +${Math.round(logo2XY.offsetXPx ?? 0)}/${Math.round(logo2XY.offsetYPx ?? 0)}px`
                : `L2 (${(logo2XY.x * 100).toFixed(0)}%, ${(logo2XY.y * 100).toFixed(0)}%)`}
            </span>
          )}
          {pageOverride && (
            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-300">
              {t('page_override_on')}
            </span>
          )}
          {!logo1XY && !logo2XY && (
            <span>{t('using_grid_pos')}</span>
          )}
        </div>
      </div>
    </section>
  );
}

export default memo(InteractivePreview);