import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { exportErrorsCsv, exportErrorsJson } from '@/lib/errorReport';
import { useI18n } from '@/hooks/useI18n';

export default function ProgressPanel() {
  const { t } = useI18n();
  const progress = useAppStore((s) => s.progress);
  const logs = useAppStore((s) => s.logs);
  const result = useAppStore((s) => s.result);
  const isProcessing = useAppStore((s) => s.isProcessing);
  const sourceLabel = useAppStore((s) => s.sourceLabel);
  const checkpoint = useAppStore((s) => s.checkpoint);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const percent =
    progress?.phase === 'zip'
      ? progress.percent
      : (progress?.percent ?? (result && !isProcessing ? 100 : 0));

  const phaseLabel =
    progress?.phase === 'zip'
      ? t('zipping')
      : progress?.phase === 'write'
        ? t('writing')
        : t('processing');

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('progress')}</h2>
        <span className="tabular-nums text-xs font-semibold text-seal">{percent}%</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink-deep ring-1 ring-ink-border">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-seal to-amber-400 transition-all duration-300',
            isProcessing && 'animate-pulse-soft',
          )}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      {progress && isProcessing && (
        <p className="mt-1.5 truncate text-[11px] text-ink-muted">
          {phaseLabel}: {progress.chapterName} / {progress.fileName}{' '}
          <span className="text-ink-text">
            ({progress.current}/{progress.total})
          </span>
        </p>
      )}

      {checkpoint && !isProcessing && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          {t('checkpoint')} (#{checkpoint.nextGlobalIndex + 1})
        </div>
      )}

      {result && !isProcessing && (
        <div className="mt-2 rounded-lg border border-ink-border bg-ink-deep px-2.5 py-1.5 text-[11px]">
          <p className="font-medium text-ink-text">
            {t('done')} · {result.success} {t('success')}
            {result.failed > 0 ? ` · ${result.failed} ${t('failed')}` : ''}
            {result.skipped > 0 ? ` · ${result.skipped} ${t('skipped')}` : ''}
          </p>
          <p className="mt-0.5 text-ink-muted">
            {result.totalChapters} {t('chapters')} · {result.totalImages} {t('images')} ·{' '}
            {(result.elapsedMs / 1000).toFixed(1)}s
            {typeof result.bytesIn === 'number' && result.bytesIn > 0
              ? ` · ${(result.bytesIn / 1024 / 1024).toFixed(1)}MB`
              : ''}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-ink-border px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink-text"
                onClick={() => exportErrorsJson(result, sourceLabel)}
              >
                <Download className="h-3 w-3" />
                {t('err_json')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-ink-border px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink-text"
                onClick={() => exportErrorsCsv(result, sourceLabel)}
              >
                <Download className="h-3 w-3" />
                {t('err_csv')}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className="custom-scroll mt-2 max-h-28 space-y-0.5 overflow-y-auto rounded-lg border border-ink-border bg-ink-deep p-1.5 font-mono text-[10px]"
        role="log"
        aria-label="log"
      >
        {logs.length === 0 && <p className="text-ink-muted/70">{t('log_empty')}</p>}
        {logs.map((l) => (
          <div key={l.id} className="flex gap-1.5">
            <span className="shrink-0 text-ink-muted/60">{l.time}</span>
            <span
              className={cn(
                l.level === 'error' && 'text-red-400',
                l.level === 'success' && 'text-emerald-400',
                l.level === 'warn' && 'text-amber-300',
                l.level === 'info' && 'text-ink-muted',
              )}
            >
              {l.message}
            </span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </section>
  );
}
