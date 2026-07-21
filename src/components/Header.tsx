import { Moon, Stamp, Sun } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

export default function Header() {
  const { t } = useI18n();
  const ui = useAppStore((s) => s.ui);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLocale = useAppStore((s) => s.setLocale);
  const setCompact = useAppStore((s) => s.setCompact);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-border/80 bg-ink-panel/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-seal/15 ring-1 ring-seal/35">
            <Stamp className="h-4 w-4 text-seal" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold leading-tight tracking-tight text-ink-text">
              {t('app_title')}
            </h1>
            <p className="truncate text-[11px] text-ink-muted">{t('app_sub')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-md border border-ink-border bg-ink-deep p-0.5">
            {(['tr', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                  ui.locale === l ? 'bg-seal/20 text-seal' : 'text-ink-muted',
                )}
                onClick={() => setLocale(l)}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-icon h-8 w-8"
            title={t('theme')}
            onClick={() => setTheme(ui.theme === 'dark' ? 'light' : 'dark')}
          >
            {ui.theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            className={cn(
              'rounded-md border px-2 py-1 text-[10px] font-medium',
              ui.compact
                ? 'border-seal/40 bg-seal/10 text-seal'
                : 'border-ink-border bg-ink-deep text-ink-muted',
            )}
            onClick={() => setCompact(!ui.compact)}
          >
            {t('compact')}
          </button>

          <span className="hidden rounded-full border border-seal/30 bg-seal/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-seal sm:inline">
            {t('offline')}
          </span>
        </div>
      </div>
    </header>
  );
}
