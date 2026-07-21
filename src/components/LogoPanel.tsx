import { useCallback, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { loadLogo } from '@/lib/watermark';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';

export default function LogoPanel() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const logoUrl = useAppStore((s) => s.logoUrl);
  const logoFile = useAppStore((s) => s.logoFile);
  const setLogo = useAppStore((s) => s.setLogo);
  const addLog = useAppStore((s) => s.addLog);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setLogo(null, null);
        return;
      }
      if (!file.type.startsWith('image/')) {
        addLog('error', 'Logo bir görsel dosyası olmalı.');
        return;
      }
      try {
        const source = await loadLogo(file);
        setLogo(file, source);
        addLog('success', `Logo yüklendi: ${file.name} (${source.width}×${source.height})`);
      } catch {
        addLog('error', 'Logo yüklenemedi.');
      }
    },
    [setLogo, addLog],
  );

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('logo')}</h2>
        {logoFile && (
          <button
            type="button"
            className="btn-icon"
            aria-label="Logoyu kaldır"
            onClick={() => handleFile(null)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className={cn(
          'logo-drop group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition',
          logoUrl
            ? 'border-seal/40 bg-ink-elevated'
            : 'border-ink-border bg-ink-deep hover:border-seal/50 hover:bg-ink-elevated',
        )}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />

        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo önizleme"
            className="max-h-28 max-w-full object-contain p-3"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-panel ring-1 ring-ink-border group-hover:ring-seal/40">
              <ImagePlus className="h-5 w-5 text-ink-muted group-hover:text-seal" />
            </div>
            <p className="text-sm font-medium text-ink-text">{t('logo_drop')}</p>
            <p className="text-xs text-ink-muted">{t('logo_hint')}</p>
          </div>
        )}
      </div>

      {logoFile && (
        <p className="mt-2 truncate text-xs text-ink-muted" title={logoFile.name}>
          {logoFile.name}
        </p>
      )}
    </section>
  );
}
