import { useCallback, useRef } from 'react';
import { ImagePlus, X, Layers } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { loadLogo } from '@/lib/watermark';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';
import type { WatermarkPosition } from '@/lib/types';
import { DEFAULT_LOGO2 } from '@/lib/types';

const POSITIONS: WatermarkPosition[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const POS_LABELS: Record<WatermarkPosition, string> = {
  tl: '↖', tc: '↑', tr: '↗',
  ml: '←', mc: '·', mr: '→',
  bl: '↙', bc: '↓', br: '↘',
};

export default function Logo2Panel() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const logo2Url = useAppStore((s) => s.logo2Url);
  const logo2File = useAppStore((s) => s.logo2File);
  const setLogo2 = useAppStore((s) => s.setLogo2);
  const addLog = useAppStore((s) => s.addLog);
  const logo2Settings = useAppStore((s) => s.settings.logo2);
  const patchLogo2Settings = useAppStore((s) => s.patchLogo2Settings);

  const l2 = logo2Settings ?? DEFAULT_LOGO2;

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setLogo2(null, null);
        return;
      }
      try {
        const src = await loadLogo(file);
        setLogo2(file, src);
        patchLogo2Settings({ enabled: true });
        addLog('success', `Logo 2: ${file.name}`);
      } catch (e) {
        addLog('error', `Logo 2 yüklenemedi: ${e instanceof Error ? e.message : e}`);
      }
    },
    [setLogo2, patchLogo2Settings, addLog],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = [...e.dataTransfer.files].find((f) => /\.(png|webp|svg|jpg|jpeg)$/i.test(f.name));
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const togglePos = (p: WatermarkPosition) => {
    const has = l2.positions.includes(p);
    let next = has ? l2.positions.filter((x) => x !== p) : [...l2.positions, p];
    if (next.length === 0) next = [p];
    patchLogo2Settings({ positions: next });
  };

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-seal" />
          <h2 className="panel__title">{t('logo2')}</h2>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={l2.enabled}
            onChange={(e) => patchLogo2Settings({ enabled: e.target.checked })}
            className="accent-seal"
          />
          <span className="text-[11px] text-ink-muted">{t('enabled')}</span>
        </label>
      </div>

      {/* Logo yükle */}
      <div
        className={cn(
          'relative cursor-pointer rounded-lg border border-dashed p-3 text-center transition',
          logo2File
            ? 'border-seal/40 bg-seal/5'
            : 'border-ink-border bg-ink-deep hover:border-seal/40',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.webp,.svg,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        {logo2File && logo2Url ? (
          <div className="flex items-center gap-2">
            <img src={logo2Url} alt="Logo 2" className="h-10 max-w-[80px] object-contain" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-medium text-ink-text">{logo2File.name}</p>
            </div>
            <button
              type="button"
              className="btn-icon h-6 w-6 shrink-0"
              onClick={(e) => { e.stopPropagation(); void handleFile(null); }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <ImagePlus className="mx-auto mb-1 h-5 w-5 text-ink-muted/60" />
            <p className="text-[11px] text-ink-muted">{t('logo2_drop')}</p>
          </>
        )}
      </div>

      {/* Konum ızgarası */}
      <div>
        <p className="mb-1 text-[11px] text-ink-muted">{t('position')}</p>
        <div className="grid grid-cols-3 gap-1">
          {POSITIONS.map((p) => {
            const active = l2.positions.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePos(p)}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md border text-sm transition',
                  active
                    ? 'border-seal bg-seal/15 text-seal'
                    : 'border-ink-border bg-ink-deep text-ink-muted hover:border-ink-muted/40',
                )}
              >
                {POS_LABELS[p]}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-ink-muted/70">{t('or_interactive_hint')}</p>
      </div>

      {/* Boyut */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <label className="mb-0.5 block text-ink-muted">{t('size_pct')}</label>
          <input
            type="range" min={2} max={50} step={1}
            value={l2.sizePercent}
            onChange={(e) => patchLogo2Settings({ sizePercent: Number(e.target.value), sizeMode: 'percent' })}
            className="range w-full"
          />
          <span className="tabular-nums text-ink-muted">{l2.sizePercent}%</span>
        </div>
        <div>
          <label className="mb-0.5 block text-ink-muted">{t('opacity')}</label>
          <input
            type="range" min={0.05} max={1} step={0.05}
            value={l2.opacity}
            onChange={(e) => patchLogo2Settings({ opacity: Number(e.target.value) })}
            className="range w-full"
          />
          <span className="tabular-nums text-ink-muted">{Math.round(l2.opacity * 100)}%</span>
        </div>
      </div>
    </section>
  );
}