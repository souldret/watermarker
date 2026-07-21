import { useAppStore } from '@/store/useAppStore';
import type { NamingPattern, OutputFormat, OutputTarget, SizeMode } from '@/lib/types';
import { QUALITY_PRESETS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';

function SliderRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <label className="font-medium text-ink-text">{label}</label>
        <span className="tabular-nums text-ink-muted">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
      />
    </div>
  );
}

export default function SettingsSliders() {
  const { t } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const setSizeMode = useAppStore((s) => s.setSizeMode);
  const setSizePercent = useAppStore((s) => s.setSizePercent);
  const setSizePx = useAppStore((s) => s.setSizePx);
  const setOpacity = useAppStore((s) => s.setOpacity);
  const setMarginPx = useAppStore((s) => s.setMarginPx);
  const setRotation = useAppStore((s) => s.setRotation);
  const setOutputQuality = useAppStore((s) => s.setOutputQuality);
  const setOutputFormat = useAppStore((s) => s.setOutputFormat);
  const setNamingPattern = useAppStore((s) => s.setNamingPattern);
  const setNamingCustom = useAppStore((s) => s.setNamingCustom);
  const setOutputTarget = useAppStore((s) => s.setOutputTarget);
  const applyQualityPreset = useAppStore((s) => s.applyQualityPreset);

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <h2 className="panel__title">{t('settings')}</h2>
      </div>

      <div className="flex gap-2">
        {(['percent', 'px'] as SizeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={cn(
              'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition',
              settings.sizeMode === m
                ? 'border-seal/50 bg-seal/10 text-seal'
                : 'border-ink-border bg-ink-deep text-ink-muted hover:bg-ink-elevated',
            )}
            onClick={() => setSizeMode(m)}
          >
            {m === 'percent' ? 'Boyut %' : 'Boyut px'}
          </button>
        ))}
      </div>

      {settings.sizeMode === 'percent' ? (
        <SliderRow
          label="Logo boyutu"
          valueLabel={`%${settings.sizePercent}`}
          min={1}
          max={60}
          value={settings.sizePercent}
          onChange={setSizePercent}
        />
      ) : (
        <SliderRow
          label="Logo genişliği"
          valueLabel={`${settings.sizePx}px`}
          min={24}
          max={600}
          value={settings.sizePx}
          onChange={setSizePx}
        />
      )}

      <SliderRow
        label="Opaklık"
        valueLabel={`%${Math.round(settings.opacity * 100)}`}
        min={5}
        max={100}
        value={Math.round(settings.opacity * 100)}
        onChange={(v) => setOpacity(v / 100)}
      />
      <SliderRow
        label="Kenar boşluğu"
        valueLabel={`${settings.marginPx}px`}
        min={0}
        max={120}
        value={settings.marginPx}
        onChange={setMarginPx}
      />
      <SliderRow
        label="Döndürme"
        valueLabel={`${settings.rotation}°`}
        min={-45}
        max={45}
        value={settings.rotation}
        onChange={setRotation}
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text">Kalite preset</label>
        <div className="grid grid-cols-2 gap-1.5">
          {QUALITY_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-lg border border-ink-border bg-ink-deep px-2 py-1.5 text-left text-[11px] text-ink-muted transition hover:border-seal/40 hover:text-ink-text"
              onClick={() => applyQualityPreset(p.format, p.quality)}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <SliderRow
        label="Çıktı kalitesi"
        valueLabel={`%${Math.round(settings.outputQuality * 100)}`}
        min={40}
        max={100}
        value={Math.round(settings.outputQuality * 100)}
        onChange={(v) => setOutputQuality(v / 100)}
      />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text" htmlFor="outFormat">
          Çıktı formatı
        </label>
        <select
          id="outFormat"
          className="select"
          value={settings.outputFormat}
          onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
        >
          <option value="same">Orijinal ile aynı</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text">Çıktı hedefi</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['zip', 'ZIP indir'],
            ['folder', 'Klasöre yaz'],
          ] as [OutputTarget, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-lg border px-2 py-2 text-xs font-medium transition',
                settings.outputTarget === id
                  ? 'border-seal/50 bg-seal/10 text-seal'
                  : 'border-ink-border bg-ink-deep text-ink-muted hover:bg-ink-elevated',
              )}
              onClick={() => setOutputTarget(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          Klasöre yaz: Chrome/Edge ile `watermarked` klasörü seç. Destek yoksa ZIP kullanılır.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-text" htmlFor="naming">
          Dosya isimlendirme
        </label>
        <select
          id="naming"
          className="select"
          value={settings.namingPattern}
          onChange={(e) => setNamingPattern(e.target.value as NamingPattern)}
        >
          <option value="original">Orijinal ad</option>
          <option value="suffix">Son ek (_wm)</option>
          <option value="prefix">Ön ek (wm_)</option>
          <option value="chapter_index">Bölüm_001</option>
          <option value="custom">Özel şablon</option>
        </select>
      </div>

      {settings.namingPattern === 'custom' && (
        <div className="space-y-1">
          <input
            className="select"
            value={settings.namingCustom}
            onChange={(e) => setNamingCustom(e.target.value)}
            placeholder="{chapter}_{index}_{name}"
          />
          <p className="text-[10px] text-ink-muted">
            Değişkenler: {'{chapter}'} {'{index}'} {'{name}'} {'{ext}'}
          </p>
        </div>
      )}
    </section>
  );
}
