import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { ProcessMode } from '@/lib/types';
import { useI18n } from '@/hooks/useI18n';

export default function ModeTabs() {
  const { t } = useI18n();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const isProcessing = useAppStore((s) => s.isProcessing);

  const MODES: { id: ProcessMode; title: string; desc: string }[] = [
    { id: 'single', title: t('single'), desc: t('single_desc') },
    { id: 'batch', title: t('batch'), desc: t('batch_desc') },
  ];

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('mode')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={isProcessing}
            onClick={() => setMode(m.id)}
            className={cn(
              'rounded-xl border px-3 py-3 text-left transition',
              mode === m.id
                ? 'border-seal/50 bg-seal/10'
                : 'border-ink-border bg-ink-deep hover:border-ink-muted/40 hover:bg-ink-elevated',
              isProcessing && 'opacity-60',
            )}
          >
            <div className={cn('text-sm font-semibold', mode === m.id ? 'text-seal' : 'text-ink-text')}>
              {m.title}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">{m.desc}</div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        {mode === 'single' ? t('single_hint') : t('batch_hint')}
      </p>
    </section>
  );
}
