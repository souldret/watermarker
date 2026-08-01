import type { GifPolicy, WatermarkPosition } from '@/lib/types';
import { DEFAULT_TEXT_WATERMARK } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/hooks/useI18n';

const POS: WatermarkPosition[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

export default function AdvancedOptions() {
  const { t } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const setSmartPosition = useAppStore((s) => s.setSmartPosition);
  const setGifPolicy = useAppStore((s) => s.setGifPolicy);
  const setLargeFileMb = useAppStore((s) => s.setLargeFileMb);
  const patchTextWatermark = useAppStore((s) => s.patchTextWatermark);
  const patchLongStripMode = useAppStore((s) => s.patchLongStripMode);
  const tw = settings.textWatermark ?? DEFAULT_TEXT_WATERMARK;
  const lsm = settings.longStripMode;
  // Serbest konum seçiliyken long-strip toggle disabled
  const hasCustomXY = Boolean(settings.logo1CustomXY);

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <h2 className="panel__title">{t('text_wm')} / AI</h2>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-text">
        <input
          type="checkbox"
          checked={settings.smartPosition}
          onChange={(e) => setSmartPosition(e.target.checked)}
        />
        <span>
          {t('smart_pos')}
          <span className="mt-0.5 block text-[10px] text-ink-muted">{t('smart_pos_desc')}</span>
        </span>
      </label>

      {/* Uzun şerit modu */}
      <div className="border-t border-ink-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-text">{t('long_strip_mode')}</span>
          {lsm.enabled && (
            <span className="text-[10px] text-ink-muted">
              ×{lsm.aspectThreshold} · {lsm.repeatEveryPx}px
            </span>
          )}
        </div>
        <label
          className={`flex items-center gap-2 text-xs ${hasCustomXY ? 'opacity-40 cursor-not-allowed' : 'text-ink-text'}`}
          title={hasCustomXY ? t('long_strip_custom_xy_disabled') : undefined}
        >
          <input
            type="checkbox"
            checked={lsm.enabled}
            disabled={hasCustomXY}
            onChange={(e) => patchLongStripMode({ enabled: e.target.checked })}
          />
          {t('long_strip_enabled')}
        </label>
        {hasCustomXY && (
          <p className="text-[10px] text-amber-400/80">{t('long_strip_custom_xy_disabled')}</p>
        )}
        <div className={lsm.enabled && !hasCustomXY ? 'grid grid-cols-2 gap-2' : 'pointer-events-none grid grid-cols-2 gap-2 opacity-40'}>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">{t('long_strip_threshold')}</label>
            <input
              type="number"
              min={1.5}
              max={20}
              step={0.5}
              className="select"
              value={lsm.aspectThreshold}
              onChange={(e) => patchLongStripMode({ aspectThreshold: Number(e.target.value) || 3 })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">{t('long_strip_repeat')}</label>
            <input
              type="number"
              min={200}
              max={5000}
              step={100}
              className="select"
              value={lsm.repeatEveryPx}
              onChange={(e) => patchLongStripMode({ repeatEveryPx: Number(e.target.value) || 1500 })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text">{t('gif_policy')}</label>
        <select
          className="select"
          value={settings.gifPolicy}
          onChange={(e) => setGifPolicy(e.target.value as GifPolicy)}
        >
          <option value="skip">{t('gif_skip')}</option>
          <option value="first_frame">{t('gif_first')}</option>
          <option value="warn">{t('gif_warn')}</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text">{t('large_file')}</label>
        <input
          type="number"
          min={5}
          max={200}
          className="select"
          value={settings.largeFileMb}
          onChange={(e) => setLargeFileMb(Number(e.target.value) || 25)}
        />
      </div>

      <div className="border-t border-ink-border pt-3">
        <label className="mb-2 flex items-center gap-2 text-xs text-ink-text">
          <input
            type="checkbox"
            checked={tw.enabled}
            onChange={(e) => patchTextWatermark({ enabled: e.target.checked })}
          />
          {t('text_enable')}
        </label>
        <div className={tw.enabled ? 'space-y-2' : 'pointer-events-none space-y-2 opacity-40'}>
          <input
            className="select"
            value={tw.text}
            onChange={(e) => patchTextWatermark({ text: e.target.value })}
            placeholder="@team"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-ink-muted">{t('text_size')}</label>
              <input
                type="number"
                min={10}
                max={120}
                className="select"
                value={tw.fontSize}
                onChange={(e) => patchTextWatermark({ fontSize: Number(e.target.value) || 28 })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-ink-muted">Color</label>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-lg border border-ink-border bg-ink-deep"
                value={tw.color}
                onChange={(e) => patchTextWatermark({ color: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">{t('opacity')}</label>
            <input
              type="range"
              className="range"
              min={10}
              max={100}
              value={Math.round(tw.opacity * 100)}
              onChange={(e) => patchTextWatermark({ opacity: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">Pos</label>
            <select
              className="select"
              value={tw.position}
              onChange={(e) =>
                patchTextWatermark({ position: e.target.value as WatermarkPosition })
              }
            >
              {POS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
